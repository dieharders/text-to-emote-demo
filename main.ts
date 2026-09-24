/**
 * Main thread: start the server in a Worker, then open a native window pointed at it.
 *
 * The ordering is forced: `webview.run()` blocks its thread until the window closes, so the
 * window gets the main thread and the server gets a Worker (src/worker.ts).
 *
 *   emobuff              open the window
 *   emobuff --headless   run the server only and print its URL (open it in any browser)
 *
 * Structure from ~/Projects/markdown-to-pdf/server.ts; the console handling and shutdown
 * handshake from ~/Projects/motionbuff-native-app/app/main.ts.
 */
import { dlopen, FFIType, ptr } from "bun:ffi";

/**
 * Hide the console Windows opens for a double-clicked executable.
 *
 * At RUNTIME, not by patching the exe to the GUI subsystem at build time: that also removes the
 * process's standard handles, and Bun's `new Worker()` then kills the process at startup with no
 * output at all (found in motionbuff). Only acts when this process is the console's sole owner,
 * i.e. double-clicked; launched from a terminal, the console is the user's and stays.
 */
function hideOwnConsoleWindow(): void {
  if (process.platform !== "win32") return;
  try {
    const kernel32 = dlopen("kernel32.dll", {
      GetConsoleWindow: { args: [], returns: FFIType.ptr },
      GetConsoleProcessList: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u32 },
      FreeConsole: { args: [], returns: FFIType.i32 },
    });
    const user32 = dlopen("user32.dll", { ShowWindow: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 } });
    const hwnd = kernel32.symbols.GetConsoleWindow();
    if (!hwnd) return;
    const pids = new Uint32Array(2);
    if (kernel32.symbols.GetConsoleProcessList(ptr(pids), pids.length) !== 1) return;
    user32.symbols.ShowWindow(hwnd, 0); // SW_HIDE: classic console host
    kernel32.symbols.FreeConsole(); // Windows Terminal: detach so its tab closes
  } catch {
    // Cosmetic only. A visible console beats failing to start.
  }
}

const headless = process.argv.includes("--headless");

// The specifier MUST stay a string literal and this file MUST stay at the project root: Bun
// finds worker modules by static analysis, and resolves this path the same way in dev and in
// the compiled binary only from here.
const worker = new Worker("./src/worker.ts");

const port = await new Promise<number>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("The server did not start within 15 seconds.")), 15_000);
  worker.onmessage = (event) => {
    if (event.data?.type === "ready") {
      clearTimeout(timeout);
      resolve(event.data.port as number);
    }
  };
  worker.onerror = (event) => {
    clearTimeout(timeout);
    reject(new Error(`Worker error: ${event.message}`));
  };
});

// 127.0.0.1, not `localhost`: on Windows `localhost` often resolves to ::1 first.
const url = `http://127.0.0.1:${port}`;

/** Ask the worker to stop the engine and reap its children, and wait (bounded) for it to say so. */
function shutdownWorker(timeoutMs = 8_000): Promise<void> {
  return new Promise((resolve) => {
    const done = setTimeout(resolve, timeoutMs);
    worker.onmessage = (event) => {
      if (event.data?.type === "closed") {
        clearTimeout(done);
        resolve();
      }
    };
    worker.postMessage({ type: "shutdown" });
  });
}

async function quit(code: number): Promise<never> {
  await shutdownWorker();
  worker.terminate();
  process.exit(code);
}

const printUrl = (note?: string) => {
  console.log(`\n  EmoBuff is running at:\n\n  → ${url}\n`);
  if (note) console.log(`  (${note})\n`);
};

if (headless) {
  printUrl();
  process.once("SIGINT", () => void quit(130));
  process.once("SIGTERM", () => void quit(143));
} else {
  let opened = false;
  try {
    // Dynamic import inside the try, so a missing WebView2 (Windows) or WebKitGTK (Linux)
    // degrades to "open this URL in a browser" instead of a crash. Keep the specifier literal.
    const { Webview } = await import("webview-bun");
    const webview = new Webview();
    webview.title = "EmoBuff";
    webview.size = { width: 1280, height: 860, hint: 0 }; // 0 = resizable
    webview.navigate(url);
    console.log(`\n  EmoBuff window opened.  (server: ${url})\n`);
    hideOwnConsoleWindow();
    opened = true;
    webview.run(); // blocks until the window is closed
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (opened) console.error(`\n  The window closed unexpectedly: ${detail}\n`);
    else {
      console.error(`\n  Could not open the native window: ${detail}\n`);
      printUrl("Native window unavailable: open the URL above in your browser");
      process.once("SIGINT", () => void quit(130));
      process.once("SIGTERM", () => void quit(143));
    }
  }
  if (opened) await quit(0);
}
