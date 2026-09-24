/**
 * Every color the avatar uses, by the one-letter code the sprite grids are written in.
 * `.` in a grid is transparent. O and K are Clawd's official colors.
 */
export const PALETTE = {
  O: "#d97757", // Clawd's body (official)
  A: "#e2604a", // body, flushed red (angry)
  S: "#e8a58c", // body, drained pale (scared)
  D: "#b3593c", // darker orange: an arm in front of the body
  K: "#000000", // eyes (official)
  W: "#faf9f5", // white: eye whites, ?, thought bubble
  R: "#ef4d52", // red: anger vein, hearts, !
  P: "#f59bb5", // pink: blush, small hearts
  B: "#62b4ff", // blue: tears, sweat
  L: "#8b96ff", // lavender: gloom lines
  Y: "#f7c948", // yellow: stars, sparkles, !!
  G: "#8f8b83", // grey: steam, dust, shiver lines
  N: "#00000055", // shadow
} as const;

export type Color = keyof typeof PALETTE;
