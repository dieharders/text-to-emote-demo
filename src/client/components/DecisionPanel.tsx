/** Why Clawd looks the way it does: the decision for the current line, its numbers, and the thresholds. */
import type { DecisionResult } from "../../shared/api";
import type { Decision, GateOptions } from "../../shared/decide";
import { pct, rangeFill } from "../lib/format";
import { isPoseId, poseById } from "../poses/catalog";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-raised px-2.5 py-1.5" title={hint}>
      <div className="text-[10px] tracking-wide text-muted uppercase">{label}</div>
      <div className="truncate font-mono text-sm">{value}</div>
    </div>
  );
}

function Threshold({ label, value, max, step, onChange }: { label: string; value: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-muted">
        {label} <span className="font-mono text-ivory">{pct(value)}</span>
      </span>
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={rangeFill(value, max)} className="w-full" />
    </label>
  );
}

export function DecisionPanel({
  line,
  scoredText,
  decision,
  result,
  error,
  waiting,
  gate,
  onGate,
}: {
  line: string | null;
  /** What the engine actually scored, when that is not just `line` (a short sentence's whole line). */
  scoredText?: string | null;
  decision: Decision | null;
  result: DecisionResult | undefined;
  error: string | undefined;
  waiting: boolean;
  gate: GateOptions;
  onGate(gate: GateOptions): void;
}) {
  const shown = decision && isPoseId(decision.pose) ? poseById[decision.pose] : null;
  const top = decision && isPoseId(decision.top) ? poseById[decision.top] : null;

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-sm font-medium">Decision</span>
        <span
          className="truncate text-xs text-dim"
          title={scoredText ? `A short sentence, so the engine scored its whole line: “${scoredText}”` : undefined}
        >
          {line ? `“${line}”` : "No line yet"}
          {scoredText && <span className="text-clay"> · scored with its line</span>}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 shrink-0 text-center text-3xl leading-none">{shown?.emoji ?? "🎭"}</div>
        <div className="min-w-0">
          <div className="font-medium">
            {shown ? shown.label : waiting ? "Deciding…" : error ? "No decision" : "Nothing decided yet"}
            {decision?.gated && top && <span className="ml-2 text-sm text-warn">fallback (top pick: {top.label})</span>}
          </div>
          <div className="truncate text-sm text-muted">{error ?? decision?.reason ?? "Press Play (or Analyze) to score the script."}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Metric label="P(top)" value={decision ? pct(decision.pTop, 1) : "—"} hint="Probability of the highest-scoring pose" />
        <Metric label="Margin" value={decision ? pct(decision.margin, 1) : "—"} hint="Lead of the top pose over the runner-up" />
        <Metric label="Entropy" value={decision ? decision.entropy.toFixed(2) : "—"} hint="0 = certain, 1 = every pose equally likely" />
        <Metric
          label="Engine conf."
          value={result?.nativeConfidence ? result.nativeConfidence.value.toFixed(3) : "—"}
          hint={result?.nativeConfidence ? `The engine's own confidence: ${result.nativeConfidence.label}` : undefined}
        />
        <Metric label="Latency" value={result ? `${result.latencyMs} ms` : "—"} />
        <Metric label="Model" value={result?.model ?? "—"} />
        <Metric label="Device" value={String(result?.meta?.device ?? result?.meta?.method ?? "—")} />
        <Metric label="Options" value={decision ? String(decision.ranked.length) : "—"} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1 text-sm">
        <Threshold label="Min top score" value={gate.minTop} max={0.9} step={0.05} onChange={(minTop) => onGate({ ...gate, minTop })} />
        <Threshold label="Min margin" value={gate.minMargin} max={0.5} step={0.02} onChange={(minMargin) => onGate({ ...gate, minMargin })} />
      </div>
    </div>
  );
}
