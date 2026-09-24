/**
 * The UI in a browser with hot module replacement: `bun run dev` → http://127.0.0.1:3000
 * (motionbuff's `app/scripts/dev.ts` pattern).
 *
 * A SEPARATE entrypoint from src/worker.ts on purpose: that file pins `development: false` and
 * ships inside the binary; this one turns HMR on and is never part of the build. Both mount the
 * same API, so the UI talks to real routes.
 *
 * Uses the mock engine unless EB_ENGINE says otherwise (e.g. `EB_ENGINE=von bun run dev`).
 */
import index from "../src/client/index.html";
import { createEngine } from "../src/engines";
import { createApi, type Api } from "../src/server/api-routes";
import { killAllLive } from "../src/server/process";

process.env.EB_ENGINE ||= "mock";
process.env.EB_DATA_ROOT ||= ".dev-data";

// `--hot` re-runs this module on every server-side edit, but some things must survive a
// reload: the Tailwind watcher (two would fight over generated.css) and the engine (a Von
// sidecar holds gigabytes of RAM). They are parked on globalThis, which hot reload keeps.
const hot = globalThis as { __ebTailwind?: { kill(): void }; __ebApi?: Promise<Api>; __ebExitHook?: boolean };

hot.__ebTailwind?.kill();
hot.__ebTailwind = Bun.spawn(
  [
    process.execPath,
    "x",
    "@tailwindcss/cli",
    "-i",
    "./src/client/styles.css",
    "-o",
    "./src/client/generated.css",
    // `=always`: the CLI treats a closed stdin as "stop watching", and a spawned child has none.
    "--watch=always",
  ],
  { cwd: `${import.meta.dir}/..`, stdio: ["ignore", "inherit", "inherit"] },
);

hot.__ebApi ??= createEngine().then((engine) => createApi(engine));
const api = await hot.__ebApi;

if (!hot.__ebExitHook) {
  hot.__ebExitHook = true;
  const quit = async (code: number) => {
    hot.__ebTailwind?.kill();
    await api.shutdown().catch(() => {});
    killAllLive();
    process.exit(code);
  };
  process.once("SIGINT", () => void quit(130));
  process.once("SIGTERM", () => void quit(143));
  process.on("exit", () => {
    hot.__ebTailwind?.kill();
    killAllLive();
  });
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.EB_DEV_PORT ?? 3000),
  idleTimeout: 120,
  // ON here and only here: HMR, plus browser console output echoed into this terminal.
  development: { hmr: true, console: true },
  // Same split as src/worker.ts. The API MUST be a route: `/*` matches everything, so a
  // `fetch` fallback would never be reached.
  routes: {
    "/api/*": (req: Request) => api.handle(req),
    "/*": index as never,
  },
});

console.log(`\n  EmoBuff dev UI   http://127.0.0.1:${server.port}   (engine: ${process.env.EB_ENGINE})`);
console.log("  HMR on: client edits apply live. Engine code changes need a restart.\n");
