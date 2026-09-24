/**
 * Clawd on a canvas. Redraws only when the frame would change (a new tick, pose, or talk
 * state), so ten of these on screen cost next to nothing.
 */
import { useEffect, useRef } from "react";
import type { PoseId } from "../poses/catalog";
import { TICK_MS } from "./animate";
import { SIZE, drawFrame } from "./grid";
import { renderPose } from "./render";

export function AvatarCanvas({
  pose,
  scale,
  animate = true,
  isTalking,
  className,
}: {
  pose: PoseId;
  /** Screen pixels per art pixel. */
  scale: number;
  /** false: draw one still frame (thumbnails). */
  animate?: boolean;
  /** Read every frame, so talking follows the audio clock rather than React renders. */
  isTalking?: () => boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef({ pose, since: performance.now() });
  const talkingRef = useRef(isTalking);

  useEffect(() => {
    talkingRef.current = isTalking;
  }, [isTalking]);

  useEffect(() => {
    if (poseRef.current.pose !== pose) poseRef.current = { pose, since: performance.now() };
  }, [pose]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (!animate) {
      drawFrame(ctx, renderPose(pose, { tick: 0, sincePose: 99 }), scale);
      return;
    }

    let raf = 0;
    let lastKey = "";
    const loop = (now: number) => {
      const current = poseRef.current;
      const tick = Math.floor(now / TICK_MS);
      const sincePose = Math.min(99, Math.floor((now - current.since) / TICK_MS));
      const talking = talkingRef.current?.() ?? false;
      const key = `${current.pose}|${tick}|${Math.min(sincePose, 8)}|${talking}`;
      if (key !== lastKey) {
        lastKey = key;
        drawFrame(ctx, renderPose(current.pose, { tick, sincePose, talking }), scale);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, scale, pose]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE * scale}
      height={SIZE * scale}
      className={`pixelated ${className ?? ""}`}
      aria-label={`Clawd, ${pose}`}
      role="img"
    />
  );
}
