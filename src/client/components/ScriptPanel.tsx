/**
 * The script: edit it as text, or see it as lines with each line's decided pose. While Clawd
 * reads, the list follows along and highlights the current line.
 */
import { useEffect, useRef } from "react";
import type { Decision } from "../../shared/decide";
import { pct } from "../lib/format";
import { isPoseId, poseById } from "../poses/catalog";
import type { ScriptLine } from "../playback/parseScript";
import type { LineDecision } from "../playback/usePlayback";

export type ScriptView = "edit" | "lines";

export function ScriptPanel({
  script,
  lines,
  view,
  current,
  playing,
  decisions,
  judge,
  onScript,
  onView,
  onAnalyze,
}: {
  script: string;
  lines: ScriptLine[];
  view: ScriptView;
  current: number;
  playing: boolean;
  decisions: Record<string, LineDecision>;
  /** Applies the decision rule (current thresholds) to a line's result. */
  judge: (text: string) => Decision | null;
  onScript(script: string): void;
  onView(view: ScriptView): void;
  onAnalyze(): void;
}) {
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  const tab = (v: ScriptView, label: string) => (
    <button
      onClick={() => onView(v)}
      disabled={playing && v === "edit"}
      className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-raised text-ivory" : "text-muted hover:text-ivory"} disabled:opacity-40`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-panel">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <span className="mr-2 text-sm font-medium">Script</span>
        {tab("edit", "Edit")}
        {tab("lines", `Lines (${lines.length})`)}
        <button
          onClick={onAnalyze}
          disabled={lines.length === 0}
          className="ml-auto rounded-md px-3 py-1 text-sm text-muted hover:bg-raised hover:text-ivory disabled:opacity-40"
          title="Score every line now, without reading"
        >
          Analyze
        </button>
      </div>

      {view === "edit" ? (
        <textarea
          value={script}
          onChange={(e) => onScript(e.target.value)}
          spellCheck={false}
          placeholder="One line per step. Clawd reads them in order."
          className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-7 outline-none placeholder:text-dim"
        />
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {lines.map((line) => {
            const isCurrent = line.index === current;
            const decided = decisions[line.text];
            const verdict = judge(line.text);
            const pose = verdict && isPoseId(verdict.pose) ? poseById[verdict.pose] : null;
            return (
              <li
                key={line.index}
                ref={isCurrent ? currentRef : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isCurrent ? "bg-raised ring-1 ring-clay" : ""
                }`}
              >
                <span className={`w-4 shrink-0 text-center text-xs ${isCurrent ? "text-clay" : "text-dim"}`}>
                  {isCurrent ? "▶" : line.index + 1}
                </span>
                <span className={`min-w-0 flex-1 ${isCurrent ? "text-ivory" : "text-muted"}`}>{line.text}</span>
                <span className="shrink-0 text-right font-mono text-xs">
                  {pose && verdict ? (
                    <span className={verdict.gated ? "text-dim" : "text-ivory"} title={verdict.reason}>
                      {pose.emoji} {pose.label} {pct(verdict.pTop)}
                    </span>
                  ) : decided?.error ? (
                    <span className="text-bad" title={decided.error}>
                      no score
                    </span>
                  ) : (
                    <span className="text-dim">·</span>
                  )}
                </span>
              </li>
            );
          })}
          {lines.length === 0 && <li className="px-3 py-2 text-sm text-dim">The script is empty.</li>}
        </ol>
      )}
    </div>
  );
}
