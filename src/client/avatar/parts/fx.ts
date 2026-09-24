/**
 * Anime/emoji marks drawn around (or on) the body: the anger vein, sweat drops, tears, "!"…
 *
 * Each effect is a function of the body's position and the animation tick, so it can move with
 * the body and animate by itself. To add one: add a case here and use its id in a recipe.
 */
import { glyph, rect, stamp, type Frame } from "../grid";

export type FxId =
  | "vein"
  | "steam"
  | "sweat"
  | "tears"
  | "blush"
  | "gloom"
  | "sparkles"
  | "twinkle"
  | "exclaim"
  | "exclaim2"
  | "question"
  | "hearts"
  | "thought"
  | "action"
  | "shiver"
  | "dust";

const VEIN = glyph(`
  .RR.RR.
  R.R.R.R
  RR...RR
  .......
  RR...RR
  R.R.R.R
  .RR.RR.`);

const PUFF = glyph(`
  .GG.
  GGGG
  .GG.`);

const DROP = glyph(`
  ..B..
  .BBB.
  BBWBB
  BBBBB
  .BBB.`);

const SPARKLE_BIG = glyph(`
  ..Y..
  ..Y..
  YYYYY
  ..Y..
  ..Y..`);

const SPARKLE_SMALL = glyph(`
  .Y.
  YYY
  .Y.`);

const BANG = glyph(`
  RRR
  RRR
  RRR
  RRR
  RRR
  .R.
  ...
  RRR
  RRR`);

const QUESTION = glyph(`
  .WWWWW.
  WW...WW
  .....WW
  ....WW.
  ...WW..
  ...WW..
  .......
  ...WW..
  ...WW..`);

const HEART = glyph(`
  RR.RR
  RRRRR
  .RRR.
  ..R..`);

const BUBBLE = glyph(`
  ..WWWWWWWWW..
  .WWWWWWWWWWW.
  WWWWWWWWWWWWW
  WWWWWWWWWWWWW
  WWWWWWWWWWWWW
  .WWWWWWWWWWW.
  ..WWWWWWWWW..`);

/** Draw one effect. (x, y) is the body's top-left; `tick` advances ~8 times a second. */
export function drawFx(frame: Frame, fx: FxId, x: number, y: number, tick: number): void {
  switch (fx) {
    case "vein": {
      // Pulses: shown for three ticks out of four.
      if (tick % 4 !== 3) stamp(frame, VEIN, x + 33, y - 11);
      break;
    }
    case "steam": {
      const rise = tick % 3;
      stamp(frame, PUFF, x - 7, y - 3 - rise * 2);
      stamp(frame, PUFF, x + 47, y - 3 - ((rise + 1) % 3) * 2);
      break;
    }
    case "sweat": {
      stamp(frame, DROP, x + 38, y - 3 + (tick % 4));
      break;
    }
    case "tears": {
      // Streams run from under each eye; their length pulses like a drip.
      const len = 6 + (tick % 3) * 3;
      rect(frame, x + 8, y + 12, 2, len, "B");
      rect(frame, x + 34, y + 12, 2, len, "B");
      break;
    }
    case "blush": {
      rect(frame, x + 5, y + 14, 5, 2, "P");
      rect(frame, x + 34, y + 14, 5, 2, "P");
      break;
    }
    case "gloom": {
      // The anime "dread" lines, hanging from the top of the face.
      [8, 13, 18, 23, 28, 33].forEach((lx, i) => rect(frame, x + lx, y, 1, 3 + ((i + tick) % 3), "L"));
      break;
    }
    case "sparkles":
    case "twinkle": {
      const spots = fx === "sparkles" ? [[-9, -12], [48, -9], [21, -19]] : [[46, -8]];
      spots.forEach(([sx, sy], i) => {
        const big = (tick + i) % 4 < 2;
        stamp(frame, big ? SPARKLE_BIG : SPARKLE_SMALL, x + sx! + (big ? 0 : 1), y + sy! + (big ? 0 : 1));
      });
      break;
    }
    case "exclaim": {
      stamp(frame, BANG, x + 20, y - 21 + (tick % 2));
      break;
    }
    case "exclaim2": {
      stamp(frame, BANG, x + 16, y - 21 + (tick % 2), { color: "Y" });
      stamp(frame, BANG, x + 22, y - 21 + ((tick + 1) % 2), { color: "Y" });
      break;
    }
    case "question": {
      stamp(frame, QUESTION, x + 30, y - 22 + (tick % 4 < 2 ? 0 : 1));
      break;
    }
    case "hearts": {
      // Three hearts drifting up and fading out at the top, staggered.
      [0, 5, 10].forEach((offset, i) => {
        const rise = (tick + offset) % 15;
        const hx = [2, 37, 20][i]!;
        stamp(frame, HEART, x + hx, y - 4 - rise, { color: rise > 9 ? "P" : "R" });
      });
      break;
    }
    case "thought": {
      stamp(frame, BUBBLE, x + 37, y - 22);
      rect(frame, x + 34, y - 11, 3, 3, "W");
      rect(frame, x + 32, y - 6, 2, 2, "W");
      // The dots appear one by one: "." ".." "..." then clear.
      const dots = tick % 4;
      for (let i = 0; i < dots; i++) rect(frame, x + 40 + i * 3, y - 19, 2, 2, "K");
      break;
    }
    case "action": {
      if (tick % 2 === 0) {
        for (const [ax, ay, dx, dy] of [[-6, -6, 1, 1], [49, -6, -1, 1], [-6, 26, 1, -1], [49, 26, -1, -1]] as const) {
          for (let i = 0; i < 3; i++) rect(frame, x + ax + dx * i, y + ay + dy * i, 1, 1, "W");
        }
      }
      break;
    }
    case "shiver": {
      const side = tick % 2 ? 1 : 0;
      rect(frame, x - 4 - side, y + 6, 1, 4, "G");
      rect(frame, x - 6 - side, y + 12, 1, 4, "G");
      rect(frame, x + 47 + side, y + 6, 1, 4, "G");
      rect(frame, x + 49 + side, y + 12, 1, 4, "G");
      break;
    }
    case "dust": {
      // The official crouch's "poof", beside the feet.
      for (const [dx, dy] of [[-4, 29], [-7, 27], [47, 29], [50, 27]] as const) rect(frame, x + dx, y + dy, 2, 1, "G");
      break;
    }
  }
}
