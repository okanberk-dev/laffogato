/**
 * A short confirmation tone, shared by the two admin surfaces that need one.
 *
 * Built from an oscillator rather than shipped as an audio file: it is two
 * hundred milliseconds of sine wave, and a counter that is looking at the
 * member rather than the screen needs to hear that something landed. Fails
 * silently - a browser that blocks audio until a gesture must not break the
 * till scan or the order list around it.
 *
 * Lives here rather than in the till's `scan-engine.ts` because the order
 * list rings it too; `scan-engine` re-exports it so its own callers and its
 * test did not have to move.
 */
export function beep(ok: boolean): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* No audio on this device; the flash and the receipt still say so. */
  }
}
