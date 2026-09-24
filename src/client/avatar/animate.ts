/**
 * Idle animations: stepped offsets of the whole body, no tweening (the pixel-art look).
 * Everything advances on a shared ~8 fps tick.
 */
export const TICK_MS = 125;

export type AnimId = "bob" | "hop" | "bounce" | "float" | "sway" | "sink" | "shake" | "tremble" | "jump-once" | "lean";

/** Offsets per tick, cycled. Positive dy is down. */
const CYCLES: Record<Exclude<AnimId, "jump-once">, readonly (readonly [dx: number, dy: number])[]> = {
  bob: [[0, 0], [0, 0], [0, 0], [0, -1], [0, -1], [0, -1]],
  hop: [[0, 0], [0, -1], [0, -2], [0, -1], [0, 0], [0, 0]],
  bounce: [[0, 0], [0, -3], [0, -5], [0, -3], [0, 0], [0, 1]],
  float: [[0, 0], [0, -1], [0, -1], [0, -2], [0, -2], [0, -1], [0, -1], [0, 0]],
  sway: [[0, 0], [1, 0], [1, 0], [0, 0], [-1, 0], [-1, 0]],
  sink: [[0, 0], [0, 0], [0, 1], [0, 1], [0, 1], [0, 1], [0, 0], [0, 0]],
  shake: [[-1, 0], [1, 0]],
  tremble: [[0, 0], [1, 0], [0, 0], [-1, 0]],
  lean: [[-1, 0], [-1, 0], [-1, 0], [0, 0], [1, 0], [1, 0], [1, 0], [0, 0]],
};

/** A single hop right after the pose appears, then stillness. */
const JUMP_ONCE = [[0, -4], [0, -6], [0, -5], [0, -2]] as const;

/**
 * Where the body is on this tick.
 * @param tick         global tick (shared by everything on screen)
 * @param sincePose    ticks since the current pose appeared
 */
export function animOffset(anim: AnimId, tick: number, sincePose: number): { dx: number; dy: number } {
  if (anim === "jump-once") {
    const [dx, dy] = JUMP_ONCE[sincePose] ?? [0, 0];
    return { dx, dy };
  }
  const cycle = CYCLES[anim];
  const [dx, dy] = cycle[tick % cycle.length]!;
  return { dx, dy };
}
