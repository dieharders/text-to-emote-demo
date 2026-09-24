/**
 * Clawd's body, from the official 11×8 onboarding art (Claude Code's `clawd.svg`) at 4×:
 *
 *     .OOOOOOOOO.      torso: cells 1–9, rows 0–5   → 36×24 px
 *     .OOOOOOOOO.
 *     OOKOOOOOKOO      arms: cells 0 and 10, rows 2–3 → 4×8 px each
 *     OOOOOOOOOOO      eyes: cells 2 and 8, row 2     → 4×4 px each (see ./eyes.ts)
 *     .OOOOOOOOO.
 *     .OOOOOOOOO.
 *     .O.O...O.O.      legs: cells 1, 3, 7, 9, rows 6–7 → 4×8 px each
 *     .O.O...O.O.
 *
 * Coordinates are relative to the body's top-left corner (the 44×32 box, arms included).
 */
import type { Color } from "../palette";
import { rect, type Frame } from "../grid";

export type Arms =
  /** Official: straight out at the sides. */
  | "out"
  /** Official "arms-up": the same stubs, raised one row. */
  | "raised"
  /** Both arms straight up beside the head. */
  | "up"
  /** Hanging low. */
  | "down"
  /** Pulled in: no arms showing. */
  | "tucked"
  /** Right hand on top of the head (scratching it). */
  | "head"
  /** Right arm across the body to the "chin". */
  | "chin";

export interface BodyStyle {
  arms: Arms;
  /** Squashed down onto short legs (the official crouch). */
  crouch?: boolean;
  color?: Color;
}

/** Where the body box sits on the 64×64 canvas when standing still. */
export const BODY_ORIGIN = { x: 10, y: 28 } as const;

/** How far the torso drops when crouching. */
export const CROUCH_DROP = 4;

export function drawBody(frame: Frame, x: number, y: number, style: BodyStyle): void {
  const c = style.color ?? "O";
  const legH = style.crouch ? 8 - CROUCH_DROP : 8;

  rect(frame, x + 4, y, 36, 24, c); // torso
  for (const lx of [4, 12, 28, 36]) rect(frame, x + lx, y + 24, 4, legH, c); // legs

  switch (style.arms) {
    case "out":
      rect(frame, x, y + 8, 4, 8, c);
      rect(frame, x + 40, y + 8, 4, 8, c);
      break;
    case "raised":
      rect(frame, x, y + 2, 4, 8, c);
      rect(frame, x + 40, y + 2, 4, 8, c);
      break;
    case "up":
      rect(frame, x, y - 8, 4, 16, c);
      rect(frame, x + 40, y - 8, 4, 16, c);
      break;
    case "down":
      rect(frame, x, y + 15, 4, 8, c);
      rect(frame, x + 40, y + 15, 4, 8, c);
      break;
    case "tucked":
      break;
    case "head":
      rect(frame, x, y + 8, 4, 8, c);
      rect(frame, x + 40, y - 6, 4, 14, c); // up the side…
      rect(frame, x + 32, y - 6, 8, 4, c); // …and over the top of the head
      break;
    case "chin":
      rect(frame, x, y + 8, 4, 8, c);
      rect(frame, x + 40, y + 12, 4, 8, c); // shoulder stub
      rect(frame, x + 22, y + 17, 20, 4, "D"); // forearm across the front
      rect(frame, x + 22, y + 13, 4, 4, "D"); // hand at the chin
      break;
  }
}
