/** The decision engine's status and controls: set up, start, stop, with progress and a log tail. */
import type { EngineStatus } from "../../shared/api";
import type { EngineView } from "../hooks/useEngine";
import { formatBytes, pct } from "../lib/format";

const TONE: Record<EngineStatus["state"], string> = {
  ready: "bg-ok",
  starting: "bg-warn",
  "setting-up": "bg-warn",
  stopped: "bg-dim",
  "needs-setup": "bg-dim",
  error: "bg-bad",
  unsupported: "bg-bad",
};

function describe(status: EngineStatus): string {
  switch (status.state) {
    case "ready":
      return status.device ? `Ready · ${status.device}` : "Ready";
    case "starting":
      return status.step ?? "Starting…";
    case "setting-up":
      return status.step;
    case "stopped":
      return "Stopped";
    case "needs-setup":
      return "Not installed";
    case "error":
      return status.message;
    case "unsupported":
      return status.reason;
  }
}

const button =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function EngineCard({ engine }: { engine: EngineView }) {
  const { info, status, log } = engine;
  if (!info || !status) return <div className="text-sm text-muted">Connecting…</div>;

  const busy = status.state === "setting-up" || status.state === "starting";
  const progress = status.state === "setting-up" && status.total ? (status.done ?? 0) / status.total : null;

  return (
    <div className="flex min-w-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="text-xs text-muted">
            Decision engine · <span className="text-ivory">{info.name}</span> <span className="font-mono">{info.version}</span>
          </div>
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[status.state]} ${busy ? "animate-pulse" : ""}`} />
            <span className="max-w-[26rem] truncate" title={describe(status)}>
              {describe(status)}
            </span>
          </div>
        </div>

        {status.state === "needs-setup" && (
          <button className={`${button} bg-clay text-ink hover:bg-clay-dark`} onClick={engine.setup}>
            Set up {info.name} · {formatBytes(status.downloadBytes)} download
          </button>
        )}
        {status.state === "setting-up" && (
          <button className={`${button} bg-raised hover:bg-line`} onClick={engine.cancelSetup}>
            Cancel
          </button>
        )}
        {(status.state === "stopped" || status.state === "error") && (
          <button className={`${button} bg-raised hover:bg-line`} onClick={engine.start}>
            Start
          </button>
        )}
        {status.state === "error" && log.length > 0 && (
          <button className={`${button} bg-raised hover:bg-line`} onClick={engine.setup} title="Re-run setup; finished steps are skipped">
            Repair
          </button>
        )}
        {(status.state === "ready" || status.state === "starting") && (
          <button className={`${button} bg-raised hover:bg-line`} onClick={engine.stop}>
            Stop
          </button>
        )}
      </div>

      {status.state === "setting-up" && (
        <div className="w-[26rem] max-w-full">
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            {progress === null ? (
              <div className="progress-indeterminate h-full w-1/3 rounded-full bg-clay" />
            ) : (
              <div className="h-full rounded-full bg-clay transition-[width]" style={{ width: pct(progress, 1) }} />
            )}
          </div>
          {status.total ? (
            <div className="mt-0.5 text-right font-mono text-[11px] text-muted">
              {formatBytes(status.done ?? 0)} / {formatBytes(status.total)} · {pct(progress ?? 0)}
            </div>
          ) : null}
        </div>
      )}

      {(busy || status.state === "error") && log.length > 0 && (
        <div className="w-[26rem] max-w-full truncate text-right font-mono text-[11px] text-dim" title={log[log.length - 1]}>
          {log[log.length - 1]}
        </div>
      )}
      {engine.actionError && <div className="text-xs text-bad">{engine.actionError}</div>}
    </div>
  );
}
