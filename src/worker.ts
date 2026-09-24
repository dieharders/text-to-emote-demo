/**
 * The HTTP server, running in a Worker (motionbuff's structure, `app/src/worker.ts`).
 *
 * It lives off the main thread because `webview.run()` blocks its thread with a native event
 * loop forever. The main thread owns the window, this thread owns the server, and they meet at
 * the ready handshake below and again at shutdown.
 *
 * The literal `import index from "./client/index.html"` is how the frontend gets INTO the
 * compiled binary: Bun's bundler finds it by static analysis, bundles the <script> and <link>
 * tags it references, and embeds the result. Keep it a literal import in this file.
 */
import index from "./client/index.html";
import { createEngine } from "./engines";
import { createApi } from "./server/api-routes";
import { killAllLive } from "./server/process";

const api = createApi(await createEngine());

/**
 * The same port every launch when possible, so the page's origin (and with it any browser
 * storage) survives relaunches. Chosen below every OS's ephemeral range and away from the ports
 * dev tools use. `EB_APP_PORT` overrides it.
 */
const PREFERRED_PORT = (() => {
  const v = Number(process.env.EB_APP_PORT);
  return Number.isInteger(v) && v > 0 && v < 65536 ? v : 24850;
})();

const serveOn = (port: number) =>
  Bun.serve({
    // LOOPBACK ONLY: the only client is the webview on this machine, and a wildcard bind would
    // raise a Windows Firewall prompt on first launch.
    hostname: "127.0.0.1",
    port,
    // Bun's default 10 s idle timeout would cut the SSE stream between heartbeats.
    idleTimeout: 120,
    // EXPLICITLY false: Bun derives it from NODE_ENV, and the dev error page leaks source.
    development: false,
    routes: {
      "/api/*": (req: Request) => api.handle(req),
      // `index` is an HTMLBundle; Bun only resolves it when it is given here, in `routes`.
      "/*": index as never,
    },
  });

// THE BIND IS THE CHECK: try the preferred port; if anything is in the way, let the OS pick.
const server = (() => {
  try {
    return serveOn(PREFERRED_PORT);
  } catch (err) {
    console.warn(`Port ${PREFERRED_PORT} is unavailable (${(err as { code?: string }).code ?? "error"}); using a free port.`);
    return serveOn(0);
  }
})();

declare var self: Worker;

/**
 * Shutdown handshake: the main thread ASKS and waits, because `Worker.terminate()` does not
 * promise to run cleanup, and a Python sidecar holding 2 GB of RAM must not outlive the window.
 */
self.onmessage = async (event: MessageEvent) => {
  if (event.data?.type !== "shutdown") return;
  try {
    await api.shutdown();
    killAllLive();
    server.stop(true);
  } catch (err) {
    console.error("[shutdown]", err);
  } finally {
    self.postMessage({ type: "closed" });
  }
};

self.postMessage({ type: "ready", port: server.port });
