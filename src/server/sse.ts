/**
 * Server-sent events framing. Ported from motionbuff `packages/shell/src/sse.ts`.
 *
 * Four lines of string formatting: not worth a dependency.
 */
const encoder = new TextEncoder();

/** One SSE data frame. */
export const frame = <T>(event: T): Uint8Array => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/** A comment frame: carries nothing, keeps an idle connection from timing out. */
export const PING = encoder.encode(": ping\n\n");
export const HEARTBEAT_MS = 15_000;

/**
 * Put `chunk` on the wire every `everyMs` until the returned function is called.
 *
 * The enqueue is GUARDED because a stream can close between ticks, and a throw inside a timer
 * callback would take the server Worker down. The timer is UNREF'D so a heartbeat never keeps a
 * process alive. Stopping twice is harmless.
 */
export const heartbeat = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  chunk: Uint8Array = PING,
  everyMs: number = HEARTBEAT_MS,
): (() => void) => {
  const timer = setInterval(() => {
    try {
      controller.enqueue(chunk);
    } catch {
      // Closed between ticks; whoever closed the stream stops this.
    }
  }, everyMs);
  (timer as unknown as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
};

export const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
} as const;
