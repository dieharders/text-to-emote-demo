import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forgetChild, reapOrphans, recordChild } from "./process";

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("child records are one file per child", async () => {
  const dir = await mkdtemp(join(tmpdir(), "emobuff-running-"));
  await recordChild(dir, 111);
  await recordChild(dir, 222);
  await forgetChild(dir, 111);
  expect(await readdir(dir)).toEqual(["222.json"]);
  expect(await Bun.file(join(dir, "222.json")).json()).toMatchObject({ pid: 222, ownerPid: process.pid });
  await rm(dir, { recursive: true, force: true });
});

// The bug this pins: a second copy of the app (a dev server beside the app window) used to erase
// the first copy's record, so the first copy's engine could no longer be cleaned up after a crash.
test.skipIf(process.platform === "win32")("reaps orphans, and leaves another live copy's child and record alone", async () => {
  const dir = await mkdtemp(join(tmpdir(), "emobuff-running-"));
  const gone = Bun.spawn(["true"]);
  await gone.exited; // a pid that is certainly dead: the crashed app
  const orphan = Bun.spawn(["sleep", "30"]); // its leftover engine
  const otherApp = Bun.spawn(["sleep", "30"]); // another copy of the app, still running…
  const otherChild = Bun.spawn(["sleep", "30"]); // …and its engine
  const write = (pid: number, ownerPid: number) => Bun.write(join(dir, `${pid}.json`), JSON.stringify({ pid, ownerPid }));
  await write(orphan.pid, gone.pid);
  await write(otherChild.pid, otherApp.pid);
  await write(999_999, gone.pid); // a record whose child is long gone

  try {
    await reapOrphans(dir, "sleep", () => {});
    await orphan.exited;
    expect(orphan.signalCode).toBe("SIGKILL");
    expect(alive(otherChild.pid)).toBe(true);
    expect(await readdir(dir)).toEqual([`${otherChild.pid}.json`]);
  } finally {
    orphan.kill();
    otherApp.kill();
    otherChild.kill();
    await rm(dir, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32")("never kills a process that no longer looks like ours", async () => {
  const dir = await mkdtemp(join(tmpdir(), "emobuff-running-"));
  const gone = Bun.spawn(["true"]);
  await gone.exited;
  const unrelated = Bun.spawn(["sleep", "30"]); // a reused pid, say
  await Bun.write(join(dir, `${unrelated.pid}.json`), JSON.stringify({ pid: unrelated.pid, ownerPid: gone.pid }));
  try {
    await reapOrphans(dir, "von.cli", () => {});
    expect(alive(unrelated.pid)).toBe(true);
    expect(await readdir(dir)).toEqual([]);
  } finally {
    unrelated.kill();
    await rm(dir, { recursive: true, force: true });
  }
});
