import { beforeEach, describe, expect, test } from "bun:test";
import { createEngine } from "../engines";
import type { DecisionResult, EngineInfo } from "../shared/api";
import { createApi, type Api } from "./api-routes";

const ORIGIN = "http://127.0.0.1:24850";
const question = {
  instructions: "Which emotion does the speaker express in this line?",
  options: { neutral: "neutral: calm", happy: "happy: glad, pleased", sad: "sad: unhappy, sorry" },
};

const call = (api: Api, method: string, path: string, init: { body?: unknown; headers?: Record<string, string> } = {}) =>
  api.handle(
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: { host: "127.0.0.1:24850", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );

let api: Api;
beforeEach(async () => {
  api = createApi(await createEngine("mock"), { allowInstall: true });
  await Bun.sleep(1); // let the autostart settle
});

describe("the API, served with the mock engine", () => {
  test("GET /api/engine describes the engine", async () => {
    const res = await call(api, "GET", "/api/engine");
    expect(res.status).toBe(200);
    const info = (await res.json()) as EngineInfo;
    expect(info.id).toBe("mock");
    expect(info.status.state).toBe("ready"); // an installed engine starts on its own
  });

  test("POST /api/decide scores exactly the asked options", async () => {
    const res = await call(api, "POST", "/api/decide", { body: { text: "I'm so glad you came!", question } });
    expect(res.status).toBe(200);
    const result = (await res.json()) as DecisionResult;
    expect(Object.keys(result.distribution).sort()).toEqual(["happy", "neutral", "sad"]);
    expect(Object.values(result.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const top = Object.entries(result.distribution).sort((a, b) => b[1] - a[1])[0]![0];
    expect(top).toBe("happy");
  });

  test("POST /api/decide rejects a malformed request", async () => {
    const res = await call(api, "POST", "/api/decide", { body: { text: 42 } });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("bad_request");
  });

  test("POST /api/decide says so when the engine is not running", async () => {
    await call(api, "POST", "/api/engine/stop");
    const res = await call(api, "POST", "/api/decide", { body: { text: "hi", question } });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("not_ready");
  });

  test("the events stream opens with the current status", async () => {
    const res = await call(api, "GET", "/api/engine/events");
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    expect(new TextDecoder().decode(value)).toStartWith('data: {"type":"status","status":{"state":"ready"');
  });

  test("unknown routes are 404, wrong methods 405", async () => {
    expect((await call(api, "GET", "/api/nope")).status).toBe(404);
    expect((await call(api, "GET", "/api/decide")).status).toBe(405);
  });
});

describe("request checks", () => {
  test("a non-loopback Host is refused (DNS rebinding)", async () => {
    const res = await call(api, "GET", "/api/engine", { headers: { host: "evil.example:24850" } });
    expect(res.status).toBe(403);
  });

  test("another origin cannot change state", async () => {
    const res = await call(api, "POST", "/api/engine/stop", { headers: { origin: "http://evil.example" } });
    expect(res.status).toBe(403);
  });

  test("the app's own page can", async () => {
    const res = await call(api, "POST", "/api/engine/stop", { headers: { origin: ORIGIN } });
    expect(res.status).toBe(200);
  });

  test("installs can be switched off", async () => {
    const locked = createApi(await createEngine("mock"), { allowInstall: false });
    expect((await call(locked, "POST", "/api/engine/setup")).status).toBe(403);
  });
});
