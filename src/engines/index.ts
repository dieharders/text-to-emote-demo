/**
 * The engine registry: the ONLY file that imports engine folders.
 *
 * To add a model: create `./<id>/index.ts` exporting an `EngineFactory` and add it below.
 * Then run the app with `EB_ENGINE=<id>`.
 */
import { createMockEngine } from "./mock";
import type { DecisionEngine, EngineFactory } from "./types";
import { createVonEngine } from "./von";

export const ENGINES: Record<string, EngineFactory> = {
  von: createVonEngine,
  mock: createMockEngine,
};

export const DEFAULT_ENGINE = "von";

export async function createEngine(id: string = process.env.EB_ENGINE?.trim() || DEFAULT_ENGINE): Promise<DecisionEngine> {
  const factory = ENGINES[id];
  if (!factory) {
    throw new Error(`Unknown engine "${id}" (EB_ENGINE). Known engines: ${Object.keys(ENGINES).join(", ")}.`);
  }
  return factory();
}
