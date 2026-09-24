/**
 * Picks the scene family from a photo's pixels (lafmobil
 * docs/DESIGN-GLASS.md §6.5, algorithm `v1`).
 *
 * Pure and deterministic: the same pixels, hue and category always give the
 * same answer, so a re-save never flips a scene and the backfill can be run
 * twice. The caller decodes the photo (`from-image.ts`); this module only
 * sees an RGBA buffer of at most 64 × 64.
 *
 * What it looks for is the drink's BODY colour, not the photo's dominant
 * colour. Measured on real photos, a plain dominant colour lost to the black
 * frame and the grey studio ground; so the frame is cut, the centre weighs
 * more, foam and glass highlights are dropped, and the result is the heaviest
 * of four colour clusters, weighted towards colourful pixels.
 */

import {
  BACKDROP_FAMILIES,
  BACKDROP_KEYS,
  familyForHue,
  NO_AUTO_PICK_CATEGORIES,
  type BackdropKey,
} from "./families";
import {
  chroma,
  deltaEOK2,
  deltaEOKSquared,
  hexToOklab,
  oklabToHex,
  srgb8ToOklab,
  type Oklab,
} from "./oklab";

/**
 * Every threshold of the algorithm, named once (DESIGN-GLASS §6.5 steps 2-6).
 * Changing any of them changes stored picks: bump `BACKDROP_ALGO_VERSION`.
 */
export const PICK = {
  /** Step 2: a pixel below half opacity is background of a cutout. */
  alphaCut: 0.5,
  /** Step 2, opaque photos: centre weighting, sigma as a share of the short side. */
  centreSigma: 0.35,
  /** Step 2, opaque photos: the outer ring dropped, in sample pixels (frames, edges). */
  ringPx: 4,
  /** Step 3: foam, glass highlights and white ground (L above AND C below). */
  nearWhiteL: 0.93,
  nearWhiteC: 0.03,
  /**
   * Step 3: shadow and black frame. Deliberately low: a cold brew or an
   * americano body is Oklab L 0.15-0.24, and the earlier 0.18 dropped the
   * drink itself, leaving ice and grey glass to pull the pick to `latte`.
   */
  nearBlackL: 0.12,
  /** Step 4: clusters. */
  k: 4,
  /** Step 4: weight = count × (base + C), so colourful pixels count more. */
  chromaWeightBase: 0.5,
  /** Step 4: Lloyd iterations; 64 × 64 settles well before this. */
  maxIterations: 32,
  /** Steps 5-6: the accept radius in ΔEOK2 (about 5 just-noticeable steps). */
  acceptRadius: 0.1,
  /** Step 5b: two families closer than this to each other's distance are a tie. */
  tieMargin: 0.03,
  /** Step 5: a centre below this chroma is a neutral... */
  neutralC: 0.04,
  /** ...and is split by lightness: darker is `espresso`, lighter `latte`. */
  neutralSplitL: 0.45,
} as const;

/** Why the pick came out the way it did; the panel and the backfill show it. */
export type PickReason =
  /** The item's hue family is inside the accept radius (step 5a). */
  | "prior"
  /** A neutral body, split by lightness (step 5). */
  | "neutral"
  /** The nearest family, clear of the runner-up (steps 5-6). */
  | "nearest"
  /** A near tie settled by the item's hue (step 5b). */
  | "tie-prior"
  /** A near tie the hue does not settle: no pick (step 5b). */
  | "tie"
  /** Nothing inside the accept radius: no pick (step 6). */
  | "far"
  /** No pixel survived the cuts (a blank or all-white image). */
  | "empty"
  /** `gear` / `merch`: no automatic pick for this category (step 8). */
  | "category";

export interface PickResult {
  /** The family to store, or null (the app falls back to `hue`, then the category). */
  family: BackdropKey | null;
  /** The body colour the pick was made from (`#RRGGBB`), or null when none was read. */
  hex: string | null;
  /**
   * ΔEOK2 from `hex` to the chosen family's ref; with no family, to the
   * nearest one. null when no colour was read.
   */
  distance: number | null;
  reason: PickReason;
}

export interface PickInput {
  /** RGBA, 4 bytes per pixel, row-major. */
  pixels: Uint8Array;
  width: number;
  height: number;
  /** The photo has no transparent pixel (`sharp` `stats().isOpaque`). */
  isOpaque: boolean;
  /** The item's `hue` (menu) or `img` (shop), the prior. */
  hue?: string | null;
  /** The item's category (`categoryKey` or the shop's `cat`). */
  category?: string | null;
}

interface Sample {
  lab: Oklab;
  weight: number;
}

const REFS: readonly { key: BackdropKey; lab: Oklab }[] = BACKDROP_KEYS.map(
  (key) => ({ key, lab: hexToOklab(BACKDROP_FAMILIES[key].ref) }),
);

