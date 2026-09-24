/**
 * Compose one frame of Clawd: shadow, body, eyes, then effects. Pure (a function of the pose
 * and time), which is what lets the canvas redraw only when something changed and lets tests
 * check every pose without a browser.
 */
import type { PoseId } from "../poses/catalog";
import { animOffset } from "./animate";
import { createFrame, rect, type Frame } from "./grid";
import { BODY_ORIGIN, CROUCH_DROP, drawBody } from "./parts/body";
import { drawEyes, type EyeStyle } from "./parts/eyes";
import { drawFx } from "./parts/fx";
import { RECIPES } from "./recipes";

export interface RenderOptions {
  /** Global animation tick (see TICK_MS). */
  tick: number;
  /** Ticks since this pose appeared: 0 is the one-frame crouch accent of a pose change. */
  sincePose: number;
  /** A syllable is sounding right now: hop up a pixel. */
  talking?: boolean;
}

/** Neutral's idle loop (in ticks): mostly still, a glance right, a glance left, one blink. */
function idleEyes(tick: number): { blink: boolean; look: { x: number; y: number } } {
  const t = tick % 48;
  if (t === 20) return { blink: true, look: { x: 0, y: 0 } };
  if (t >= 36 && t < 42) return { blink: false, look: { x: 2, y: -1 } };
  if (t >= 42) return { blink: false, look: { x: -2, y: -1 } };
  return { blink: false, look: { x: 0, y: 0 } };
}

export function renderPose(pose: PoseId, opts: RenderOptions): Frame {
  const recipe = RECIPES[pose];
  const frame = createFrame();

  const accent = opts.sincePose === 0;
  const crouch = Boolean(recipe.crouch) || accent;
  const { dx, dy } = accent ? { dx: 0, dy: 0 } : animOffset(recipe.anim, opts.tick, opts.sincePose);
  const x = BODY_ORIGIN.x + dx;
  const y = BODY_ORIGIN.y + dy + (crouch ? CROUCH_DROP : 0) + (opts.talking ? -1 : 0);

  rect(frame, BODY_ORIGIN.x + 6, 61, 32, 2, "N"); // shadow stays on the floor

  drawBody(frame, x, y, { arms: recipe.arms, crouch, color: recipe.body });

  let eyes: EyeStyle | readonly [EyeStyle, EyeStyle] = recipe.eyes;
  let look = recipe.look;
  if (recipe.idle) {
    const idle = idleEyes(opts.tick);
    if (idle.blink) eyes = "blink";
    look = idle.look;
  }
  drawEyes(frame, x, y, eyes, look);

  for (const fx of recipe.fx) drawFx(frame, fx, x, y, opts.tick);
  if (accent) drawFx(frame, "dust", x, y, opts.tick);

  return frame;
}
