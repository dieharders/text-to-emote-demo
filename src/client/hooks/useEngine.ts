/**
 * The decision engine as the UI sees it: identity, live status, a log tail, and the actions.
 * Status arrives over one SSE stream (`/api/engine/events`), so nothing polls.
 */
import { useCallback, useEffect, useState } from "react";
import type { EngineEvent, EngineInfo, EngineStatus } from "../../shared/api";
import { api } from "../lib/api";

export interface EngineView {
  info: Omit<EngineInfo, "status"> | null;
  status: EngineStatus | null;
  log: string[];
  /** The last action's failure, in words, until the next action. */
  actionError: string | null;
  setup(): void;
  cancelSetup(): void;
  start(): void;
  stop(): void;
}

const MAX_LOG = 200;

export function useEngine(): EngineView {
  const [info, setInfo] = useState<Omit<EngineInfo, "status"> | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .engine()
      .then(({ status: initial, ...rest }) => {
        if (!alive) return;
        setInfo(rest);
        setStatus((s) => s ?? initial); // the event stream may already have delivered a newer one
      })
      .catch(() => {});

    // EventSource reconnects on its own if the stream drops.
    const events = new EventSource("/api/engine/events");
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as EngineEvent;
      if (event.type === "status") setStatus(event.status);
      else setLog((lines) => [...lines.slice(-(MAX_LOG - 1)), event.line]);
    };
    return () => {
      alive = false;
      events.close();
    };
  }, []);

  const run = useCallback((action: () => Promise<unknown>) => {
    setActionError(null);
    action().catch((err: Error) => setActionError(err.message));
  }, []);

  return {
    info,
    status,
    log,
    actionError,
    setup: () => run(api.setup),
    cancelSetup: () => run(api.cancelSetup),
    start: () => run(api.start),
    stop: () => run(api.stop),
  };
}
