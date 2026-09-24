/** `?gallery`: every pose, animated and large, for reviewing the pixel art side by side. */
import { useState } from "react";
import { AvatarCanvas } from "../avatar/AvatarCanvas";
import { POSES } from "../poses/catalog";

export function PoseGallery() {
  const [talking, setTalking] = useState(false);
  // A fake syllable rhythm, so the talk hop can be reviewed without audio.
  const isTalking = () => talking && Math.floor(performance.now() / 110) % 2 === 0;

  return (
    <div className="min-h-full p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-lg font-medium">Pose gallery</h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={talking} onChange={(e) => setTalking(e.target.checked)} /> talking
        </label>
        <a href="/" className="ml-auto text-sm text-clay hover:underline">
          ← back to the app
        </a>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {POSES.map((pose) => (
          <figure
            key={pose.id}
            className="flex flex-col items-center rounded-2xl border border-line p-2"
            style={{ background: `radial-gradient(circle at 50% 60%, ${pose.tint} 0%, var(--color-panel) 75%)` }}
          >
            <AvatarCanvas pose={pose.id} scale={3} isTalking={isTalking} />
            <figcaption className="text-sm">
              {pose.emoji} {pose.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
