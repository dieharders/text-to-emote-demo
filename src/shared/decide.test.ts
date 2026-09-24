import { describe, expect, test } from "bun:test";
import { DEFAULT_GATE, decide, normalize } from "./decide";

describe("normalize", () => {
  test("rescales rounded engine output to sum 1", () => {
    const out = normalize({ a: 0.5, b: 0.3, c: 0.1999 });
    expect(Object.values(out).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 10);
  });

  test("an all-zero distribution becomes uniform instead of dividing by zero", () => {
    expect(normalize({ a: 0, b: 0 })).toEqual({ a: 0.5, b: 0.5 });
  });

  test("negative and non-finite values count as zero", () => {
    expect(normalize({ a: -1, b: Number.NaN, c: 2 })).toEqual({ a: 0, b: 0, c: 1 });
  });
});

describe("decide", () => {
  test("a confident answer passes the gate", () => {
    const d = decide({ neutral: 0.1, happy: 0.8, sad: 0.1 });
    expect(d.pose).toBe("happy");
    expect(d.top).toBe("happy");
    expect(d.gated).toBe(false);
    expect(d.margin).toBeCloseTo(0.7);
    expect(d.ranked.map((r) => r.label)).toEqual(["happy", "neutral", "sad"]);
  });

  test("a low top score falls back to neutral", () => {
    const d = decide({ neutral: 0.3, happy: 0.34, sad: 0.36 });
    expect(d.gated).toBe(true);
    expect(d.top).toBe("sad");
    expect(d.pose).toBe("neutral");
    expect(d.reason).toContain("under");
  });

  test("a narrow lead falls back to neutral", () => {
    const d = decide({ neutral: 0.1, happy: 0.46, sad: 0.44 });
    expect(d.gated).toBe(true);
    expect(d.pose).toBe("neutral");
  });

  test("the fallback is only used when the question offers it", () => {
    const d = decide({ happy: 0.34, sad: 0.33, angry: 0.33 });
    expect(d.gated).toBe(true);
    expect(d.pose).toBe("happy");
  });

  test("ties keep the question's option order", () => {
    expect(decide({ b: 0.5, a: 0.5 }, { ...DEFAULT_GATE, minMargin: 0 }).top).toBe("b");
  });

  test("entropy is 0 for certainty and 1 for a uniform spread", () => {
    expect(decide({ a: 1, b: 0 }).entropy).toBeCloseTo(0);
    expect(decide({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 }).entropy).toBeCloseTo(1);
  });

  test("an empty distribution is gated with a reason", () => {
    const d = decide({});
    expect(d.gated).toBe(true);
    expect(d.pose).toBe("neutral");
    expect(d.reason).toBe("no scores");
  });
});
