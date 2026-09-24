/**
 * Reading the script aloud, line by line:
 *
 *   for each line → get its decision (prefetching the next two) → show the pose
 *                 → speak it with the pose's voice → short pause → next line
 *
 * Decisions come from the engine through `/api/decide`, cached by the text that was scored: the
 * sentence, or for a short one its whole line (see `scoringText`). So replays and "Analyze" never
 * ask twice, and the short sentences of one line share a single request. Look one up with
 * `decisionOf(line)`. The pose itself is chosen by the caller (`choosePose`), which applies the
 * decision rule with the current thresholds.
 */
import { useCallback, useRef, useState } from "react";
import type { ChoiceQuestion, DecisionResult } from "../../shared/api";
import { ApiError, api } from "../lib/api";
import { poseById, type PoseId } from "../poses/catalog";
import type { BabbleVoice } from "../voice/babble";
import { planSpeech } from "../voice/planSpeech";
import { scoringText, type ScriptLine } from "./parseScript";

export interface LineDecision {
  result?: DecisionResult;
  /** Why there is no result (e.g. the engine is not running). */
  error?: string;
}

export interface PlaybackState {
  status: "idle" | "playing";
  lines: ScriptLine[];
  /** Index of the line being read, -1 when none. */
  current: number;
  phase: "deciding" | "speaking" | "pausing" | null;
}

const IDLE: PlaybackState = { status: "idle", lines: [], current: -1, phase: null };
const PAUSE_MS = 350;
const PREFETCH = 2;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

export function usePlayback(opts: {
  voice: BabbleVoice;
  question: ChoiceQuestion;
  choosePose: (result: DecisionResult | undefined) => PoseId;
}) {
  const [state, setState] = useState<PlaybackState>(IDLE);
  const [decisions, setDecisions] = useState<Record<string, LineDecision>>({});
  const cache = useRef(new Map<string, Promise<LineDecision>>());
  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** The decision for a piece of text: cached, and shared by concurrent callers. */
  const decisionFor = useCallback((text: string): Promise<LineDecision> => {
    let pending = cache.current.get(text);
    if (!pending) {
      pending = api
        .decide({ text, question: optsRef.current.question })
        .then(
          (result): LineDecision => ({ result }),
          (err: unknown): LineDecision => ({
            error: err instanceof ApiError ? err.message : "Could not reach the app's server.",
          }),
        );
      cache.current.set(text, pending);
      pending.then((decision) => {
        setDecisions((all) => ({ ...all, [text]: decision }));
        // Failures are not cached: the engine may be running by the next attempt.
        if (decision.error) cache.current.delete(text);
      });
    }
    return pending;
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    optsRef.current.voice.cancel();
    setState(IDLE);
  }, []);

  const play = useCallback(
    async (lines: ScriptLine[]) => {
      stop();
      if (lines.length === 0) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      const { voice } = optsRef.current;
      await voice.unlock(); // still inside the click's user gesture

      setState({ status: "playing", lines, current: 0, phase: "deciding" });
      for (let i = 0; i < lines.length && !signal.aborted; i++) {
        setState((s) => ({ ...s, current: i, phase: "deciding" }));
        // Queue this line and the next two; the engine answers them in order.
        lines.slice(i, i + 1 + PREFETCH).forEach((line) => void decisionFor(scoringText(line)));
        const decision = await decisionFor(scoringText(lines[i]!));
        if (signal.aborted) break;

        const pose = optsRef.current.choosePose(decision.result);
        const preset = poseById[pose].voice;
        setState((s) => ({ ...s, phase: "speaking" }));
        await voice.speak(planSpeech(lines[i]!.text, preset), preset).done;
        if (signal.aborted) break;

        setState((s) => ({ ...s, phase: "pausing" }));
        await sleep(PAUSE_MS, signal);
      }
      if (!signal.aborted) {
        abortRef.current = null;
        setState(IDLE);
      }
    },
    [decisionFor, stop],
  );

  /** Score every line without reading it (fills in the Lines list). */
  const analyze = useCallback((lines: ScriptLine[]) => lines.forEach((line) => void decisionFor(scoringText(line))), [decisionFor]);

  /** A line's decision, if it has one yet. */
  const decisionOf = useCallback((line: ScriptLine): LineDecision | undefined => decisions[scoringText(line)], [decisions]);

  return { state, decisionOf, play, stop, analyze };
}
