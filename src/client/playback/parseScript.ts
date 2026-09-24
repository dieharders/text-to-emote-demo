export interface ScriptLine {
  index: number;
  /** The sentence Clawd reads. */
  text: string;
  /** The script line it came from (a line break always starts a new one). */
  source: string;
}

// The Unicode sentence rules already cope with decimals, ellipses and quotes.
const sentences = new Intl.Segmenter(undefined, { granularity: "sentence" });

// ...but they break after a title ("Mr." | "Smith said"). A segment ending in one of these is
// joined to the next. "etc." is left out on purpose: it usually does end a sentence.
const TITLE = /\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|St|Mt|Jr|Sr|Capt|Col|Gen|Lt|Sgt|Rev|vs)\.$/i;

function splitSentences(line: string): string[] {
  const out: string[] = [];
  let pending = "";
  for (const { segment } of sentences.segment(line)) {
    pending += segment;
    if (!TITLE.test(pending.trimEnd())) {
      out.push(pending.trim());
      pending = "";
    }
  }
  if (pending.trim()) out.push(pending.trim());
  return out.filter(Boolean);
}

/** One sentence of the script per reading step. A line break always starts a new step. */
export function parseScript(text: string): ScriptLine[] {
  return text
    .split(/\r?\n/)
    .flatMap((source) => splitSentences(source).map((sentence) => ({ text: sentence, source: source.trim() })))
    .map((line, index) => ({ index, ...line }));
}

/** Sentences of this many words or fewer are scored with their whole line (see `scoringText`). */
export const SHORT_SENTENCE_WORDS = 4;

/** Words, not tokens: a dash or a lone "…" is not a word. */
const wordCount = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/**
 * The text the decision engine scores for a sentence: the sentence itself, or, when it is too
 * short to carry an emotion on its own ("Oh no.", "We did it!"), the whole line it came from.
 *
 * WHY THIS AND NOT THE NEIGHBOURING SENTENCES: measured with Von, sending the sentences before
 * and after as context made it worse. Von does not keep to the sentence it is asked about, even
 * when that sentence is marked, so the neighbours' emotions bleed into the answer. This rule never
 * reaches across a line break, and a line tends to be one emotional beat: on the sample script
 * read by sentence it took Von from 12 to 15 correct out of 20, and it changed nothing on lines
 * whose emotion turns mid-line (10/16 either way). `bun run eval` re-checks it.
 */
export function scoringText(line: ScriptLine): string {
  return wordCount(line.text) <= SHORT_SENTENCE_WORDS ? line.source : line.text;
}
