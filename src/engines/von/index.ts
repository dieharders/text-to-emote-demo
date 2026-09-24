/**
 * The Von engine (https://github.com/wfzyx/von): a non-autoregressive "System One" decision
 * model on ModernBERT-large. One forward pass scores every option of a multiple-choice question.
 *
 * Von runs as its own Python server (see ./sidecar.ts) that this engine installs (./setup.ts)
 * and talks to through the official TypeScript client, npm `von-sdk`.
 */
import { join } from "node:path";
import { VonClient, choice, type ChoiceAnswer } from "von-sdk";
import type { DecisionResult, EngineStatus } from "../../shared/api";
import { normalize } from "../../shared/decide";
import { engineDir } from "../../server/paths";
import { EngineEvents } from "../events";
import { abortError, isAbortError, type DecisionEngine } from "../types";
import { DOWNLOAD_BYTES, VON_MODEL, VON_SDK_VERSION, unsupportedReason } from "./manifest";
import { isInstalled, setupVon, vonPaths, type SetupReporter } from "./setup";
import { startSidecar, type Sidecar } from "./sidecar";

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Von treats `[MASK]`, `[SEP]`… in its input as real tokens, which would break its option
 * scoring (it counts `[MASK]` markers). Script text never needs them.
 */
const sanitize = (text: string) =>
  text.replace(/\[(MASK|SEP|CLS|PAD|UNK)\]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 2_000);

export async function createVonEngine(): Promise<DecisionEngine> {
  const paths = vonPaths(engineDir("von"));
  const unsupported = unsupportedReason();
  const needsSetup: EngineStatus = { state: "needs-setup", downloadBytes: DOWNLOAD_BYTES };

  const events = new EngineEvents(
    unsupported ? { state: "unsupported", reason: unsupported } : (await isInstalled(paths)) ? { state: "stopped" } : needsSetup,
  );

  let sidecar: Sidecar | null = null;
  let client: VonClient | null = null;
  let starting: Promise<void> | null = null;
  let startAbort: AbortController | null = null;
  // Decisions run one at a time: Von's server has no inference lock, so concurrent requests
  // would run concurrent forward passes on one model and slow every one of them down.
  let queue: Promise<unknown> = Promise.resolve();

  // Downloads report progress per chunk; a status event per chunk would flood the UI.
  let lastReport = 0;
  const reporter: SetupReporter = {
    step(step, done, total) {
      const now = Date.now();
      const status = events.status;
      const sameStep = status.state === "setting-up" && status.step === step;
      if (sameStep && now - lastReport < 200 && done !== total) return;
      lastReport = now;
      events.setStatus({ state: "setting-up", step, done, total });
    },
    log: (line) => events.log(line),
  };

  async function doStart(): Promise<void> {
    if (sidecar) return;
    if (unsupported) throw new Error(unsupported);
    if (!(await isInstalled(paths))) {
      events.setStatus(needsSetup);
      throw new Error("Von is not set up yet.");
    }

    startAbort = new AbortController();
    events.setStatus({ state: "starting" });
    try {
      const s = await startSidecar(paths, {
        signal: startAbort.signal,
        log: (line) => events.log(line),
        step: (step) => events.setStatus({ state: "starting", step }),
      });
      sidecar = s;
      client = new VonClient({ baseURL: s.baseURL, timeout: 60_000 });
      events.setStatus({ state: "ready", device: s.device });

      s.exited.then((code) => {
        if (sidecar !== s) return; // stopped on purpose
        sidecar = null;
        client = null;
        events.setStatus({
          state: "error",
          message: `Von stopped unexpectedly (exit code ${code}). Its log is at ${join(paths.logs, "von.log")}.`,
        });
      });
    } catch (err) {
      if (isAbortError(err)) {
        events.setStatus({ state: "stopped" });
        return;
      }
      events.setStatus({ state: "error", message: `Von failed to start: ${errorText(err)}` });
      throw err;
    } finally {
      startAbort = null;
    }
  }

  const engine: DecisionEngine = {
    info: () => ({ id: "von", name: "Von", version: `${VON_MODEL} · von-sdk ${VON_SDK_VERSION}`, status: events.status }),
    onEvent: (listener) => events.on(listener),

    async setup(signal) {
      if (unsupported) throw new Error(unsupported);
      try {
        await setupVon(paths, signal, reporter);
        events.setStatus({ state: "stopped" });
        events.log("Von is installed.");
      } catch (err) {
        if (signal.aborted || isAbortError(err)) {
          events.setStatus(needsSetup);
          events.log("Setup cancelled. Finished downloads are kept, and the rest resumes next time.");
        } else {
          events.setStatus({ state: "error", message: `Setup failed: ${errorText(err)}` });
        }
        throw err;
      }
    },

    start() {
      starting ??= doStart().finally(() => {
        starting = null;
      });
      return starting;
    },

    async stop() {
      startAbort?.abort();
      await starting?.catch(() => {});
      const s = sidecar;
      sidecar = null;
      client = null;
      if (s) await s.stop();
      const state = events.status.state;
      if (state === "ready" || state === "starting" || state === "error") events.setStatus({ state: "stopped" });
    },

    decide(req, signal) {
      const run = async (): Promise<DecisionResult> => {
        if (signal?.aborted) throw abortError("decision");
        const c = client;
        if (!c) throw new Error("Von is not running.");

        const started = performance.now();
        const res = await c.systemOne({
          model: `${VON_MODEL}.0`,
          state: sanitize(req.text),
          questions: { pose: choice(req.question.instructions, req.question.options) },
        });
        const answer = res.answers.pose as ChoiceAnswer | undefined;
        if (!answer || answer.type !== "choice") throw new Error("Von returned no answer for the question.");

        // Von rounds probabilities to 4 decimals; renormalize over exactly the asked labels.
        const labels = Object.keys(req.question.options);
        const distribution = normalize(Object.fromEntries(labels.map((l) => [l, answer.probabilities[l] ?? 0])));
        return {
          distribution,
          nativeConfidence: { value: answer.confidence, label: "(n·pmax − 1) / (n − 1)" },
          latencyMs: Math.round(performance.now() - started),
          model: res.model,
          meta: { device: sidecar?.device ?? "unknown" },
        };
      };
      const result = queue.then(run);
      queue = result.catch(() => {});
      return result;
    },
  };
  return engine;
}
