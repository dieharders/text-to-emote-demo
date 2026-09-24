/**
 * Eye styles. Clawd has no mouth (on-model), so the eyes carry most of the expression.
 *
 * Each glyph is drawn centered on the official eye position (a 4×4 box at body (8,8) and
 * (32,8)). Asymmetric styles are drawn as the LEFT eye and mirrored for the right.
 */
import { glyph, glyphWidth, stamp, type Frame, type Glyph } from "../grid";

export type EyeStyle = "open" | "blink" | "happy" | "star" | "heart" | "wide" | "tiny" | "sad" | "angry" | "squint";

const EYES: Record<EyeStyle, Glyph> = {
  open: glyph(`
    KKKK
    KKKK
    KKKK
    KKKK`),
  blink: glyph(`
    KKKK`),
  happy: glyph(`
    ..KK..
    .K..K.
    K....K`),
  star: glyph(`
    ..K..
    .KKK.
    KKKKK
    .KKK.
    .K.K.`),
  heart: glyph(`
    RR.RR
    RRRRR
    RRRRR
    .RRR.
    ..R..`),
  wide: glyph(`
    .WWWW.
    WWWWWW
    WWKKWW
    WWKKWW
    WWWWWW
    .WWWW.`),
  tiny: glyph(`
    .WWWW.
    WWWWWW
    WWWKWW
    WWWWWW
    WWWWWW
    .WWWW.`),
  // Droopy: the OUTER top corner is cut, so the brow line falls away from the middle.
  sad: glyph(`
    ..KK
    .KKK
    KKKK
    KKKK`),
  // Scowl: the INNER top corner is cut, so the brow line slants down toward the middle.
  angry: glyph(`
    KK..
    KKK.
    KKKK
    KKKK`),
  squint: glyph(`
    KKKK`),
};

/** Centers of the two eye boxes, relative to the body's top-left. */
const EYE_CENTERS = [
  { x: 10, y: 10 },
  { x: 34, y: 10 },
] as const;

export function drawEyes(
  frame: Frame,
  bodyX: number,
  bodyY: number,
  style: EyeStyle | readonly [EyeStyle, EyeStyle],
  look: { x: number; y: number } = { x: 0, y: 0 },
): void {
  const [left, right] = typeof style === "string" ? [style, style] : style;
  [left, right].forEach((eye, side) => {
    const g = EYES[eye];
    const center = EYE_CENTERS[side]!;
    const x = bodyX + center.x + look.x - Math.floor(glyphWidth(g) / 2);
    const y = bodyY + center.y + look.y - Math.floor(g.length / 2);
    stamp(frame, g, x, y, { mirror: side === 1 });
  });
}