/** Steps 2-3: the pixels that may be the drink, each with its weight. */
function samples(input: PickInput): Sample[] {
  const { pixels, width, height, isOpaque } = input;
  const out: Sample[] = [];
  const alphaMin = PICK.alphaCut * 255;
  const sigma = PICK.centreSigma * Math.min(width, height);
  const twoSigmaSq = 2 * sigma * sigma;
  const cx = width / 2;
  const cy = height / 2;
  const ring = PICK.ringPx;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < alphaMin) continue;

      let weight = 1;
      if (isOpaque) {
        if (x < ring || y < ring || x >= width - ring || y >= height - ring) {
          continue;
        }
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        weight = Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
      }

      const lab = srgb8ToOklab(pixels[i], pixels[i + 1], pixels[i + 2]);
      const c = chroma(lab);
      if (lab.L > PICK.nearWhiteL && c < PICK.nearWhiteC) continue;
      if (lab.L < PICK.nearBlackL) continue;

      out.push({ lab, weight: weight * (PICK.chromaWeightBase + c) });
    }
  }
  return out;
}

function weightedMean(list: readonly Sample[]): Oklab {
  let w = 0;
  let L = 0;
  let a = 0;
  let b = 0;
  for (const s of list) {
    w += s.weight;
    L += s.weight * s.lab.L;
    a += s.weight * s.lab.a;
    b += s.weight * s.lab.b;
  }
  return { L: L / w, a: a / w, b: b / w };
}

/**
 * Step 4: weighted k-means in Oklab (plain Euclidean) with a deterministic
 * start: the samples sorted by lightness and cut into k equal runs, each
 * run's mean a starting centre. Returns the centre of the heaviest cluster
 * (ties to the darker start).
 */
function heaviestCluster(list: readonly Sample[]): Oklab {
  const order = list
    .map((s, i) => ({ s, i }))
    .sort((p, q) => p.s.lab.L - q.s.lab.L || p.i - q.i)
    .map((e) => e.s);
  const k = Math.min(PICK.k, order.length);
  const centres: Oklab[] = [];
  for (let c = 0; c < k; c += 1) {
    const from = Math.floor((c * order.length) / k);
    const to = Math.floor(((c + 1) * order.length) / k);
    centres.push(weightedMean(order.slice(from, to)));
  }

  const assigned = new Int32Array(list.length).fill(-1);
  for (let iter = 0; iter < PICK.maxIterations; iter += 1) {
    let moved = false;
    for (let i = 0; i < list.length; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c += 1) {
        const d = deltaEOKSquared(list[i].lab, centres[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assigned[i] !== best) {
        assigned[i] = best;
        moved = true;
      }
    }
    if (!moved) break;
    for (let c = 0; c < k; c += 1) {
      const members = list.filter((_, i) => assigned[i] === c);
      // An emptied cluster keeps its centre; it weighs nothing below.
      if (members.length > 0) centres[c] = weightedMean(members);
    }
  }

  const weights = new Array<number>(k).fill(0);
  for (let i = 0; i < list.length; i += 1) {
    weights[assigned[i]] += list[i].weight;
  }
  let heaviest = 0;
  for (let c = 1; c < k; c += 1) {
    if (weights[c] > weights[heaviest]) heaviest = c;
  }
  return centres[heaviest];
}

/** Steps 5-6: the body colour to a family, with the item's hue as the prior. */
export function matchFamily(
  body: Oklab,
  hue?: string | null,
): Omit<PickResult, "hex"> {
  const ranked = REFS.map((r) => ({ key: r.key, d: deltaEOK2(body, r.lab) }))
    // Stable: equal distances keep the family list's order.
    .sort((p, q) => p.d - q.d);
  const distanceTo = (key: BackdropKey) => ranked.find((r) => r.key === key)!.d;
  const prior = familyForHue(hue);

  // 5a. The item's own family, if the photo agrees with it closely enough.
  if (prior && distanceTo(prior) <= PICK.acceptRadius) {
    return { family: prior, distance: distanceTo(prior), reason: "prior" };
  }

  // 5. A neutral body carries no hue to match: split by lightness.
  if (chroma(body) < PICK.neutralC) {
    const family: BackdropKey =
      body.L < PICK.neutralSplitL ? "espresso" : "latte";
    return { family, distance: distanceTo(family), reason: "neutral" };
  }

  const [first, second] = ranked;
  // 6. Nothing close enough: leave it to the app's hue and category.
  if (first.d > PICK.acceptRadius) {
    return { family: null, distance: first.d, reason: "far" };
  }
  // 5b. No coin toss between two near-equal families.
  if (second.d - first.d < PICK.tieMargin) {
    if (prior === first.key || prior === second.key) {
      return {
        family: prior,
        distance: distanceTo(prior),
        reason: "tie-prior",
      };
    }
    return { family: null, distance: first.d, reason: "tie" };
  }
  return { family: first.key, distance: first.d, reason: "nearest" };
}

export function pickBackdrop(input: PickInput): PickResult {
  if (input.category && NO_AUTO_PICK_CATEGORIES.includes(input.category)) {
    return { family: null, hex: null, distance: null, reason: "category" };
  }
  const list = samples(input);
  if (list.length === 0) {
    return { family: null, hex: null, distance: null, reason: "empty" };
  }
  const body = heaviestCluster(list);
  return { ...matchFamily(body, input.hue), hex: oklabToHex(body) };
}
