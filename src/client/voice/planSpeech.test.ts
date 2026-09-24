import { describe, expect, test } from "bun:test";
import { activeAt, countSyllables, planSpeech, type VoicePreset } from "./planSpeech";

const voice: VoicePreset = { pitch: 0, rate: 1, range: 3, wave: "square" };

describe("planSpeech", () => {
  test("is deterministic for the same line", () => {
    expect(planSpeech("Hello there, friend!", voice)).toEqual(planSpeech("Hello there, friend!", voice));
  });

  test("different lines sound different", () => {
    const a = planSpeech("Hello there", voice).syllables.map((s) => s.freq);
    const b = planSpeech("Goodbye now", voice).syllables.map((s) => s.freq);
    expect(a).not.toEqual(b);
  });

  test("syllables are in order and never overlap", () => {
    const { syllables, duration } = planSpeech("The quick brown fox jumps over the lazy dog.", voice);
    for (let i = 1; i < syllables.length; i++) expect(syllables[i]!.start).toBeGreaterThanOrEqual(syllables[i - 1]!.end);
    expect(duration).toBe(syllables[syllables.length - 1]!.end);
  });

  test("punctuation adds a pause", () => {
    const plain = planSpeech("one two", voice, 1);
    const comma = planSpeech("one, two", voice, 1);
    const gap = (p: typeof plain) => p.syllables.find((s) => s.word === 1)!.start - p.syllables[0]!.end;
    expect(gap(comma)).toBeGreaterThan(gap(plain) + 0.1);
  });

  test("a question rises at the end", () => {
    const q = planSpeech("are you coming along", voice, 7);
    const qq = planSpeech("are you coming along?", voice, 7);
    const last = (p: typeof q) => p.syllables[p.syllables.length - 1]!.freq;
    expect(last(qq)).toBeGreaterThan(last(q));
  });

  test("a faster rate is shorter; a higher pitch is higher", () => {
    const base = planSpeech("a line of speech", voice, 3);
    expect(planSpeech("a line of speech", { ...voice, rate: 2 }, 3).duration).toBeLessThan(base.duration);
    expect(planSpeech("a line of speech", { ...voice, pitch: 12 }, 3).syllables[0]!.freq).toBeCloseTo(base.syllables[0]!.freq * 2);
  });

  test("an empty line is silent", () => {
    expect(planSpeech("   ", voice)).toEqual({ words: [], syllables: [], duration: 0 });
  });
});

describe("countSyllables", () => {
  test("counts vowel groups, clamped to 1..4", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("happy")).toBe(2);
    expect(countSyllables("hmm")).toBe(1);
    expect(countSyllables("unbelievably")).toBe(4);
  });
});

describe("activeAt", () => {
  const plan = planSpeech("hi there", voice, 5);

  test("nothing before the first syllable", () => {
    expect(activeAt(plan, -0.1)).toEqual({ syllable: false, word: -1 });
  });

  test("tracks the syllable and word being spoken", () => {
    const s = plan.syllables[plan.syllables.length - 1]!;
    expect(activeAt(plan, (s.start + s.end) / 2)).toEqual({ syllable: true, word: 1 });
  });

  test("keeps the last word highlighted after it ends", () => {
    expect(activeAt(plan, plan.duration + 1)).toEqual({ syllable: false, word: 1 });
  });
});
