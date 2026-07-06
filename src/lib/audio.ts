import { settings } from "./settings";

/* sound effects (WebAudio, synthesized — no asset files) */
export const audio = {
  ctx: null as AudioContext | null,
  tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, freqEnd?: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  play(kind: "type" | "miss" | "bonus") {
    if (!settings.soundOn) return;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (kind === "type") this.tone(900 + Math.random() * 150, 0.045, "triangle", 0.07);
      else if (kind === "miss") this.tone(170, 0.18, "sawtooth", 0.09, 0, 110);
      else if (kind === "bonus") {
        // cheerful 3-note arpeggio
        this.tone(784, 0.09, "sine", 0.12);
        this.tone(1046.5, 0.09, "sine", 0.12, 0.09);
        this.tone(1318.5, 0.16, "sine", 0.12, 0.18);
      }
    } catch {
      /* audio unavailable — play silently on */
    }
  },
};
