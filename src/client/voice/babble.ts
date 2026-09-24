/**
 * The babble voice: plays a SpeechPlan as a string of short, pitched blips (think Animal
 * Crossing), with Web Audio. No text-to-speech.
 *
 * Every blip of a line is scheduled up front on the audio clock, which is sample-accurate; the
 * avatar and the speech bubble then read that same clock (`now()`) to stay in sync.
 */
import { activeAt, type SpeechPlan, type VoicePreset } from "./planSpeech";

export interface SpeechHandle {
  plan: SpeechPlan;
  /** Audio-clock time (seconds) at which the plan's t=0 plays. */
  startTime: number;
  /** Resolves when the line has finished playing or was cancelled. */
  done: Promise<void>;
  cancel(): void;
}

export class BabbleVoice {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private current: SpeechHandle | null = null;
  private volume = 0.6;

  /**
   * Create/resume the audio context. Call it from a click handler: browsers (and webviews) only
   * allow audio to start from a user gesture.
   */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const limiter = this.ctx.createDynamicsCompressor();
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
  }

  /** The audio clock, in seconds. */
  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** What the current line is doing right now (for the talk hop and the word highlight). */
  active(): { syllable: boolean; word: number } | null {
    const h = this.current;
    return h ? activeAt(h.plan, this.now() - h.startTime) : null;
  }

  speak(plan: SpeechPlan, preset: VoicePreset): SpeechHandle {
    this.cancel();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) throw new Error("Call unlock() from a user gesture before speak().");

    const t0 = ctx.currentTime + 0.05;
    const bus = ctx.createGain();
    const tone = ctx.createBiquadFilter(); // soften the raw waveform into something voice-like
    tone.type = "lowpass";
    tone.frequency.value = 2200;
    tone.Q.value = 0.7;
    tone.connect(bus).connect(master);

    const sources: AudioScheduledSourceNode[] = [];
    for (const s of plan.syllables) {
      const a = t0 + s.start;
      const b = t0 + s.end;
      const osc = ctx.createOscillator();
      osc.type = preset.wave;
      osc.frequency.setValueAtTime(s.freq, a);
      osc.frequency.linearRampToValueAtTime(s.freq * 0.94, b); // a slight fall, like a spoken syllable

      const env = ctx.createGain();
      const peak = preset.wave === "sawtooth" ? 0.14 : 0.2;
      env.gain.setValueAtTime(0, a);
      env.gain.linearRampToValueAtTime(peak, a + 0.012);
      env.gain.setValueAtTime(peak, Math.max(a + 0.012, b - 0.025));
      env.gain.linearRampToValueAtTime(0, b);
      osc.connect(env).connect(tone);

      if (preset.vibrato) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = preset.vibrato;
        depth.gain.value = s.freq * 0.03;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(a);
        lfo.stop(b);
        sources.push(lfo);
      }
      osc.start(a);
      osc.stop(b + 0.01);
      sources.push(osc);
    }

    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => (resolveDone = resolve));
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      bus.disconnect();
      if (this.current === handle) this.current = null;
      resolveDone();
    };
    const timer = setTimeout(finish, (t0 - ctx.currentTime + plan.duration) * 1000 + 40);

    const handle: SpeechHandle = {
      plan,
      startTime: t0,
      done,
      cancel: () => {
        for (const src of sources) {
          try {
            src.stop();
          } catch {
            // Already stopped.
          }
        }
        finish();
      },
    };
    this.current = handle;
    return handle;
  }

  /** Stop the current line immediately. */
  cancel(): void {
    this.current?.cancel();
    this.current = null;
  }
}
