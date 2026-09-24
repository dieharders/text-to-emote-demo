/**
 * The HTTP API the client talks to. Engine-agnostic: it only ever calls the `DecisionEngine`
 * interface, so it serves the mock engine and Von (and any future engine) the same way.
 *
 *   GET  /api/engine          → EngineInfo
 *   GET  /api/engine/events   → SSE stream of EngineEvent (status changes + log lines)
 *   POST /api/engine/setup    → start the one-time install (progress arrives on /events)
 *   POST /api/engine/cancel   → cancel a running install
 *   POST /api/engine/start    → start the engine
 *   POST /api/engine/stop     → stop the engine
 *   POST /api/decide          → DecisionRequest → DecisionResult
 */
import type { DecisionEngine } from "../engines/types";
import type { DecisionRequest, EngineEvent } from "../shared/api";
import { createRouter, fail, json, type Route } from "./router";
import { SSE_HEADERS, frame, heartbeat } from "./sse";

export interface Api {
  handle: Route;
  /** Cancel any install and stop the engine. Called on app shutdown. */
  shutdown(): Promise<void>;
}

/** Validate an untrusted request body into a DecisionRequest, or null. */
export function parseDecisionRequest(body: unknown): DecisionRequest | null {
  const b = body as { text?: unknown; question?: { instructions?: unknown; options?: unknown } } | null;
  if (typeof b?.text !== "string" || b.text.length > 5_000) return null;
  if (typeof b.question?.instructions !== "string") return null;
  const options = b.question.options;
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const entries = Object.entries(options as Record<string, unknown>);
  if (entries.length < 2 || entries.length > 32 || entries.some(([, v]) => typeof v !== "string")) return null;
  return {
    text: b.text,
    question: { instructions: b.question.instructions, options: Object.fromEntries(entries) as Record<string, string> },
  };
}

export function createApi(engine: DecisionEngine, opts = { allowInstall: process.env.EB_ALLOW_INSTALL !== "0" }): Api {
  let setupAbort: AbortController | null = null;

  const startInBackground = () => {
    engine.start().catch((err) => console.error("[engine] start failed:", err));
  };

  // An installed engine starts on its own. Only DOWNLOADS wait for a click.
  if (engine.info().status.state === "stopped") startInBackground();

  const routes: Record<string, Route> = {
    "GET /api/engine": () => json(200, engine.info()),

    "GET /api/engine/events": (req) => {
      let cleanup = () => {};
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: EngineEvent) => {
            try {
              controller.enqueue(frame(event));
            } catch {
              // Client gone; the abort listener below cleans up.
            }
          };
          send({ type: "status", status: engine.info().status });
          const unsubscribe = engine.onEvent(send);
          const stopHeartbeat = heartbeat(controller);
          cleanup = () => {
            unsubscribe();
            stopHeartbeat();
          };
          req.signal.addEventListener("abort", () => {
            cleanup();
            try {
              controller.close();
            } catch {
              // Already closed.
            }
          });
        },
        cancel() {
          cleanup();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    },

    "POST /api/engine/setup": () => {
      if (!opts.allowInstall) return fail(403, "install_disabled", "Downloads are turned off (EB_ALLOW_INSTALL=0).");
      if (setupAbort) return fail(409, "busy", "Setup is already running.");
      const status = engine.info().status;
      if (status.state === "unsupported") return fail(409, "unsupported", status.reason);

      const controller = new AbortController();
      setupAbort = controller;
      (async () => {
        try {
          await engine.setup(controller.signal);
          await engine.start();
        } catch (err) {
          // The engine has already reported this through its status; this is the operator's copy.
          if (!controller.signal.aborted) console.error("[engine] setup failed:", err);
        } finally {
          setupAbort = null;
        }
      })();
      return json(202, { ok: true });
    },

    "POST /api/engine/cancel": () => {
      setupAbort?.abort();
      return json(200, { ok: true });
    },

    "POST /api/engine/start": () => {
      startInBackground();
      return json(202, { ok: true });
    },

    "POST /api/engine/stop": async () => {
      await engine.stop();
      return json(200, { ok: true });
    },

    "POST /api/decide": async (req) => {
      const body = parseDecisionRequest(await req.json().catch(() => null));
      if (!body) return fail(400, "bad_request", "Expected { text, question: { instructions, options } } with 2–32 options.");
      if (engine.info().status.state !== "ready") return fail(409, "not_ready", "The decision engine is not running.");
      try {
        return json(200, await engine.decide(body, req.signal));
      } catch (err) {
        if (req.signal.aborted) return fail(499, "cancelled", "The request was cancelled.");
        console.error("[engine] decide failed:", err);
        return fail(502, "engine_error", "The decision engine could not score this line.");
      }
    },
  };

  return {
    handle: createRouter(routes),
    async shutdown() {
      setupAbort?.abort();
      await engine.stop();
    },
  };
}
