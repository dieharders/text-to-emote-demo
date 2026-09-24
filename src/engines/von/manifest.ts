/**
 * Everything the Von engine downloads, pinned by version AND hash.
 *
 * Hashes are written here rather than looked up at runtime: no GitHub or Hugging Face API call
 * can be rate-limited, and nothing can change underneath an installed copy. That matters for Von
 * in particular: its Hugging Face `main` branch was overwritten six times in its first week, once
 * with weights that did not match the calibration file beside them.
 *
 * To bump a pin: change it here, update the hash, then re-run `bun run eval`.
 */
import { release } from "node:os";

export const VON_MODEL = "von-1.2";
export const VON_SDK_VERSION = "1.2.2"; // must match requirements.txt

/** uv installs Python and the packages (https://github.com/astral-sh/uv). */
export const UV_VERSION = "0.12.18";
export const UV_ASSETS: Record<string, { file: string; size: number; sha256: string }> = {
  "darwin-arm64": {
    file: "uv-aarch64-apple-darwin.tar.gz",
    size: 16_963_768,
    sha256: "cf40e0c6a202190ccd9e0406dcfdd5b2d6668a9a5c779b17948963df32aafe5b",
  },
  "win32-x64": {
    file: "uv-x86_64-pc-windows-msvc.zip",
    size: 17_891_221,
    sha256: "cae6a3bc25239f83dffb467a4b180508d9da23986c04639ebfa44e43e6a84bff",
  },
  "linux-x64": {
    file: "uv-x86_64-unknown-linux-gnu.tar.gz",
    size: 19_798_687,
    sha256: "89eadd7c76fc063887959510d5ba0ab1264dfd5f1143b925ddb73021a40acf16",
  },
  "linux-arm64": {
    file: "uv-aarch64-unknown-linux-gnu.tar.gz",
    size: 19_000_649,
    sha256: "afb6291f3f0a6b4521fc67b947822506c41dde5b60d2189dd8f3695b2ac8c9e7",
  },
};
export const uvUrl = (file: string) => `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${file}`;

/** The uv-managed CPython Von runs on (von-sdk requires >= 3.12). */
export const PYTHON_VERSION = "3.12.14";

/** Von's weights on Hugging Face, at a fixed commit. */
export const WEIGHTS = {
  repo: "wfzyx/von",
  revision: "5df8185a4f2327ad0a7cd117cc4f701ac557b9ae",
  /** Von loads a local checkpoint from this path, relative to its working directory. */
  dir: "checkpoints/von-1.2",
  files: [
    { name: "config.json", size: 6_329, sha256: "091b9a53c47e1cbc0b10b521a2d2f21dedf863851c07122cfa3d3e497e5e82ec" },
    { name: "tokenizer.json", size: 3_583_486, sha256: "bb637767e8dfb8044597df6c58243bff2e592ae9e3b310c0bbdb8591f6ac543d" },
    { name: "tokenizer_config.json", size: 571, sha256: "4d2a485d5fd1ee514db180744fc00807c11da34012ac3666744c0377f6c23731" },
    // REQUIRED, and easy to miss: without it Von silently runs uncalibrated, in the wrong
    // attention mode for these weights (`independent_options`).
    { name: "marker_calibration.json", size: 1_456, sha256: "9b32949dcd0cfd122db509c9bd5be67f0cfe35696153aa93d667caf0aae147c9" },
    // The bare encoder: Von's loader needs it to build the model skeleton.
    { name: "model.safetensors", size: 1_579_143_688, sha256: "af57d5d2ab15715a753a1eb4add4271d1aecce7e76f3365f629c082df329297a" },
    // The trained encoder + option-marker head that overwrite that skeleton.
    { name: "option_marker.pt", size: 1_581_316_459, sha256: "3faf27f88d30aaf9aa37860d4cdef99f1d05450cf40364f6236ac892d4d139ed" },
  ],
} as const;
export const weightUrl = (name: string) =>
  `https://huggingface.co/${WEIGHTS.repo}/resolve/${WEIGHTS.revision}/${name}`;

export const WEIGHTS_BYTES = WEIGHTS.files.reduce((sum, f) => sum + f.size, 0);

/** Rough first-run download for the Set up button: uv + Python (~0.05 GB), packages (~0.35 GB), weights. */
export const DOWNLOAD_BYTES = WEIGHTS_BYTES + 400 * 1024 * 1024;

export const platformKey = () => `${process.platform}-${process.arch}`;

/** Why Von cannot run here, in words a user can act on; null when it can. */
export function unsupportedReason(): string | null {
  const key = platformKey();
  if (key === "darwin-x64") return "Von needs an Apple Silicon Mac: PyTorch no longer ships builds for Intel Macs.";
  if (!UV_ASSETS[key]) return `Von has no build for this platform (${key}).`;
  // Darwin 23 is macOS 14, the oldest macOS that PyTorch 2.14 supports.
  if (process.platform === "darwin" && Number(release().split(".")[0]) < 23) {
    return "Von needs macOS 14 (Sonoma) or newer.";
  }
  return null;
}
