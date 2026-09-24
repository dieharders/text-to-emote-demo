/**
 * How each pose looks, as data: body, eyes, effects and idle animation.
 * Paired with ../poses/catalog.ts (what the pose MEANS); this file is only what it LOOKS like.
 */
import type { PoseId } from "../poses/catalog";
import type { Color } from "./palette";
import type { AnimId } from "./animate";
import type { Arms } from "./parts/body";
import type { EyeStyle } from "./parts/eyes";
import type { FxId } from "./parts/fx";

export interface PoseRecipe {
  arms: Arms;
  crouch?: boolean;
  body?: Color;
  eyes: EyeStyle | readonly [EyeStyle, EyeStyle];
  /** Shift both eyes (looking somewhere). */
  look?: { x: number; y: number };
  fx: FxId[];
  anim: AnimId;
  /** Neutral's idle life: blinks and glances left and right like the Claude Code banner. */
  idle?: boolean;
}

export const RECIPES: Record<PoseId, PoseRecipe> = {
  neutral: { arms: "out", eyes: "open", fx: [], anim: "bob", idle: true },
  happy: { arms: "raised", eyes: "happy", fx: ["blush", "twinkle"], anim: "hop" },
  excited: { arms: "up", eyes: "star", fx: ["sparkles", "exclaim2"], anim: "bounce" },
  love: { arms: "tucked", eyes: "heart", fx: ["hearts", "blush"], anim: "float" },
  sad: { arms: "down", crouch: true, eyes: "sad", fx: ["tears", "gloom"], anim: "sink" },
  angry: { arms: "up", body: "A", eyes: "angry", fx: ["vein", "steam"], anim: "shake" },
  surprised: { arms: "up", eyes: "wide", fx: ["exclaim", "action"], anim: "jump-once" },
  scared: { arms: "tucked", crouch: true, body: "S", eyes: "tiny", fx: ["sweat", "gloom", "shiver"], anim: "tremble" },
  confused: { arms: "head", eyes: ["open", "squint"], fx: ["question"], anim: "lean" },
  thinking: { arms: "chin", eyes: "open", look: { x: 2, y: -3 }, fx: ["thought"], anim: "sway" },
};
