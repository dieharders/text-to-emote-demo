export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export const formatBytes = (n: number) =>
  n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : n >= 1 << 20 ? `${Math.round(n / (1 << 20))} MB` : `${Math.round(n / 1024)} KB`;
