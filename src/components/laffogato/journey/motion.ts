import { ENTER_RISE, EXIT_LIFT, type Timing } from "./config";

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;

/**
 * Moves `value` towards `target` by a factor written "per 60 fps frame",
 * whatever the frame rate is: k = 1 - (1 - f) ^ (dt / 16.67 ms). `dt` is
 * clamped to 0..100 ms (a loop's first frame can be stamped slightly before
 * the clock it started from, and a background tab hands back a long one).
 */
export function damp(
  value: number,
  target: number,
  factor: number,
  dtMs: number,
) {
  const dt = clamp(dtMs, 0, 100);
  const k = 1 - Math.pow(1 - factor, dt / (1000 / 60));
  return lerp(value, target, k);
}

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const invLerp = (a: number, b: number, v: number) =>
  clamp((v - a) / (b - a || 1));

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Where a block is at this point of the scroll: its opacity, how far it is
 * off its place (design px), and whether it is worth drawing at all.
 */
export function stateStyle(progress: number, { enter, exit }: Timing) {
  let opacity = 1;
  let y = 0;
  if (enter && progress < enter[1]) {
    const t = smoothstep(invLerp(enter[0], enter[1], progress));
    opacity = t;
    y = lerp(ENTER_RISE, 0, t);
  } else if (exit && progress > exit[0]) {
    const t = smoothstep(invLerp(exit[0], exit[1], progress));
    opacity = 1 - t;
    y = lerp(0, EXIT_LIFT, t);
  }
  return { opacity, y, visible: opacity > 0.002 };
}
