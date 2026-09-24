# EmoBuff: working notes

A Bun desktop app. A native webview window hosts a React UI served by `Bun.serve` in a Worker, and
a swappable decision engine scores each script line against the poses. The README covers the
architecture and how to extend it.

## Verify with the package scripts

`bun run typecheck && bun run lint && bun run test`: not raw `tsc`/`eslint`.
- `typecheck` uses `tsconfig.typecheck.json` (see below).
- `lint` enforces the module boundaries.
- `bun run eval` checks decision quality after changing pose descriptions or engine pins.
- UI changes: `bun run dev` (browser, mock engine) and look at `?gallery` for sprite changes.

## Boundaries (lint-enforced)

- `src/client` imports only `src/shared`. It reaches the server over `/api`, never by import.
- Only `src/engines/index.ts` imports a specific engine. Only `src/engines/von` imports `von-sdk`.
- Engine-specific code, dependencies and downloads stay inside that engine's folder.
- `src/shared/api.ts` is the only client↔server contract. Keep it engine-agnostic.

## Gotchas (each one has broken a build before, here or in motionbuff)

- **Literal specifiers only:** `new Worker("./src/worker.ts")` in main.ts,
  `import index from "./client/index.html"` in worker.ts, `await import("webview-bun")`, and the
  `<script src="./main.tsx">` tag. Bun finds them by static analysis; computed paths silently drop
  code from the compiled binary.
- **`tsconfig.typecheck.json` maps `webview-bun` to a type stub.** Never put that mapping in
  tsconfig.json: the bundler honours `paths` and would ship an empty module.
- **`src/client/generated.css` is built by the Tailwind CLI** (`build:css`, or the dev watcher). It
  is gitignored, and `build.ts` refuses to build without it.
- **The server binds 127.0.0.1 only** and keeps `development: false`. The router rejects
  non-loopback `Host` headers and cross-origin state changes.
- **Windows console:** it's hidden at runtime (`hideOwnConsoleWindow` in main.ts). Patching the exe to
  the GUI subsystem kills `new Worker()`.
- **Von:**
  - `/health` is up before the model loads, so readiness is a warmup request.
  - It loads `checkpoints/von-1.2/` relative to its cwd, and must run with `HF_HUB_OFFLINE=1`.
  - `marker_calibration.json` is required.
  - Only one decision may be in flight at a time.

## Style

- Comments explain WHY, especially the non-obvious constraint a line exists for.
- Never fail silently. The client gets fixed copy plus a machine `code`; the raw cause goes to the
  log.
- Stop/cleanup functions are safe to call twice. Timers that must not hold the process open are
  unref'd.
- Tests live next to the code (`*.test.ts`, `bun test`) and never touch real user data.
- Double quotes, semicolons, 2-space indent.
