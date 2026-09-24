/** Every pose Clawd can take, with this line's score for each. Hover to preview a pose. */
import { AvatarCanvas } from "../avatar/AvatarCanvas";
import type { Decision } from "../../shared/decide";
import { pct } from "../lib/format";
import { POSES, type PoseId } from "../poses/catalog";

export function PosePalette({ decision, onPreview }: { decision: Decision | null; onPreview(pose: PoseId | null): void }) {
  const scores = new Map(decision?.ranked.map((r) => [r.label, r.p]) ?? []);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-sm font-medium">Poses</span>
        <span className="truncate text-xs text-dim">what the engine scored · hover to preview</span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {POSES.map((pose) => {
          const p = scores.get(pose.id);
          const chosen = decision?.pose === pose.id;
          return (
            <button
              key={pose.id}
              onMouseEnter={() => onPreview(pose.id)}
              onMouseLeave={() => onPreview(null)}
              className={`flex flex-col items-center rounded-xl border px-1 pt-1 pb-2 text-xs transition-colors ${
                chosen ? "border-clay bg-raised" : "border-transparent hover:border-line"
              }`}
            >
              <AvatarCanvas pose={pose.id} scale={1} animate={false} className="h-16 w-16" />
              <span className={chosen ? "text-ivory" : "text-muted"}>
                {pose.emoji} {pose.label}
              </span>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-raised">
                <div className={`h-full rounded-full ${chosen ? "bg-clay" : "bg-dim"}`} style={{ width: pct(p ?? 0) }} />
              </div>
              <span className="mt-0.5 font-mono text-[11px] text-dim">{p === undefined ? "—" : pct(p)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
