# EmoBuff

A pixel-art character studio. Paste a script, press **Play**, and Clawd (the Claude Code mascot)
reads it aloud one sentence (a "line") at a time in a babbling voice. On each line he steps into an emoji-style pose:
happy, sad, angry, confused and so on. A **decision model** reads each line and scores every pose.
The UI shows the scores, how confident the model is, and why that pose won.

- **Local and private:** the model runs on your machine; nothing is sent anywhere.
- **Swappable model:** the decision engine is a plugin. The shipped one is
  [Von](https://github.com/wfzyx/von), a "System One" decision model; a keyword-matching mock is
  included for development.
- **One small app:** a Bun executable with a native window. The model and its Python runtime
  download on first use, after one click.

This is a starter project, meant to grow into a studio (custom avatars, poses driven by video or
audio, video export, streaming). It is kept small, modular and easy to extend.

## Quick start

Requires [Bun](https://bun.sh) 1.4+.

```bash
bun install
bun run dev        # UI in your browser at http://127.0.0.1:3000, hot reload, mock engine
bun run app        # the real app window, with the Von engine
```

In the app, press **Set up Von** once. It downloads about 3.3 GB: `uv`, Python 3.12, PyTorch and
the model weights. After that Von starts on its own with every launch. To try Von inside the
browser UI, run `EB_ENGINE=von bun run dev`.

| Command | What it does |
|---|---|
| `bun run dev` | Browser UI with hot reload (mock engine by default) |
| `bun run app` | Native window from source |
| `bun run build` | Compile this platform's app into `dist/` |
| `bun run build:all` | Compile every platform |
| `bun run test` | Unit and API tests (`EB_TEST_VON=1` adds the real-model contract tests) |
| `bun run typecheck` / `bun run lint` | Types; lint, including the module boundaries below |
| `bun run eval` | Score 30 labeled lines with the engine and print accuracy and a confusion table |

Source runs keep downloads in `./.dev-data`. The compiled app uses the per-user folder
(`~/Library/Application Support/EmoBuff`, `%LOCALAPPDATA%\EmoBuff`, `~/.local/share/EmoBuff`).
Settings are in [.env.example](.env.example).

## How it works

```
main.ts ─ native window (webview-bun) ──▶ http://127.0.0.1:<port>
   └─ src/worker.ts ─ Bun.serve
        ├─ "/*"    the React UI (src/client), embedded in the binary
        └─ "/api"  src/server/api-routes.ts ──▶ DecisionEngine (src/engines)
                                                  ├─ mock: keyword overlap, in-process
                                                  └─ von: Python sidecar ◀─ von-sdk (HTTP)
```

The script is read one sentence at a time. For each sentence, the client does four things:
1. Asks `/api/decide` to score it against every pose's description (one multiple-choice question).
   A sentence of four words or fewer ("Oh no.", "We did it!") says too little on its own, so it is
   scored with its whole script line instead.
   - On the sample script this took Von from 12 to 15 correct out of 20 sentences, and it didn't
     hurt lines whose emotion changes partway through.
   - Sending the neighbouring sentences as context made results worse: Von lets their emotions
     bleed in. So the rule never reaches across a line break.
   - `bun run eval` re-checks it.
2. Applies the **decision rule** (`src/shared/decide.ts`). The top pose wins unless its score or its
   lead over the runner-up is below the thresholds, in which case Clawd stays neutral.
3. Speaks the line with a Web Audio babble tuned to the pose.
4. Hops Clawd on each syllable and highlights the words as they're spoken.

The next two lines are scored ahead of time, so the reading never waits on the model.

### Layout

```
src/shared/     the client↔server contract (api.ts) and the decision rule (decide.ts)
src/server/     router, API routes, downloads, child processes, data paths
src/engines/    decision engines: types.ts (the interface), index.ts (registry), mock/, von/
src/client/     React UI
  poses/        catalog.ts: one entry per pose (label, emoji, description, voice, tint)
  avatar/       pixel-art Clawd: palette, grid, parts (body, eyes, fx), recipes, animation
  voice/        speech planning (pure) and the Web Audio babble
  playback/     reading the script: decisions → pose → voice
  components/   Stage, ScriptPanel, DecisionPanel, PosePalette, EngineCard
main.ts         window host        build.ts   compile + package
scripts/        dev.ts (browser dev server), eval.ts (accuracy check)
```

**Module boundaries** (enforced by `bun run lint`):
- `client/` imports only from `shared/`.
- Only `engines/index.ts` imports a specific engine.
- Only `engines/von/` uses `von-sdk`.

## Extending

- **A pose:** add an entry to `src/client/poses/catalog.ts` and a recipe to
  `src/client/avatar/recipes.ts`. TypeScript points at anything missing. Its description is what the
  model reads: start it with the emotion's name and keep it short. Check the result with
  `bun run eval` and the `?gallery` page (`http://127.0.0.1:3000/?gallery`). Keep to about ten poses;
  more options mean more near-ties.
- **An effect or eye style:** add a glyph and a case in `avatar/parts/fx.ts` or `avatar/parts/eyes.ts`,
  then use it in a recipe.
- **A decision model:** create `src/engines/<id>/index.ts` exporting a factory that returns a
  `DecisionEngine` (see `src/engines/types.ts`), and register it in `src/engines/index.ts`. The engine
  owns everything model-specific: runtime, dependencies, downloads, and how it maps a question onto
  the model. Run it with `EB_ENGINE=<id>`; `src/engines/engines.test.ts` checks it meets the contract.

## The Von engine

Von is a ModernBERT-large "System One" model: one forward pass scores every option of a
multiple-choice question. EmoBuff runs Von's own server (`von serve`) as a hidden local process
and talks to it with the official TypeScript client, `von-sdk`.

- **Setup** (`src/engines/von/setup.ts`) downloads a pinned `uv`, then CPython 3.12.14, then the
  hash-pinned Python packages (`requirements.txt`), then the model weights at a fixed Hugging Face
  commit. Everything is checked against hardcoded SHA-256s, downloads resume, and Cancel keeps
  finished work. It all lives in `<data>/engines/von/`: delete that folder to uninstall.
- **Runtime** (`sidecar.ts`): Von binds 127.0.0.1 on a free port and runs offline. Its log is at
  `<data>/engines/von/logs/von.log`. It stops with the app, and a crashed run's leftover process is
  cleaned up on the next launch.
- **Measured on an Apple Silicon Mac (MPS):**
  - Setup: 46 s on a fast connection.
  - Start: about 14 s.
  - Per line: 50–60 ms.
  - `bun run eval`: **22/30 (73%)**. Most misses are neighbouring emotions (excited → happy,
    thinking → confused).
- **Platforms:**
  - Apple Silicon Macs on macOS 14+.
  - Windows x64 and Linux x64/arm64, which install CPU-only PyTorch (about 0.1–0.5 s per line).
  - Intel Macs are not supported: PyTorch stopped shipping them.
- **Needs** about 4 GB of disk, and about 2 GB of RAM while running (3–5 GB peak while loading).
- **Quirk:** Von's calibration makes short lines come back nearly one-hot, so the confidence gate
  rarely trips.

### Why Von (and what it can't do)

The source for the comparison figures is the independent
[jabr/classifier-benchmark](https://github.com/jabr/classifier-benchmark/blob/main/results/benchmark.md).
Its tests used identical questions on an Apple Silicon GPU (MPS), with Von 1.1 against Laya
(`convaiinnovations/laya`). EmoBuff ships Von 1.2.

**Strengths**

| | Von 1.1 | Laya |
|---|---|---|
| `choice` accuracy (the question type EmoBuff uses, ≈388 cases) | **84.5%** | 70.2% |
| Overall accuracy (≈945 cases) | **74.2%** | 58.7% |
| Rating (`score`) accuracy | **68.6%** | 40.0% |
| Latency, mean / p95 | 53 / 76 ms | **46 / 55 ms** |

- **More accurate:** about +14 points on multiple-choice questions, at nearly the same speed. Laya is
  about 7 ms faster on average; either is far below the time it takes to speak a line.
- **Order-invariant (new in 1.2):** each option is scored against the text alone, never against the
  other options. Shuffling the pose list can't change the answer (0 flips in Von's tests), whereas
  Laya changes its answer about 4% of the time.
- **Calibrated probabilities:** a temperature fitted per input, based on entropy, line length and
  option count.
- **Long context:** 8,192 tokens, versus Laya's 512 (of which 192 are shared by the question and all
  options).
- **No option-count limit:** Laya's calibration breaks at 11+ options (temperature 0.1), which caps
  it at 10. Von has no hard limit.
- **Local, Apache-2.0, official TypeScript client** (`von-sdk`).
- **Tested here:** 22/30 (73%) on `bun run eval`, 50–60 ms per line on MPS. (Laya was not run on this set.)

**Limitations**

- **No browser build:** Von is PyTorch-only. It has no ONNX export (its 1.2 custom attention makes
  one non-trivial), so it runs as a Python sidecar and needs about 3.3 GB of downloads. Laya has
  community ONNX exports that run in a browser tab.
- **Option text and length:**
  - No per-option token cap, and no truncation: the tokenizer runs without it. The whole prompt
    (instructions, the line, and every option description) must fit in 8,192 tokens.
  - Every option adds to the prompt, and latency grows with its total length. Keep descriptions
    short; Von's own notes say more than about 20 options saturates.
  - Von reads each option's DESCRIPTION, not its label, so a description must name its emotion.
  - `[MASK]` and `[SEP]` in the text are read as real tokens. EmoBuff strips them.
- **Overconfident on short lines:** the calibration temperature bottoms out at 0.3, so short lines
  come back near 100%. The API has no temperature override.
- **One request at a time:** the server has no inference lock, so EmoBuff queues decisions.
  Several questions in one request run one after another, not in a single pass.
- **Slow first start:** loading is lazy, and `/health` is up before the model is. EmoBuff waits for a
  warmup request.
- **Platforms:** Apple Silicon needs macOS 14+ (torch 2.14). Intel Macs are unsupported. Windows and
  Linux run CPU-only here (about 0.1–0.5 s per line).
- **Weaker on some things:** the benchmark found its accuracy drops on unfamiliar domains (v1 → v2:
  93.6% → 72.4%). Probabilities can land mid-scale on unfamiliar criteria. Jev, TypeSafe's closed
  model, still scores higher (96.5%).

## Building and shipping

`bun run build` writes `dist/emobuff-darwin-arm64`, `dist/EmoBuff.app` (ad-hoc signed) and a zip of
it. `bun run build:all` cross-compiles `windows-x64`, `linux-x64` and `linux-arm64` as well. Each is
a single file of about 65 MB.

| Platform | Needs | First launch |
|---|---|---|
| **macOS** | — | The app is ad-hoc signed, not notarized. Allow it once under **System Settings → Privacy & Security → Open Anyway**, or run `xattr -dr com.apple.quarantine EmoBuff.app`. |
| **Windows** | WebView2 (built into Windows 10/11) | — |
| **Linux** | WebKitGTK 6 (`libwebkitgtk-6.0-4`) | A `.desktop` launcher is written next to the binary. |

With no native window available, the app prints its URL instead. `--headless` does that on purpose.

Installers and a release workflow aren't set up yet. When they're needed, port motionbuff's
`make-installer.ts` and `release.yml`.
