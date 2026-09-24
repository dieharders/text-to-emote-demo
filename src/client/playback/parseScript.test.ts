import { expect, test } from "bun:test";
import { parseScript, scoringText } from "./parseScript";

test("splits on newlines, trims, and skips blank lines", () => {
  expect(parseScript("  Hello!\r\n\n   \nBye.  \n")).toEqual([
    { index: 0, text: "Hello!", source: "Hello!" },
    { index: 1, text: "Bye.", source: "Bye." },
  ]);
});

test("splits a line into sentences", () => {
  const line = "It is 3.5 km away. Really?! Yes… \"Go home.\" she said.";
  expect(parseScript(line)).toEqual([
    { index: 0, text: "It is 3.5 km away.", source: line },
    { index: 1, text: "Really?!", source: line },
    { index: 2, text: "Yes… \"Go home.\" she said.", source: line },
  ]);
});

test("keeps a title with the name that follows it", () => {
  expect(parseScript("Mr. Smith met Dr. Who. They left.\nBye")).toEqual([
    { index: 0, text: "Mr. Smith met Dr. Who.", source: "Mr. Smith met Dr. Who. They left." },
    { index: 1, text: "They left.", source: "Mr. Smith met Dr. Who. They left." },
    { index: 2, text: "Bye", source: "Bye" },
  ]);
});

test("an empty script has no lines", () => {
  expect(parseScript("")).toEqual([]);
});

test("a short sentence is scored with its whole line, a long one on its own", () => {
  const [short, long] = parseScript("Oh no. I'm so sorry, that's really disappointing news.");
  expect(scoringText(short!)).toBe("Oh no. I'm so sorry, that's really disappointing news.");
  expect(scoringText(long!)).toBe("I'm so sorry, that's really disappointing news.");
});

test("short means four words or fewer, and punctuation is not a word", () => {
  const [four, five, dashed] = parseScript("All the tests pass! They really do pass today. Wait — what now?");
  expect(scoringText(four!)).toBe(four!.source);
  expect(scoringText(five!)).toBe("They really do pass today.");
  expect(scoringText(dashed!)).toBe(dashed!.source);
});

test("the rule never reaches across a line break", () => {
  const [short] = parseScript("We did it!\nThe meeting starts at three o'clock.");
  expect(scoringText(short!)).toBe("We did it!");
});
