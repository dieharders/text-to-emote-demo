/**
 * The contract between the client and the server: the ONLY types both sides share.
 *
 * Everything here is plain data. Nothing in it knows which decision model is running, so a new
 * engine (see src/engines/) never changes this file, and the UI never learns an engine's name
 * except as display text in `EngineInfo`.
 */

/** A multiple-choice question: pick the option that best fits the text. */
export interface ChoiceQuestion {
  instructions: string;
  /** label → description. Engines may only ever see the description, so it should name the label. */
  options: Record<string, string>;
}

export interface DecisionRequest {
  text: string;
  question: ChoiceQuestion;
}

export interface DecisionResult {
  /** Exactly the question's option labels, each 0..1, summing to 1. */
  distribution: Record<string, number>;
  /** The engine's own confidence figure, when it has one, labelled with how it is computed. */
  nativeConfidence?: { value: number; label: string };
  latencyMs: number;
  /** Model id and version as the engine reports it, e.g. "von-1.2.0". */
  model: string;
  /** Display-only extras (device, calibration…). Never branched on by the client. */
  meta?: Record<string, string | number>;
}

export type EngineStatus =
  /** Cannot run on this machine; `reason` says why in words a user can act on. */
  | { state: "unsupported"; reason: string }
  /** Needs a one-time download before it can start. */
  | { state: "needs-setup"; downloadBytes: number }
  | { state: "setting-up"; step: string; done?: number; total?: number }
  /** Installed, not running. */
  | { state: "stopped" }
  | { state: "starting"; step?: string }
  | { state: "ready"; device?: string }
  | { state: "error"; message: string };

export interface EngineInfo {
  id: string;
  name: string;
  version: string;
  status: EngineStatus;
}

/** What `/api/engine/events` streams: status changes and human-readable log lines. */
export type EngineEvent = { type: "status"; status: EngineStatus } | { type: "log"; line: string };

/** Error body of every failed `/api/*` call. `code` is for code; `error` is for people. */
export interface ApiErrorBody {
  error: string;
  code: string;
}
