/**
 * Child processes: start them hidden, read their output, and make sure none outlive the app.
 *
 * Patterns from motionbuff `app/src/util/exec.ts` and `packages/shell/src/ndjson.ts`, and from
 * obrew-cli `src/engine/ports.ts` / `src/engine/running.ts`.
 */
import type { Subprocess } from "bun";
import { mkdir, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";

const IS_WIN = process.platform === "win32";

export type Child = Subprocess<"ignore", "pipe", "pipe">;

/** Every child still running, so shutdown can take them all down (see `killAllLive`). */
const live = new Set<Child>();

/**
 * Start a command with no console window, stdout/stderr piped.
 *
 * NOT detached: a child in our process group also receives a terminal's Ctrl+C, which is what we
 * want for a server that should never outlive the app. A hard kill of the app (Task Manager,
 * `kill -9`) is covered by the child records instead; see `reapOrphans`.
 */
export function spawnHidden(
  cmd: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Child {
  // An `undefined` override REMOVES the variable (e.g. a VIRTUAL_ENV inherited from a shell).
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...process.env, ...opts.env })) {
    if (value !== undefined) env[key] = value;
  }
  const child = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  live.add(child);
  child.exited.finally(() => live.delete(child));
  return child;
}

/**
 * Kill a child and everything it spawned.
 *
 * Windows has no process groups, so `taskkill /T` walks the tree. POSIX gets SIGTERM so the
 * child can clean up, then SIGKILL if it has not gone within a few seconds.
 */
export function killTree(child: Child): void {
  // Already exited: its pid may belong to someone else by now, so signal nothing.
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (IS_WIN) {
    Bun.spawnSync(["taskkill", "/pid", String(child.pid), "/T", "/F"], {
      stdout: "ignore",
      stderr: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    return; // exited between the check and the signal
  }
  const hard = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // Gone, as hoped.
    }
  }, 3_000);
  (hard as unknown as { unref?: () => void }).unref?.();
}

/** Kill every live child now. Safe to call twice. */
export function killAllLive(): void {
  for (const child of live) killTree(child);
  live.clear();
}

/**
 * Split a byte stream into text lines, safe across chunk boundaries that land mid-line or
 * mid-UTF-8-character. Ported from motionbuff `packages/shell/src/ndjson.ts`.
 */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ""; // the last piece is not a complete line yet
      for (const line of lines) if (line.trim()) yield line;
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield buffer;
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * A free loopback port. Proven free by binding it, the only test that cannot lie; the OS picks
 * the number (port 0) so there is no race between choosing and checking.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("no free loopback port"))));
    });
  });
}

/**
 * Records of running children, one file per child (`<dir>/<pid>.json`), so a later launch can
 * clean up after a hard kill (a crash, Task Manager, `kill -9`) when no exit handler ran.
 *
 * ONE FILE PER CHILD, not one shared pid file: two copies of the app (`bun run dev` beside the
 * app window, say) each run their own child, and with a shared file the second copy erased the
 * first one's record, leaving that child unreapable. Pattern from obrew-cli `src/engine/running.ts`.
 */
export async function recordChild(dir: string, pid: number): Promise<void> {
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, `${pid}.json`), JSON.stringify({ pid, ownerPid: process.pid, startedAt: new Date().toISOString() }));
}

export async function forgetChild(dir: string, pid: number): Promise<void> {
  await rm(join(dir, `${pid}.json`), { force: true }).catch(() => {});
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM"; // exists, just not ours
  }
}

/** The command line (POSIX) or image name (Windows) of a pid, "" when unknown. */
function describeProcess(pid: number): string {
  try {
    const cmd = IS_WIN
      ? ["tasklist", "/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]
      : ["ps", "-o", "command=", "-p", String(pid)];
    return Bun.spawnSync(cmd, { stderr: "ignore", windowsHide: true }).stdout.toString();
  } catch {
    return "";
  }
}

/**
 * Kill children that earlier runs left behind, and drop the records of children that are gone.
 *
 * A record is only acted on when the app that started it is dead: a live owner is another copy of
 * the app, still using its child. And because a pid can be reused by an unrelated process after a
 * reboot, the kill also needs the process to still look like ours: its command line (POSIX) or
 * image name (Windows) must contain `looksLike`.
 */
export async function reapOrphans(dir: string, looksLike: string, log: (line: string) => void): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return; // no records yet
  }
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const path = join(dir, name);
    const record = (await Bun.file(path)
      .json()
      .catch(() => null)) as { pid?: number; ownerPid?: number } | null;
    const pid = record?.pid;
    const owner = record?.ownerPid;
    if (typeof pid === "number" && isAlive(pid)) {
      if (typeof owner === "number" && owner !== process.pid && isAlive(owner)) continue; // another copy's
      if (describeProcess(pid).toLowerCase().includes(looksLike.toLowerCase())) {
        try {
          process.kill(pid, "SIGKILL");
          log(`Stopped a leftover engine process from an earlier run (pid ${pid}).`);
        } catch {
          // Exited in the meantime.
        }
      }
    }
    await rm(path, { force: true }).catch(() => {}); // reaped, gone, or unreadable
  }
}
