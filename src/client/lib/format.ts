import type { CSSProperties } from "react";

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

/** Inline style for a range input's filled track (see input[type="range"] in styles.css). */
export const rangeFill = (value: number, max: number) => ({ "--fill": pct(max > 0 ? value / max : 0, 2) }) as CSSProperties;

export const formatBytes = (n: number) =>
  n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : n >= 1 << 20 ? `${Math.round(n / (1 << 20))} MB` : `${Math.round(n / 1024)} KB`;
