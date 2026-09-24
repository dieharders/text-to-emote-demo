/**
 * A tiny router plus the two checks every `/api` request passes first.
 *
 * Routes are keyed `"METHOD /path"`. Exact paths only: this API has a handful of fixed routes,
 * and a pattern matcher would be more code than all of them together.
 */
import type { ApiErrorBody } from "../shared/api";

export type Route = (req: Request) => Response | Promise<Response>;

export const json = (status: number, body: unknown): Response => Response.json(body, { status });

/** A failed call: fixed human copy plus a machine `code`. Raw causes go to the log, never here. */
export const fail = (status: number, code: string, error: string): Response =>
  json(status, { error, code } satisfies ApiErrorBody);

/**
 * THE DNS-REBINDING CHECK. A hostile page whose domain re-points at 127.0.0.1 is "same origin"
 * to the browser, but it cannot forge `Host`: the browser writes it from the URL. A request
 * really meant for this app names the loopback.
 */
const isLoopbackHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);

export function createRouter(routes: Record<string, Route>): Route {
  const paths = new Set(Object.keys(routes).map((key) => key.split(" ")[1]));

  return async (req) => {
    const url = new URL(req.url);

    if (!isLoopbackHost(req.headers.get("host") ?? "")) return fail(403, "host", "host not allowed");

    // Only this app's own page may change state. Browsers omit Origin on same-origin GETs, and
    // every cross-origin fetch carries one, so "absent or equal" is exactly "our own page".
    const origin = req.headers.get("origin");
    if (req.method !== "GET" && origin && origin !== url.origin) {
      return fail(403, "origin", "origin not allowed");
    }

    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) {
      return paths.has(url.pathname)
        ? fail(405, "method_not_allowed", "method not allowed")
        : fail(404, "not_found", "not found");
    }

    try {
      return await route(req);
    } catch (err) {
      console.error(`[api] ${req.method} ${url.pathname} failed:`, err);
      return fail(500, "internal", "internal error");
    }
  };
}
