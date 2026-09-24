/**
 * What every decision engine implements. The server talks to engines ONLY through this.
 *
 * An engine owns everything model-specific: its runtime (a Python sidecar, in-process code, a
 * remote API), its dependencies and downloads, and how it maps a `ChoiceQuestion` onto its model.
 * To add one, create `src/engines/<id>/index.ts` exporting a factory and register it in
 * `./index.ts`. Nothing else in the app changes.
 */
import type { DecisionRequest, DecisionResult, EngineEvent, EngineInfo } from "../shared/api";

export interface DecisionEngine {
  /** Identity plus current status. Cheap and synchronous: the UI polls nothing, it subscribes. */
  info(): EngineInfo;

  /** Status changes and log lines as they happen. Returns an unsubscribe function. */
  onEvent(listener: (event: EngineEvent) => void): () => void;

  /**
   * One-time install: downloads, environments. Idempotent (finished steps are skipped) and
   * resumable (an aborted download continues next time). Runs only after the user asks.
   */
  setup(signal: AbortSignal): Promise<void>;

  /** Bring the model up. Resolves once it can answer `decide`. */
  start(): Promise<void>;

  /** Shut the model down. Safe to call twice, and while `start` is still running. */
  stop(): Promise<void>;

  /** Score the question's options for the text. Only valid while the status is `ready`. */
  decide(req: DecisionRequest, signal?: AbortSignal): Promise<DecisionResult>;
}

/** Engines are created asynchronously so they can check what is already installed. */
export type EngineFactory = () => Promise<DecisionEngine>;

/** The rejection for a cancelled operation. The NAME is the contract, like `fetch`'s. */
export function abortError(what = "operation"): Error {
  const err = new Error(`${what} cancelled`);
  err.name = "AbortError";
  return err;
}

export const isAbortError = (err: unknown): boolean => (err as { name?: string } | null)?.name === "AbortError";
