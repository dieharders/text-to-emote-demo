import { describe, expect, test } from "bun:test";
import { POSES } from "../poses/catalog";
import { SIZE, type Frame } from "./grid";
import { PALETTE } from "./palette";
import { RECIPES } from "./recipes";
import { renderPose } from "./render";

const at = (frame: Frame, x: number, y: number) => frame[y * SIZE + x];

/** Row of the body's top edge in column x (first body-colored pixel from the top). */
const topOf = (frame: Frame, x: number) => {
  for (let y = 0; y < SIZE; y++) if (at(frame, x, y) === "O") return y;
  return -1;
};

describe("renderPose", () => {
  test("every pose in the catalog has a recipe", () => {
    for (const pose of POSES) expect(RECIPES[pose.id]).toBeDefined();
  });

  test("every pose renders a full frame of palette colors, at every tick", () => {
    for (const pose of POSES) {
      for (let tick = 0; tick < 48; tick++) {
        const frame = renderPose(pose.id, { tick, sincePose: tick, talking: tick % 2 === 0 });
        expect(frame.length).toBe(SIZE * SIZE);
        for (const code of frame) if (code) expect(PALETTE[code]).toBeDefined();
      }
    }
  });

  test("every pose looks different from every other pose", () => {
    const frames = POSES.map((pose) => renderPose(pose.id, { tick: 1, sincePose: 99 }).join(","));
    expect(new Set(frames).size).toBe(POSES.length);
  });

  test("is deterministic", () => {
    for (const pose of POSES) {
      expect(renderPose(pose.id, { tick: 7, sincePose: 3 })).toEqual(renderPose(pose.id, { tick: 7, sincePose: 3 }));
    }
  });

  test("neutral is the official silhouette: torso, 4×4 black eyes, side arms, four legs", () => {
    const f = renderPose("neutral", { tick: 1, sincePose: 99 });
    // Body top-left sits at (10, 28); eyes at body (8..11, 8..11) and (32..35, 8..11).
    expect(at(f, 18, 36)).toBe("K");
    expect(at(f, 21, 39)).toBe("K");
    expect(at(f, 22, 36)).toBe("O");
    expect(at(f, 42, 36)).toBe("K");
    expect(at(f, 10, 36)).toBe("O"); // left arm
    expect(at(f, 53, 43)).toBe("O"); // right arm
    expect(at(f, 14, 59)).toBe("O"); // a leg…
    expect(at(f, 18, 59)).toBeNull(); // …and the gap beside it
  });

  test("talking hops the body up one pixel", () => {
    const still = renderPose("neutral", { tick: 1, sincePose: 99 });
    const talking = renderPose("neutral", { tick: 1, sincePose: 99, talking: true });
    expect(topOf(talking, 30)).toBe(topOf(still, 30) - 1);
  });

  test("a new pose starts with a one-frame crouch", () => {
    const accent = renderPose("happy", { tick: 1, sincePose: 0 });
    const settled = renderPose("happy", { tick: 1, sincePose: 5 });
    expect(topOf(accent, 30)).toBeGreaterThan(topOf(settled, 30));
  });
});
