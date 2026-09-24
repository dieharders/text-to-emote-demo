/**
 * The studio screen. State lives here and flows down:
 *
 *   script ─▶ lines ─▶ usePlayback ─▶ /api/decide (the engine scores each line)
 *                          │
 *                          ├─▶ decide() + thresholds ─▶ pose ─▶ Stage (Clawd) + voice preset
 *                          └─▶ DecisionPanel / PosePalette / ScriptPanel (why, and the options)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DecisionResult } from "../shared/api";
import { DEFAULT_GATE, decide, type Decision, type GateOptions } from "../shared/decide";
import { DecisionPanel } from "./components/DecisionPanel";
import { EngineCard } from "./components/EngineCard";
import { PosePalette } from "./components/PosePalette";
import { ScriptPanel, type ScriptView } from "./components/ScriptPanel";
import { Stage } from "./components/Stage";
import { useEngine } from "./hooks/useEngine";
import { parseScript } from "./playback/parseScript";
import { usePlayback } from "./playback/usePlayback";
import { buildPoseQuestion, isPoseId, type PoseId } from "./poses/catalog";
import { SAMPLE_SCRIPT } from "./poses/samples";
import { BabbleVoice } from "./voice/babble";

export function App() {
  const engine = useEngine();
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [view, setView] = useState<ScriptView>("edit");
  const [gate, setGate] = useState<GateOptions>(DEFAULT_GATE);
  const [preview, setPreview] = useState<PoseId | null>(null);
  const [volume, setVolume] = useState(0.6);

  const voice = useMemo(() => new BabbleVoice(), []);
  const question = useMemo(buildPoseQuestion, []);
  const lines = useMemo(() => parseScript(script), [script]);
  useEffect(() => voice.setVolume(volume), [voice, volume]);

  // The playback loop reads the thresholds when each line starts, not when Play was pressed.
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const choosePose = useCallback((result: DecisionResult | undefined): PoseId => {
    const pose = result ? decide(result.distribution, gateRef.current).pose : "neutral";
    return isPoseId(pose) ? pose : "neutral";
  }, []);

  const playback = usePlayback({ voice, question, choosePose });
  const { state, decisions } = playback;
  const playing = state.status === "playing";

  const judge = useCallback(
    (text: string): Decision | null => {
      const result = decisions[text]?.result;
      return result ? decide(result.distribution, gate) : null;
    },
    [decisions, gate],
  );

  const currentLine = playing && state.current >= 0 ? (state.lines[state.current]?.text ?? null) : null;
  const lineDecision = currentLine ? decisions[currentLine] : undefined;
  const decision = currentLine ? judge(currentLine) : null;

  // Reading: the current line's pose. Idle: whatever pose is being hovered in the palette.
  const stagePose: PoseId = playing ? (decision && isPoseId(decision.pose) ? decision.pose : "neutral") : (preview ?? "neutral");
  const caption = playing
    ? lineDecision?.error
      ? "no decision, showing neutral"
      : decision
        ? decision.gated
          ? `fallback: ${decision.reason}`
          : decision.reason
        : "deciding…"
    : preview
      ? "preview"
      : lines.length > 0
        ? "press Play to read the script"
        : "write a script to begin";

  const play = useCallback(() => {
    if (lines.length === 0) return;
    setView("lines");
    void playback.play(lines);
  }, [lines, playback]);

  // Space toggles Play/Stop, except while typing or on a focused control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if ((e.target as HTMLElement).closest("textarea, input, button, select")) return;
      e.preventDefault();
      if (playing) playback.stop();
      else play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, play, playback]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line px-6 py-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            Emo<span className="text-clay">Buff</span>
          </div>
          <div className="text-xs text-muted">Character studio</div>
        </div>
        <div className="ml-auto min-w-0">
          <EngineCard engine={engine} />
        </div>
      </header>

      {/* One grid for all four panels so the top and bottom rows share column edges. The bottom row
          is sized by its content (not a fixed height), so its panels can never spill out of it. */}
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] grid-rows-[minmax(0,1fr)_auto] gap-6 p-6">
        <Stage
          pose={stagePose}
          line={currentLine}
          voice={voice}
          playing={playing}
          canPlay={lines.length > 0}
          volume={volume}
          caption={caption}
          onPlay={play}
          onStop={playback.stop}
          onVolume={setVolume}
        />
        <ScriptPanel
          script={script}
          lines={lines}
          view={view}
          current={playing ? state.current : -1}
          playing={playing}
          decisions={decisions}
          judge={judge}
          onScript={setScript}
          onView={setView}
          onAnalyze={() => {
            setView("lines");
            playback.analyze(lines);
          }}
        />
        <DecisionPanel
          line={currentLine}
          decision={decision}
          result={lineDecision?.result}
          error={lineDecision?.error}
          waiting={playing && state.phase === "deciding"}
          gate={gate}
          onGate={setGate}
        />
        <PosePalette decision={decision} onPreview={setPreview} />
      </main>
    </div>
  );
}
