import { expect, test } from "bun:test";
import { parseScript } from "./parseScript";

test("splits on newlines, trims, and skips blank lines", () => {
  expect(parseScript("  Hello!\r\n\n   \nBye.  \n")).toEqual([
    { index: 0, text: "Hello!" },
    { index: 1, text: "Bye." },
  ]);
});

test("an empty script has no lines", () => {
  expect(parseScript("")).toEqual([]);
});
