/** Typed calls to the app's own server (same origin). */
import type { ApiErrorBody, DecisionRequest, DecisionResult, EngineInfo } from "../../shared/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.error ?? `Request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export const api = {
  engine: () => request<EngineInfo>("GET", "/api/engine"),
  setup: () => request<{ ok: true }>("POST", "/api/engine/setup"),
  cancelSetup: () => request<{ ok: true }>("POST", "/api/engine/cancel"),
  start: () => request<{ ok: true }>("POST", "/api/engine/start"),
  stop: () => request<{ ok: true }>("POST", "/api/engine/stop"),
  decide: (req: DecisionRequest, signal?: AbortSignal) => request<DecisionResult>("POST", "/api/decide", req, signal),
};
