/**
 * Von's one-time install: uv → Python + packages → weights. Every step is skipped when its
 * result is already in place, and every download resumes, so re-running setup after a failure or
 * a Cancel only does the missing work.
 *
 * Everything lands in the engine folder (`<dataDir>/engines/von`). Nothing touches PATH, the
 * user's own Python, or the app bundle, so uninstalling Von is deleting that one folder.
 */
import { chmod, mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { downloadVerified, extractArchive, humanBytes, sizeOf } from "../../server/download";
import { killTree, readLines, spawnHidden } from "../../server/process";
import { abortError } from "../types";
import { PYTHON_VERSION, UV_ASSETS, UV_VERSION, WEIGHTS, WEIGHTS_BYTES, platformKey, uvUrl, weightUrl } from "./manifest";
// Embedded in the compiled binary. uv (a separate process) cannot read the app's embedded
// files, so setup writes a real copy into the engine folder first.
import requirementsPath from "./requirements.txt" with { type: "file" };

export interface VonPaths {
  root: string;
  uv: string;
  venv: string;
  python: string;
  weights: string;
  logs: string;
  /** One record per running Von process, for cleanup after a crash (see `reapOrphans`). */
  runningDir: string;
  requirements: string;
  /** Written after a successful package install; holds a hash of what was installed. */
  packagesMarker: string;
}

export function vonPaths(root: string): VonPaths {
  const win = process.platform === "win32";
  return {
    root,
    uv: join(root, "bin", win ? "uv.exe" : "uv"),
    venv: join(root, "venv"),
    python: win ? join(root, "venv", "Scripts", "python.exe") : join(root, "venv", "bin", "python"),
    weights: join(root, WEIGHTS.dir),
    logs: join(root, "logs"),
    runningDir: join(root, "running"),
    requirements: join(root, "requirements.txt"),
    packagesMarker: join(root, "venv", ".emobuff-packages"),
  };
}

/** How setup reports progress. The engine turns these into `setting-up` statuses and log lines. */
export interface SetupReporter {
  step(step: string, done?: number, total?: number): void;
  log(line: string): void;
}

/** Changes whenever the pinned Python or packages change, so an outdated venv is rebuilt. */
async function packagesFingerprint(): Promise<string> {
  const text = await Bun.file(requirementsPath).text();
  return new Bun.CryptoHasher("sha256").update(`${PYTHON_VERSION}\n${text}`).digest("hex");
}

const readText = (path: string) => Bun.file(path).text().catch(() => "");

/** True when every setup step's result is in place. Cheap: sizes and markers, no re-hashing. */
export async function isInstalled(p: VonPaths): Promise<boolean> {
  if ((await sizeOf(p.uv)) === 0 || (await sizeOf(p.python)) === 0) return false;
  if ((await readText(p.packagesMarker)) !== (await packagesFingerprint())) return false;
  for (const f of WEIGHTS.files) {
    if ((await sizeOf(join(p.weights, f.name))) !== f.size) return false;
  }
  return true;
}

export async function setupVon(p: VonPaths, signal: AbortSignal, report: SetupReporter): Promise<void> {
  await mkdir(p.root, { recursive: true });
  await ensureUv(p, signal, report);
  await ensurePackages(p, signal, report);
  await ensureWeights(p, signal, report);
}

async function ensureUv(p: VonPaths, signal: AbortSignal, report: SetupReporter): Promise<void> {
  if ((await sizeOf(p.uv)) > 0) return;
  const asset = UV_ASSETS[platformKey()];
  if (!asset) throw new Error(`uv has no build for ${platformKey()}`);

  const step = `Downloading uv ${UV_VERSION}`;
  const binDir = dirname(p.uv);
  const archive = join(binDir, asset.file);
  report.step(step, 0, asset.size);
  await downloadVerified(
    { url: uvUrl(asset.file), sha256: asset.sha256, size: asset.size, dest: archive },
    signal,
    (done, total) => report.step(step, done, total),
  );

  // The archives differ per platform (a folder inside the .tar.gz, loose files in the .zip), so
  // find the executable by name rather than assuming a layout.
  const unpacked = join(binDir, "unpacked");
  await rm(unpacked, { recursive: true, force: true });
  await extractArchive(archive, unpacked);
  const found = (await readdir(unpacked, { recursive: true })).find((f) => basename(f) === basename(p.uv));
  if (!found) throw new Error("the uv download did not contain a uv executable");
  await rename(join(unpacked, found), p.uv);
  if (process.platform !== "win32") await chmod(p.uv, 0o755);
  await rm(unpacked, { recursive: true, force: true });
  await rm(archive, { force: true });
  report.log(`uv ${UV_VERSION} installed.`);
}

async function ensurePackages(p: VonPaths, signal: AbortSignal, report: SetupReporter): Promise<void> {
  const fingerprint = await packagesFingerprint();
  if ((await sizeOf(p.python)) > 0 && (await readText(p.packagesMarker)) === fingerprint) return;

  await Bun.write(p.requirements, await Bun.file(requirementsPath).text());
  const env = {
    // Keep uv's Python downloads and cache inside the engine folder, and never let it pick up
    // the user's own Python, uv config or active virtualenv.
    UV_PYTHON_INSTALL_DIR: join(p.root, "python"),
    UV_CACHE_DIR: join(p.root, "cache"),
    UV_PYTHON_PREFERENCE: "only-managed",
    UV_PYTHON_DOWNLOADS: "automatic",
    UV_NO_CONFIG: "1",
    VIRTUAL_ENV: undefined,
    NO_COLOR: "1",
  };

  report.step(`Installing Python ${PYTHON_VERSION}`);
  await runLogged([p.uv, "venv", "--clear", "--python", PYTHON_VERSION, p.venv], env, signal, report);

  report.step("Installing Python packages (PyTorch, Transformers, Von)");
  // CPU wheels on Windows and Linux. On Linux the default torch wheel is the CUDA build, which
  // drags in ~3 GB of NVIDIA libraries. macOS wheels already include Apple's GPU (MPS) backend.
  const torchBackend = process.platform === "darwin" ? [] : ["--torch-backend", "cpu"];
  await runLogged([p.uv, "pip", "install", "--python", p.python, "-r", p.requirements, ...torchBackend], env, signal, report);

  await Bun.write(p.packagesMarker, fingerprint);
  // The downloaded wheels (~0.7 GB) are no longer needed once installed. uv copied or
  // hard-linked them into the venv, so deleting the cache frees the space without breaking it.
  await rm(env.UV_CACHE_DIR, { recursive: true, force: true });
  report.log("Python packages installed.");
}

async function ensureWeights(p: VonPaths, signal: AbortSignal, report: SetupReporter): Promise<void> {
  const step = "Downloading Von's model weights";
  let done = 0;
  const missing: (typeof WEIGHTS.files)[number][] = [];
  for (const f of WEIGHTS.files) {
    if ((await sizeOf(join(p.weights, f.name))) === f.size) done += f.size;
    else missing.push(f);
  }

  for (const f of missing) {
    const before = done;
    report.step(step, before, WEIGHTS_BYTES);
    await downloadVerified(
      { url: weightUrl(f.name), sha256: f.sha256, size: f.size, dest: join(p.weights, f.name) },
      signal,
      (received) => report.step(step, before + received, WEIGHTS_BYTES),
    );
    done += f.size;
    report.log(`Verified ${f.name} (${humanBytes(f.size)}).`);
  }
}

/** Run a setup command, streaming its output to the log. Abort kills it. */
async function runLogged(
  cmd: string[],
  env: Record<string, string | undefined>,
  signal: AbortSignal,
  report: SetupReporter,
): Promise<void> {
  if (signal.aborted) throw abortError("setup");
  const child = spawnHidden(cmd, { env });
  const onAbort = () => killTree(child);
  signal.addEventListener("abort", onAbort, { once: true });

  const tail: string[] = [];
  const pump = async (stream: ReadableStream<Uint8Array>) => {
    for await (const line of readLines(stream)) {
      tail.push(line);
      if (tail.length > 20) tail.shift();
      report.log(line);
    }
  };

  try {
    const [code] = await Promise.all([child.exited, pump(child.stdout), pump(child.stderr)]);
    if (signal.aborted) throw abortError("setup");
    if (code !== 0) {
      throw new Error(`\`${basename(cmd[0]!)} ${cmd[1]}\` exited with code ${code}:\n${tail.slice(-8).join("\n")}`);
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
