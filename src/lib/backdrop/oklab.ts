/**
 * sRGB ↔ Oklab, OKLCH and the ΔEOK2 difference the backdrop pick measures
 * with.
 *
 * Oklab is Björn Ottosson's perceptual colour space ("A perceptual color space
 * for image processing", bottosson.github.io/posts/oklab/, 2020). The
 * matrices below are the ones published on that page, which places them in
 * the public domain; CSS Color 4 uses the same space. Pure and client-safe.
 */

export interface Oklab {
  /** Lightness, 0 (black) to 1 (white). */
  L: number;
  a: number;
  b: number;
}

export interface Oklch {
  L: number;
  /** Chroma, the distance from the grey axis. */
  C: number;
  /** Hue angle in degrees, 0 to 360; 0 for a grey. */
  h: number;
}

/** sRGB transfer function: an encoded channel (0-1) to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Inverse transfer function: linear light to an encoded channel (0-1). */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Non-linear LMS to Lab (Ottosson's M2). */
function lmsToLab(l: number, m: number, s: number): Oklab {
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Linear sRGB (0-1 per channel) to Oklab. */
export function linearSrgbToOklab(r: number, g: number, b: number): Oklab {
  return lmsToLab(
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  );
}

/**
 * CIE XYZ (D65) to Oklab, through Ottosson's M1. Only the reference table on
 * his page is given in XYZ, so this exists to test against it.
 */
export function xyzToOklab(x: number, y: number, z: number): Oklab {
  return lmsToLab(
    0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z,
    0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z,
    0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z,
  );
}

/** Oklab to linear sRGB; may leave 0-1 for a colour outside sRGB. */
export function oklabToLinearSrgb(lab: Oklab): [number, number, number] {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Linear light for every 8-bit channel value. The pick converts up to 4096
 * pixels per photo; a table keeps `pow` out of that loop.
 */
const LINEAR_8BIT: readonly number[] = Array.from({ length: 256 }, (_, i) =>
  srgbToLinear(i / 255),
);

/** An 8-bit sRGB colour (0-255 per channel) to Oklab. */
export function srgb8ToOklab(r: number, g: number, b: number): Oklab {
  return linearSrgbToOklab(LINEAR_8BIT[r], LINEAR_8BIT[g], LINEAR_8BIT[b]);
}

/** `#RRGGBB` (or `RRGGBB`) to Oklab. Throws on anything else. */
export function hexToOklab(hex: string): Oklab {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return srgb8ToOklab((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
}

function channelToHex(linear: number): string {
  const encoded = linearToSrgb(Math.min(1, Math.max(0, linear)));
  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Oklab to `#RRGGBB`, each channel clipped into sRGB. */
export function oklabToHex(lab: Oklab): string {
  const [r, g, b] = oklabToLinearSrgb(lab);
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

/** Chroma: how far the colour sits from the grey axis. */
export function chroma(lab: Oklab): number {
  return Math.hypot(lab.a, lab.b);
}

export function toOklch(lab: Oklab): Oklch {
  const C = chroma(lab);
  if (C === 0) return { L: lab.L, C: 0, h: 0 };
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return { L: lab.L, C, h: h < 0 ? h + 360 : h };
}

/**
 * ΔEOK2: the Oklab distance with a and b doubled.
 *
 * Plain ΔEOK weighs a step in hue or chroma less than the same step in
 * lightness; doubling a and b evens that out, so one unit reads alike in every
 * direction (the measure lafmobil docs/DESIGN-GLASS.md §6.5 specifies, where
 * ~0.02 is one just-noticeable step). The pick's thresholds (accept 0.10, tie
 * 0.03) are in this unit.
 */
export function deltaEOK2(p: Oklab, q: Oklab): number {
  const dL = p.L - q.L;
  const da = 2 * (p.a - q.a);
  const db = 2 * (p.b - q.b);
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Squared plain ΔEOK (Euclidean Oklab), for the clustering loop where only
 * the order matters. Clustering groups the photo's colours as they are; the
 * doubled a and b of ΔEOK2 belong to the match against the family refs.
 */
export function deltaEOKSquared(p: Oklab, q: Oklab): number {
  const dL = p.L - q.L;
  const da = p.a - q.a;
  const db = p.b - q.b;
  return dL * dL + da * da + db * db;
}
