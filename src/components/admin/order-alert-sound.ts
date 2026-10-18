import {
  BELL_PARTIALS,
  ringMotif,
  type BellNote,
} from "@/lib/admin/order-alerts-core";

/**
 * The new-order ring, synthesised with Web Audio: no audio file to ship or
 * cache, no dependency. `beep.ts` stays the till's short confirmation tone;
 * this is the loud, repeating partner-tablet bell (the motif's numbers live
 * in order-alerts-core.ts, where a test pins them).
 *
 * Autoplay: a browser lets a page make a sound only after a gesture on it.
 * `unlock()` is called from the first pointerdown/keydown in the panel and
 * from the bell's own buttons; from then on the context runs, also while
 * the tab is hidden.
 */

interface ParamLike {
  value: number;
  setValueAtTime(value: number, at: number): unknown;
  exponentialRampToValueAtTime(value: number, at: number): unknown;
}

interface NodeLike {
  connect(target: unknown): unknown;
}

interface OscillatorLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  start(at: number): void;
  stop(at: number): void;
}

interface GainLike extends NodeLike {
  gain: ParamLike;
}

interface CompressorLike extends NodeLike {
  threshold: ParamLike;
  knee: ParamLike;
  ratio: ParamLike;
  attack: ParamLike;
  release: ParamLike;
}

/** The slice of an AudioContext the ring uses (a test passes a recorder). */
export interface AudioLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createDynamicsCompressor(): CompressorLike;
}

/** Silence for an exponential ramp, which cannot reach zero. */
const FLOOR = 0.0001;
/** A struck bell: almost no attack. */
const ATTACK_S = 0.004;

/**
 * Schedules one ring on `out` from `t0` (audio-clock seconds). Every partial
 * of every note is its own sine with its own fast exponential decay, the
 * higher partials dying first, which is what makes it a bell.
 */
export function scheduleRing(
  ctx: AudioLike,
  out: NodeLike,
  level: number,
  t0: number,
  notes: readonly BellNote[] = ringMotif(),
): void {
  for (const note of notes) {
    const start = t0 + note.at;
    for (const partial of BELL_PARTIALS) {
      const decay = note.decay / Math.sqrt(partial.ratio);
      const peak = Math.max(FLOOR * 2, note.peak * partial.gain * level);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq * partial.ratio, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(FLOOR, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(FLOOR, start + decay);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + decay + 0.02);
    }
  }
}

export interface Ringer {
  /** From a gesture: create or resume the context. True once it runs. */
  unlock(): Promise<boolean>;
  unlocked(): boolean;
  /** One ring at `level` (0..1); false when the context is not running. */
  ring(level: number): boolean;
}

/**
 * One context for the tab, created on the first unlock and routed through a
 * DynamicsCompressorNode: the overlapping notes are loud without clipping.
 * Every failure is silent - a device without audio still gets the card,
 * the title and the notification.
 */
export function createRinger(make: () => AudioLike | null): Ringer {
  let ctx: AudioLike | null = null;
  let out: NodeLike | null = null;

  const ensure = (): AudioLike | null => {
    if (ctx) return ctx;
    try {
      const made = make();
      if (!made) return null;
      const comp = made.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 6;
      comp.ratio.value = 8;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      comp.connect(made.destination);
      const master = made.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      ctx = made;
      out = master;
    } catch {
      ctx = null;
      out = null;
    }
    return ctx;
  };

  const running = () => ctx !== null && ctx.state === "running";

  return {
    async unlock() {
      const c = ensure();
      if (!c) return false;
      if (c.state !== "running") {
        try {
          await c.resume();
        } catch {
          /* Still locked: the next gesture tries again. */
        }
      }
      return running();
    },
    unlocked: running,
    ring(level) {
      if (!running() || !ctx || !out) return false;
      try {
        scheduleRing(ctx, out, level, ctx.currentTime + 0.03);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The browser's AudioContext, or null where there is none. */
export function browserAudio(): AudioLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Ctor ? (new Ctor() as unknown as AudioLike) : null;
}
