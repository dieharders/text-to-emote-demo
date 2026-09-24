import { expect, test } from "bun:test";
import { parseScript } from "./parseScript";

test("splits on newlines, trims, and skips blank lines", () => {
  expect(parseScript("  Hello!\r\n\n   \nBye.  \n")).toEqual([
    { index: 0, text: "Hello!" },
    { index: 1, text: "Bye." },
  ]);
});

test("splits a line into sentences", () => {
  expect(parseScript("It is 3.5 km away. Really?! Yes… \"Go home.\" she said.")).toEqual([
    { index: 0, text: "It is 3.5 km away." },
    { index: 1, text: "Really?!" },
    { index: 2, text: "Yes… \"Go home.\" she said." },
  ]);
});

test("keeps a title with the name that follows it", () => {
  expect(parseScript("Mr. Smith met Dr. Who. They left.\nBye")).toEqual([
    { index: 0, text: "Mr. Smith met Dr. Who." },
    { index: 1, text: "They left." },
    { index: 2, text: "Bye" },
  ]);
});

test("an empty script has no lines", () => {
  expect(parseScript("")).toEqual([]);
});
