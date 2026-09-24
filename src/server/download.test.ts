import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChecksumError, downloadVerified } from "./download";

const payload = new Uint8Array(300_000).map((_, i) => (i * 7) % 251);
const sha256 = new Bun.CryptoHasher("sha256").update(payload).digest("hex");
const rangesSeen: string[] = [];

// A local server that honours Range, plus one path that ignores it.
const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch(req) {
    const range = req.headers.get("range");
    if (range) rangesSeen.push(range);
    if (new URL(req.url).pathname === "/ignores-range" || !range) return new Response(payload);
    const start = Number(/bytes=(\d+)-/.exec(range)![1]);
    if (start >= payload.length) return new Response(null, { status: 416 });
    return new Response(payload.slice(start), {
      status: 206,
      headers: { "content-range": `bytes ${start}-${payload.length - 1}/${payload.length}` },
    });
  },
});
const url = (path = "/file") => `http://127.0.0.1:${server.port}${path}`;

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "emobuff-download-"));
  rangesSeen.length = 0;
});
afterAll(async () => {
  server.stop(true);
  await rm(dir, { recursive: true, force: true });
});

const bytesOf = async (path: string) => new Uint8Array(await Bun.file(path).arrayBuffer());

describe("downloadVerified", () => {
  test("downloads, verifies and moves the file into place", async () => {
    const dest = join(dir, "a.bin");
    const progress: number[] = [];
    await downloadVerified({ url: url(), sha256, size: payload.length, dest }, new AbortController().signal, (done) => progress.push(done));
    expect(await bytesOf(dest)).toEqual(payload);
    expect(existsSync(`${dest}.partial`)).toBe(false);
    expect(progress.at(-1)).toBe(payload.length);
  });

  test("a checksum mismatch leaves nothing behind", async () => {
    const dest = join(dir, "b.bin");
    const wrong = "0".repeat(64);
    await expect(downloadVerified({ url: url(), sha256: wrong, size: 0, dest }, new AbortController().signal)).rejects.toBeInstanceOf(ChecksumError);
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.partial`)).toBe(false);
  });

  test("resumes a partial download with a Range request", async () => {
    const dest = join(dir, "c.bin");
    await writeFile(`${dest}.partial`, payload.slice(0, 120_000));
    const progress: number[] = [];
    await downloadVerified({ url: url(), sha256, size: payload.length, dest }, new AbortController().signal, (done) => progress.push(done));
    expect(rangesSeen).toEqual(["bytes=120000-"]);
    expect(progress[0]).toBeGreaterThan(120_000); // counted from where it left off
    expect(await bytesOf(dest)).toEqual(payload);
  });

  test("starts over when the server ignores Range", async () => {
    const dest = join(dir, "d.bin");
    await writeFile(`${dest}.partial`, payload.slice(0, 50_000));
    await downloadVerified({ url: url("/ignores-range"), sha256, size: 0, dest }, new AbortController().signal);
    expect(await bytesOf(dest)).toEqual(payload);
  });

  test("a partial file that is already complete is verified without re-downloading", async () => {
    const dest = join(dir, "e.bin");
    await writeFile(`${dest}.partial`, payload);
    await downloadVerified({ url: url(), sha256, size: 0, dest }, new AbortController().signal);
    expect(await bytesOf(dest)).toEqual(payload);
  });

  test("cancelling keeps the partial file for next time", async () => {
    const dest = join(dir, "f.bin");
    await writeFile(`${dest}.partial`, payload.slice(0, 1_000));
    const controller = new AbortController();
    controller.abort();
    await expect(downloadVerified({ url: url(), sha256, size: 0, dest }, controller.signal)).rejects.toThrow();
    expect(existsSync(`${dest}.partial`)).toBe(true);
  });
});
