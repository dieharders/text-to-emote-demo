/**
 * Turn a line of text into a babble "performance": when each blip starts and stops, and its
 * pitch. Pure and seeded, so the same line always sounds the same and tests are deterministic.
 * ./babble.ts plays a plan; the avatar and speech bubble read it to stay in sync.
 */

export interface VoicePreset {
  /** Semitones above/below the base pitch. */
  pitch: number;
  /** Speed multiplier (1 = normal). */
  rate: number;
  /** How far (semitones) the pitch wanders around its center. */
  range: number;
  wave: OscillatorType;
  /** Wobble speed in Hz, for a shaky voice. */
  vibrato?: number;
}

export interface Syllable {
  /** Seconds from the start of the line. */
  start: number;
  end: number;
  freq: number;
  /** Index into `SpeechPlan.words`. */
  word: number;
}

export interface SpeechPlan {
  words: string[];
  syllables: Syllable[];
  duration: number;
}

const BASE_HZ = 330;

/** FNV-1a: a stable 32-bit hash of the line, used as its voice seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tiny seeded PRNG (mulberry32): returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rough syllable count: vowel groups (and digit groups), 1 to 4 per word. */
export function countSyllables(word: string): number {
  const vowels = word.toLowerCase().match(/[aeiouy]+/g)?.length ?? 0;
  const digits = word.match(/\d+/g)?.length ?? 0;
  return Math.min(4, Math.max(1, vowels + digits));
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function planSpeech(text: string, preset: VoicePreset, seed = hashString(text)): SpeechPlan {
  const rand = mulberry32(seed);
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const rate = preset.rate > 0 ? preset.rate : 1;
  const syllables: (Syllable & { st: number })[] = [];

  let t = 0;
  let st = 0; // the pitch's random walk, in semitones
  words.forEach((word, w) => {
    if (/[a-z0-9]/i.test(word)) {
      for (let i = countSyllables(word); i > 0; i--) {
        const len = (0.075 + rand() * 0.035) / rate;
        st = clamp(st + (rand() * 2 - 1) * 2.2, -preset.range, preset.range);
        syllables.push({ start: t, end: t + len, freq: 0, word: w, st });
        t += len + 0.028 / rate;
      }
      t += 0.045 / rate; // the gap between words
    }
    // Punctuation is silence. Trailing quotes/brackets don't hide it.
    const tail = word.replace(/["')\]]+$/, "");
    if (/[.!?…]$/.test(tail)) t += 0.28 / rate;
    else if (/[,;:]$/.test(tail) || /(—|--|-)$/.test(tail)) t += 0.16 / rate;
  });

  // Intonation: a question rises at the end; an exclamation is pitched up overall.
  const ending = trimmed.replace(/["')\]]+$/, "");
  if (ending.endsWith("?")) {
    syllables.slice(-3).forEach((s, i) => (s.st += 2 * (i + 1)));
  } else if (ending.endsWith("!")) {
    for (const s of syllables) s.st += 2;
  }

  for (const s of syllables) s.freq = BASE_HZ * 2 ** ((preset.pitch + s.st) / 12);
  const duration = syllables.length ? syllables[syllables.length - 1]!.end : 0;
  return { words, syllables: syllables.map(({ st: _st, ...s }) => s), duration };
}

/**
 * What is sounding `t` seconds into a plan: whether a syllable is (for the talk hop) and the
 * last word reached so far (for the karaoke highlight; -1 before the first word).
 */
export function activeAt(plan: SpeechPlan, t: number): { syllable: boolean; word: number } {
  let word = -1;
  let syllable = false;
  for (const s of plan.syllables) {
    if (s.start > t) break;
    word = s.word;
    syllable = t < s.end;
  }
  return { syllable, word };
}
