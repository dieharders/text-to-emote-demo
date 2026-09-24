export interface ScriptLine {
  index: number;
  text: string;
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
    .flatMap(splitSentences)
    .map((line, index) => ({ index, text: line }));
}
