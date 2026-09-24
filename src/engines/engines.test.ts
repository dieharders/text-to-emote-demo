/**
 * The contract every engine must meet. Runs against the mock engine always, and against Von
 * when it is installed and EB_TEST_VON=1 (it starts a real model, so it is opt-in).
 */
import { describe, expect, test } from "bun:test";
import { ENGINES, createEngine } from ".";
import type { EngineStatus } from "../shared/api";
import type { DecisionEngine } from "./types";

const options = {
  neutral: "neutral: calm, matter-of-fact",
  happy: "happy: glad, pleased, cheerful",
  sad: "sad: unhappy, disappointed, sorry",
  angry: "angry: mad, annoyed, frustrated",
  scared: "scared: afraid, nervous, worried",
};
const question = { instructions: "Which emotion does the speaker express in this line?", options };

function conformance(id: string, opts: { timeout: number; run: boolean }) {
  describe.skipIf(!opts.run)(`engine "${id}" meets the DecisionEngine contract`, () => {
    let engine: DecisionEngine;
    const statuses: EngineStatus["state"][] = [];

    test(
      "starts and reports ready",
      async () => {
        engine = await createEngine(id);
        engine.onEvent((e) => e.type === "status" && statuses.push(e.status.state));
        expect(engine.info().id).toBe(id);
        await engine.start();
        expect(engine.info().status.state).toBe("ready");
        expect(statuses.at(-1)).toBe("ready");
      },
      opts.timeout,
    );

    test(
      "scores exactly the asked labels, summing to 1, for 2 to 5 options",
      async () => {
        for (let n = 2; n <= 5; n++) {
          const subset = Object.fromEntries(Object.entries(options).slice(0, n));
          const result = await engine.decide({ text: "I'm so happy you're here!", question: { ...question, options: subset } });
          expect(Object.keys(result.distribution).sort()).toEqual(Object.keys(subset).sort());
          expect(Object.values(result.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
          expect(result.latencyMs).toBeGreaterThanOrEqual(0);
          expect(result.model.length).toBeGreaterThan(0);
        }
      },
      opts.timeout,
    );

    test(
      "an aborted decision rejects",
      async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(engine.decide({ text: "hello", question }, controller.signal)).rejects.toThrow();
      },
      opts.timeout,
    );

    test(
      "stops, and stopping twice is harmless",
      async () => {
        await engine.stop();
        await engine.stop();
        expect(engine.info().status.state).toBe("stopped");
      },
      opts.timeout,
    );
  });
}

test("the registry knows each engine and rejects unknown ones", async () => {
  expect(Object.keys(ENGINES)).toEqual(expect.arrayContaining(["von", "mock"]));
  await expect(createEngine("nope")).rejects.toThrow('Unknown engine "nope"');
});

conformance("mock", { timeout: 5_000, run: true });
conformance("von", { timeout: 10 * 60_000, run: process.env.EB_TEST_VON === "1" });
