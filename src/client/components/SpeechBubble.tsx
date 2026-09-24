/** The line being read, with the words spoken so far highlighted (following the audio clock). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BabbleVoice } from "../voice/babble";

// Font bounds in px. Short lines render big; long ones shrink until they fit the fixed-height
// bubble, so the bubble never grows and pushes Clawd and the transport off screen.
const MAX_FONT = 48;
const MIN_FONT = 14;

export function SpeechBubble({ text, voice }: { text: string | null; voice: BabbleVoice }) {
  const [spoken, setSpoken] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

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

  // Binary-search the largest font size whose text fits the box. Runs before paint so the line
  // never flashes at the wrong size, and again whenever the box is resized.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = textRef.current;
    if (!box || !inner) return;
    const fit = () => {
      let lo = MIN_FONT;
      let hi = MAX_FONT;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        inner.style.fontSize = `${mid}px`;
        if (inner.scrollHeight <= box.clientHeight) lo = mid;
        else hi = mid - 1;
      }
      inner.style.fontSize = `${lo}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="relative h-40 w-full shrink-0 rounded-2xl border border-line bg-panel px-6 py-4">
      {/* The inner box is what gets measured; overflow is a last resort past MIN_FONT. */}
      <div ref={boxRef} className="h-full overflow-y-auto">
        <div ref={textRef} className="font-medium leading-tight">
          {text ? (
            text.split(/\s+/).map((word, i) => (
              <span key={i} className={i <= spoken ? "text-ivory" : "text-dim"}>
                {word}{" "}
              </span>
            ))
          ) : (
            <span className="text-dim">Press Play and Clawd will read your script.</span>
          )}
        </div>
      </div>
      {/* The bubble's tail, pointing down at Clawd. */}
      <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r border-b border-line bg-panel" />
    </div>
  );
}
