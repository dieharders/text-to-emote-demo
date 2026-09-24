/** The line being read, with the words spoken so far highlighted (following the audio clock). */
import { useEffect, useState } from "react";
import type { BabbleVoice } from "../voice/babble";

export function SpeechBubble({ text, voice }: { text: string | null; voice: BabbleVoice }) {
  const [spoken, setSpoken] = useState(-1);

  useEffect(() => {
    setSpoken(-1);
    if (!text) return;
    let raf = 0;
    const loop = () => {
      const word = voice.active()?.word ?? -1;
      setSpoken((prev) => (word > prev ? word : prev)); // never un-highlight within a line
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [text, voice]);

  return (
    <div className="relative min-h-[4.5rem] w-full rounded-2xl border border-line bg-panel px-5 py-3 text-lg leading-snug">
      {text ? (
        text.split(/\s+/).map((word, i) => (
          <span key={i} className={i <= spoken ? "text-ivory" : "text-dim"}>
            {word}{" "}
          </span>
        ))
      ) : (
        <span className="text-dim">Press Play and Clawd will read your script.</span>
      )}
      {/* The bubble's tail, pointing down at Clawd. */}
      <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r border-b border-line bg-panel" />
    </div>
  );
}
