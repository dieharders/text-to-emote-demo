/**
 * Score labeled lines with a decision engine and report how often it agrees. Use it to compare
 * engines, to tune the pose descriptions in src/client/poses/catalog.ts, and to re-check the
 * short-sentence rule (`scoringText`) after changing either.
 *
 *   bun run eval                   the default engine (Von; run its setup from the app first)
 *   EB_ENGINE=mock bun run eval    any registered engine
 */
import { parseScript, scoringText, SHORT_SENTENCE_WORDS, type ScriptLine } from "../src/client/playback/parseScript";
import { buildPoseQuestion, POSES } from "../src/client/poses/catalog";
import { LABELED_LINES, SAMPLE_LINES } from "../src/client/poses/samples";
import { createEngine } from "../src/engines";
import { DEFAULT_GATE, decide } from "../src/shared/decide";

process.env.EB_DATA_ROOT ||= ".dev-data";

const engine = await createEngine();
const { name, version, status } = engine.info();
console.log(`\nEngine: ${name} ${version}`);

if (status.state === "needs-setup" || status.state === "unsupported") {
  console.error(
    status.state === "unsupported"
      ? `  Cannot run here: ${status.reason}`
      : "  Not installed yet. Start the app (`bun run app`, or `EB_ENGINE=von bun run dev`) and press Set up.",
  );
  process.exit(1);
}

engine.onEvent((e) => {
  if (e.type === "status" && e.status.state === "starting") console.log(`  ${e.status.step ?? "starting…"}`);
});
await engine.start();
const ready = engine.info().status;
if (ready.state !== "ready") {
  console.error(`  Did not start: ${ready.state === "error" ? ready.message : ready.state}`);
  process.exit(1);
}
console.log(`  ready on ${ready.device ?? "?"}\n`);

const question = buildPoseQuestion();
const labels: string[] = POSES.map((p) => p.id);
const confusion = new Map(labels.map((l) => [l, new Map(labels.map((m) => [m, 0]))]));
let correct = 0;
let gated = 0;
const latencies: number[] = [];

for (const { text, pose } of LABELED_LINES) {
  const result = await engine.decide({ text, question });
  const d = decide(result.distribution, DEFAULT_GATE);
  const hit = d.top === pose;
  if (hit) correct++;
  if (d.gated) gated++;
  latencies.push(result.latencyMs);
  confusion.get(pose)!.set(d.top, confusion.get(pose)!.get(d.top)! + 1);
  const mark = hit ? "✓" : "✗";
  console.log(`${mark} ${pose.padEnd(9)} → ${d.top.padEnd(9)} ${(d.pTop * 100).toFixed(0).padStart(3)}%  ${String(result.latencyMs).padStart(5)} ms  ${text}`);
}

const n = LABELED_LINES.length;
latencies.sort((a, b) => a - b);
console.log(`\nAccuracy ${correct}/${n} (${((correct / n) * 100).toFixed(1)}%) · gated to neutral: ${gated}/${n}`);
console.log(`Latency median ${latencies[Math.floor(n / 2)]} ms · p90 ${latencies[Math.floor(n * 0.9)]} ms\n`);

// Rows: the expected pose. Columns: what the engine picked.
const short = (l: string) => l.slice(0, 5).padStart(5);
console.log(`${"".padEnd(10)}${labels.map(short).join(" ")}`);
for (const expected of labels) {
  const row = labels.map((got) => String(confusion.get(expected)!.get(got) || ".").padStart(5)).join(" ");
  console.log(`${expected.padEnd(10)}${row}`);
}

// The sample script the way the app reads it: sentence by sentence, each labeled with its line's
// pose. Compares the app's scoring (short sentences use their whole line) with scoring every
// sentence on its own. The labels favour the line rule (every sentence here shares its line's
// emotion), so read this as "does the rule still help", not as general accuracy.
const sentences = SAMPLE_LINES.flatMap(({ text, pose }) => parseScript(text).map((line) => ({ line, pose })));
const tally = async (textOf: (line: ScriptLine) => string) => {
  let hits = 0;
  for (const { line, pose } of sentences) {
    const result = await engine.decide({ text: textOf(line), question });
    if (decide(result.distribution, DEFAULT_GATE).top === pose) hits++;
  }
  return hits;
};
const asRead = await tally(scoringText);
const alone = await tally((line) => line.text);
console.log(`\nSample script, read by sentence (${sentences.length} sentences):`);
console.log(`  as the app scores it (≤${SHORT_SENTENCE_WORDS} words → whole line): ${asRead}/${sentences.length}`);
console.log(`  each sentence on its own:                ${alone}/${sentences.length}`);

await engine.stop();
process.exit(0);
