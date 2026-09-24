/**
 * The mock engine: scores options by keyword overlap. Instant, deterministic, no downloads.
 *
 * It exists so the UI, playback and tests can run without a 3 GB model (`bun run dev` uses it
 * by default), and as the smallest possible example of a `DecisionEngine`. It is not a model:
 * it only sees words that literally appear in an option's label or description.
 */
import type { DecisionResult } from "../../shared/api";
import { normalize } from "../../shared/decide";
import { EngineEvents } from "../events";
import { abortError, type DecisionEngine } from "../types";

/** Words in the pose descriptions that say nothing about an emotion ("caught off guard"…). */
const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "no", "not", "of", "to", "in", "is", "it", "strong", "emotion",
  "matter", "fact", "caught", "off", "guard", "does", "working", "out",
]);

const words = (text: string) => text.toLowerCase().match(/[a-z']+/g) ?? [];

/** Raw keyword score: +1 per word of the text that matches one of the option's keywords. */
function hits(textWords: string[], option: string): number {
  const keywords = new Set(words(option).filter((w) => !STOPWORDS.has(w)));
  let score = 0;
  for (const w of textWords) {
    if (keywords.has(w)) score += 1;
    // Cheap stemming: "celebrating" matches "celebrate", "worried" matches "worry".
    else if (w.length >= 5 && [...keywords].some((k) => k.length >= 5 && (w.startsWith(k.slice(0, 5)) || k.startsWith(w.slice(0, 5))))) score += 0.75;
  }
  return score;
}

export function scoreOptions(text: string, options: Record<string, string>): Record<string, number> {
  const textWords = words(text);
  const logits = Object.fromEntries(
    Object.entries(options).map(([label, description]) => {
      // A small prior on "neutral" so a line with no emotional words lands there.
      const prior = label === "neutral" ? 0.6 : 0;
      return [label, prior + 2.5 * hits(textWords, `${label} ${description}`)];
    }),
  );
  const max = Math.max(...Object.values(logits));
  return normalize(Object.fromEntries(Object.entries(logits).map(([k, v]) => [k, Math.exp(v - max)])));
}

export async function createMockEngine() {
  const events = new EngineEvents({ state: "stopped" });

  const engine: DecisionEngine = {
    info: () => ({ id: "mock", name: "Mock (keywords)", version: "1.0", status: events.status }),
    onEvent: (listener) => events.on(listener),

    async setup() {
      // Nothing to download.
    },

    async start() {
      events.setStatus({ state: "ready", device: "keyword match" });
    },

    async stop() {
      events.setStatus({ state: "stopped" });
    },

    async decide(req, signal): Promise<DecisionResult> {
      // Checked first: an abort listener never fires for a signal that was aborted already.
      if (signal?.aborted) throw abortError("decision");
      const started = performance.now();
      // A little latency, so the UI's loading states get exercised like they would be for real.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 40);
        signal?.addEventListener("abort", () => (clearTimeout(timer), reject(abortError("decision"))), { once: true });
      });
      return {
        distribution: scoreOptions(req.text, req.question.options),
        latencyMs: Math.round(performance.now() - started),
        model: "mock-1.0",
        meta: { method: "keyword overlap" },
      };
    },
  };
  return engine;
}
