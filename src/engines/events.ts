/**
 * Status + log fan-out, shared by every engine so each one only calls `setStatus` and `log`.
 */
import type { EngineEvent, EngineStatus } from "../shared/api";

export class EngineEvents {
  private listeners = new Set<(event: EngineEvent) => void>();

  constructor(public status: EngineStatus) {}

  on(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setStatus(status: EngineStatus): void {
    this.status = status;
    this.emit({ type: "status", status });
  }

  log(line: string): void {
    this.emit({ type: "log", line });
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // One broken subscriber (a closed SSE stream) must not starve the others.
        console.error("[engine] event listener failed:", err);
      }
    }
  }
}
