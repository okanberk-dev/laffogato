/**
 * Every motion number of the home page's journey (home-journey.tsx). The
 * visual values live in journey.module.css; durations of the CSS intro are
 * there too.
 */

/** Frames in the sequence (frames/index.json carries the same number). */
export const FRAME_COUNT = 120;

/** How much of the gap to the scroll target closes each 60 fps frame. */
export const SCROLL_SMOOTHING = 0.09;
/** How far the picture shifts with the pointer, in UV, at depth 0 or 1. */
export const DEPTH_STRENGTH = { x: 0.0144, y: 0.0108 } as const;
export const POINTER_SMOOTHING = 0.055;
export const CURSOR_SMOOTHING = 0.2;

export interface Timing {
  enter?: readonly [number, number];
  exit?: readonly [number, number];
}

/** When each block shows, in scroll progress 0..1. */
export const TIMING = {
  hero: { exit: [0.16, 0.28] },
  mid: { enter: [0.38, 0.46], exit: [0.58, 0.68] },
  cards: { enter: [0.76, 0.84] },
  final: { enter: [0.82, 0.9] },
} as const satisfies Record<string, Timing>;

/** A block rises this far as it enters and lifts this far as it leaves (design px). */
export const ENTER_RISE = 24;
export const EXIT_LIFT = -16;

export const MIN_LOADER_MS = 1500;
export const LOADER_TIMEOUT_MS = 8000;
export const BURN_MS = 1150;
export const INTRO_AT_MS = 760;

/** The blur of the glass behind the cards (CSS px). */
export const CARD_BLUR = 24;

/** A screen at most this wide for its height gets the portrait frames. */
export const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";
