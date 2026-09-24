/**
 * The pixel canvas the avatar is drawn on: a 64×64 grid of palette codes, plus the two ways
 * to paint it (filled rectangles and "glyphs", small multi-line string sprites).
 */
import { PALETTE, type Color } from "./palette";

export const SIZE = 64;

/** One palette code (or null = transparent) per pixel, row by row. */
export type Frame = (Color | null)[];

export const createFrame = (): Frame => new Array<Color | null>(SIZE * SIZE).fill(null);

export function setPixel(frame: Frame, x: number, y: number, color: Color): void {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) frame[y * SIZE + x] = color;
}

export function rect(frame: Frame, x: number, y: number, w: number, h: number, color: Color): void {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) setPixel(frame, x + dx, y + dy, color);
}

/** A small sprite written as rows of palette codes; `.` is transparent. */
export type Glyph = readonly string[];

/** Parse a glyph from a template literal: one row per line, indentation ignored. */
export const glyph = (text: string): Glyph =>
  text
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

export const glyphWidth = (g: Glyph) => Math.max(...g.map((row) => row.length));

export function stamp(frame: Frame, g: Glyph, x: number, y: number, opts: { mirror?: boolean; color?: Color } = {}): void {
  const w = glyphWidth(g);
  g.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      const code = row[gx]!;
      if (code === ".") continue;
      const px = opts.mirror ? x + (w - 1 - gx) : x + gx;
      setPixel(frame, px, y + gy, opts.color ?? (code as Color));
    }
  });
}

/** Paint a frame onto a canvas, `scale` screen pixels per art pixel. */
export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, scale: number): void {
  ctx.clearRect(0, 0, SIZE * scale, SIZE * scale);
  for (let i = 0; i < frame.length; i++) {
    const code = frame[i];
    if (!code) continue;
    ctx.fillStyle = PALETTE[code];
    ctx.fillRect((i % SIZE) * scale, Math.floor(i / SIZE) * scale, scale, scale);
  }
}
