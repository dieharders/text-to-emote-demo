/**
 * Run Von's own HTTP server (`von serve`) as a hidden child process on a loopback port.
 *
 * Two Von quirks shape this file:
 *   - `/health` answers 200 as soon as the server is up, BEFORE the model loads: Von loads
 *     lazily on the first request. So "ready" means a warmup request has succeeded.
 *   - Von reads a local checkpoint from `checkpoints/von-1.2/` relative to its working
 *     directory, which is why it runs with `cwd` = the engine folder and `HF_HUB_OFFLINE=1`
 *     (it must never fall back to downloading an unpinned `main` from Hugging Face).
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { VonClient, choice } from "von-sdk";
import { forgetChild, freePort, killTree, readLines, reapOrphans, recordChild, spawnHidden } from "../../server/process";
import { abortError } from "../types";
import { VON_MODEL } from "./manifest";
import type { VonPaths } from "./setup";

export interface Sidecar {
  baseURL: string;
  /** As Von reports it, e.g. "Apple Silicon [MPS]" or "CPU". */
  device: string;
  /** Resolves with the exit code when the process ends, for any reason. */
  exited: Promise<number>;
  stop(): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startSidecar(
  p: VonPaths,
  opts: { signal: AbortSignal; log: (line: string) => void; step: (step: string) => void },
): Promise<Sidecar> {
  await reapOrphans(p.runningDir, "von.cli", opts.log);
  await mkdir(p.logs, { recursive: true });

  const port = await freePort();
  // Leave a couple of cores for the window and the audio, so the animation stays smooth.
  const threads = String(Math.max(1, availableParallelism() - 2));

  opts.step("Launching Python");
  const child = spawnHidden(
    [p.python, "-m", "von.cli", "serve", "--host", "127.0.0.1", "--port", String(port), "--model", VON_MODEL, "--device", "auto"],
    {
      cwd: p.root,
      env: {
        HF_HUB_OFFLINE: "1",
        HF_HOME: join(p.root, "hf"),
        PYTHONUNBUFFERED: "1",
        OMP_NUM_THREADS: threads,
        MKL_NUM_THREADS: threads,
        TOKENIZERS_PARALLELISM: "false",
        NO_COLOR: "1",
        VIRTUAL_ENV: undefined,
      },
    },
  );
  await recordChild(p.runningDir, child.pid);

  // Everything Von prints goes to logs/von.log and the app's log stream; two lines are also read
  // for meaning: the device it picked, and whether its calibration file loaded.
  const logFile = createWriteStream(join(p.logs, "von.log"), { flags: "a" });
  logFile.write(`\n--- ${new Date().toISOString()} starting ${VON_MODEL} on 127.0.0.1:${port}\n`);
  let device = "unknown";
  let calibration: "active" | "missing" | null = null;
  const tail: string[] = [];
  const onLine = (line: string) => {
    logFile.write(`${line}\n`);
    tail.push(line);
    if (tail.length > 30) tail.shift();
    opts.log(line);
    const started = /Starting Von Decision Server \[(.+?) on (.+)\] on http/.exec(line);
    if (started) device = started[2]!;
    if (/calibration map active/i.test(line)) calibration = "active";
    else if (/uncalibrated/i.test(line)) calibration = "missing";
  };
  const pump = async (stream: ReadableStream<Uint8Array>) => {
    for await (const line of readLines(stream)) onLine(line);
  };
  const pumps = Promise.all([pump(child.stdout), pump(child.stderr)]).catch(() => {});

  const exited = child.exited.then(async (code) => {
    await pumps;
    logFile.end();
    await forgetChild(p.runningDir, child.pid);
    return code;
  });

  const stop = async () => {
    killTree(child);
    await Promise.race([exited, sleep(5_000)]);
  };

  // Startup work races the process dying (bad install, port clash…) and the caller cancelling.
  const guarded = <T>(work: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(abortError("start"));
      opts.signal.addEventListener("abort", onAbort, { once: true });
      exited.then((code) => reject(new Error(`Von exited during startup (code ${code}):\n${tail.slice(-8).join("\n")}`)));
      work.then(resolve, reject).finally(() => opts.signal.removeEventListener("abort", onAbort));
    });

  const baseURL = `http://127.0.0.1:${port}`;
  try {
    opts.step("Starting the Von server");
    await guarded(waitForHealth(baseURL, opts.signal));

    opts.step("Loading the model (the first start can take a minute)");
    const warmup = new VonClient({ baseURL, timeout: 10 * 60_000 });
    await guarded(
      warmup.systemOne({
        model: `${VON_MODEL}.0`,
        state: "Hello! It is so nice to meet you.",
        questions: { warmup: choice("Which emotion does the speaker express in this line?", { happy: "happy: glad, pleased", neutral: "neutral: calm" }) },
      }),
    );

    await sleep(250); // the "Loaded … weights" line can trail the HTTP response
    if (calibration === "missing") {
      throw new Error("Von loaded without its calibration file (marker_calibration.json). Run setup again.");
    }
    if (calibration === null) opts.log("Note: could not confirm from Von's log that its calibration loaded.");
  } catch (err) {
    await stop();
    throw err;
  }

  return { baseURL, device, exited, stop };
}

async function waitForHealth(baseURL: string, signal: AbortSignal): Promise<void> {
  // Importing PyTorch the first time compiles bytecode, which can take a while on a slow disk.
  const deadline = Date.now() + 3 * 60_000;
  while (Date.now() < deadline) {
    if (signal.aborted) throw abortError("start");
    const ok = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(2_000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
    await sleep(300);
  }
  throw new Error("Von's server did not come up within 3 minutes.");
}
