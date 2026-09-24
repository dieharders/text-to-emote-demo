/**
 * The decision rule: turn an engine's probability distribution into the pose to show.
 *
 * Pure and engine-agnostic. The engine only SCORES the options; this is where the app decides
 * what to do with the scores. It runs in the client, so moving a threshold slider re-decides
 * instantly without asking the engine again.
 */

export interface GateOptions {
  /** Below this top probability the engine is not sure enough: show `fallback` instead. */
  minTop: number;
  /** Below this gap between the top two options the call is a coin flip: show `fallback`. */
  minMargin: number;
  /** The pose shown when the gate trips. */
  fallback: string;
}

export const DEFAULT_GATE: GateOptions = { minTop: 0.35, minMargin: 0.08, fallback: "neutral" };

export interface Decision {
  /** The pose to show: `top`, or `fallback` when the gate tripped. */
  pose: string;
  /** The engine's highest-scoring option. */
  top: string;
  pTop: number;
  /** pTop minus the runner-up's probability. */
  margin: number;
  /** Shannon entropy normalised to 0..1 (0 = certain, 1 = uniform). */
  entropy: number;
  gated: boolean;
  reason: string;
  /** Every option, highest probability first. */
  ranked: { label: string; p: number }[];
}

/** Rescale to sum 1. Engines round their outputs, so a raw distribution rarely sums exactly. */
export function normalize(distribution: Record<string, number>): Record<string, number> {
  const entries = Object.entries(distribution).map(([k, v]) => [k, Number.isFinite(v) && v > 0 ? v : 0] as const);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  if (sum <= 0) return Object.fromEntries(entries.map(([k]) => [k, 1 / Math.max(1, entries.length)]));
  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum]));
}

export function decide(distribution: Record<string, number>, gate: GateOptions = DEFAULT_GATE): Decision {
  const labels = Object.keys(distribution);
  if (labels.length === 0) {
    return {
      pose: gate.fallback, top: gate.fallback, pTop: 0, margin: 0, entropy: 1,
      gated: true, reason: "no scores", ranked: [],
    };
  }

  const probs = normalize(distribution);
  // Stable sort: equal probabilities keep the question's option order.
  const ranked = labels.map((label) => ({ label, p: probs[label] ?? 0 })).sort((a, b) => b.p - a.p);
  const top = ranked[0]!;
  const margin = top.p - (ranked[1]?.p ?? 0);

  const h = ranked.reduce((s, { p }) => (p > 0 ? s - p * Math.log(p) : s), 0);
  const entropy = ranked.length > 1 ? h / Math.log(ranked.length) : 0;

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  let reason = `${top.label} at ${pct(top.p)}`;
  let gated = false;
  if (top.p < gate.minTop) {
    gated = true;
    reason = `top score ${pct(top.p)} is under ${pct(gate.minTop)}`;
  } else if (margin < gate.minMargin) {
    gated = true;
    reason = `lead of ${pct(margin)} over ${ranked[1]!.label} is under ${pct(gate.minMargin)}`;
  }

  // Only fall back to a pose that exists in this question; otherwise keep the top pick.
  const pose = gated && labels.includes(gate.fallback) ? gate.fallback : top.label;
  return { pose, top: top.label, pTop: top.p, margin, entropy, gated, reason, ranked };
}
