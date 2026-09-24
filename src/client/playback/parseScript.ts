export interface ScriptLine {
  index: number;
  text: string;
}

/** One non-empty line of the script per reading step. */
export function parseScript(text: string): ScriptLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ index, text: line }));
}
