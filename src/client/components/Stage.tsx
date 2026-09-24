/** Clawd on stage: the speech bubble, the avatar on a pose-tinted backdrop, and the transport. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarCanvas } from "../avatar/AvatarCanvas";
import { SIZE } from "../avatar/grid";
import { rangeFill } from "../lib/format";
import { poseById, type PoseId } from "../poses/catalog";
import type { BabbleVoice } from "../voice/babble";
import { SpeechBubble } from "./SpeechBubble";

/** The largest WHOLE-number scale that fits the box: fractional scales smear pixel art. */
function useFitScale(min = 2, max = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      const fit = Math.floor(Math.min(width, height - 28) / SIZE); // leave room for the caption
      setScale(Math.max(min, Math.min(max, fit)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [min, max]);
  return { ref, scale };
}

export function Stage({
  pose,
  line,
  voice,
  playing,
  canPlay,
  volume,
  caption,
  onPlay,
  onStop,
  onVolume,
}: {
  pose: PoseId;
  line: string | null;
  voice: BabbleVoice;
  playing: boolean;
  canPlay: boolean;
  volume: number;
  /** Small text under Clawd: which pose is showing and why. */
  caption: string;
  onPlay(): void;
  onStop(): void;
  onVolume(volume: number): void;
}) {
  const isTalking = useCallback(() => voice.active()?.syllable ?? false, [voice]);
  const { ref, scale } = useFitScale();
  const def = poseById[pose];

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-4">
      <SpeechBubble text={line} voice={voice} />

      <div
        ref={ref}
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-line transition-colors duration-150"
        style={{ background: `radial-gradient(circle at 50% 60%, ${def.tint} 0%, var(--color-panel) 70%)` }}
      >
        <AvatarCanvas pose={pose} scale={scale} isTalking={isTalking} />
        <div className="max-w-full truncate px-4 text-sm text-muted">
          <span className="mr-1">{def.emoji}</span>
          <span className="text-ivory">{def.label}</span> · {caption}
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-3">
        {playing ? (
          <button onClick={onStop} className="w-28 rounded-lg bg-raised px-4 py-2 font-medium hover:bg-line">
            ■ Stop
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={!canPlay}
            className="w-28 rounded-lg bg-clay px-4 py-2 font-medium text-ink hover:bg-clay-dark disabled:opacity-40"
          >
            ▶ Play
          </button>
        )}
        <span className="text-xs text-dim">or press Space</span>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Volume
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} style={rangeFill(volume, 1)} />
        </label>
      </div>
    </div>
  );
}
