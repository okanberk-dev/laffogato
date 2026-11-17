/**
 * The journey's frames, as the bundler serves them.
 *
 * The sequence is 120 pictures, each with a depth map, in two cuts: `wide`
 * (16:9, for screens wider than they are tall) and `tall` (9:16, phones).
 * They are NOT 240 files per cut. Each cut is five packs: the frames' own
 * WebP bytes laid end to end, with frames/index.json saying where each one
 * starts. A visit therefore costs five requests for the whole journey, not
 * 240 (Vercel counts every request to a static file, and went over its
 * limit on 14 Kas 2026: CLAUDE.md "Vercel kullanım sınırı").
 *
 * The packs are imported with `?url`, so they are emitted under
 * `_next/static/media` with a content hash: cached for a year, immutable,
 * and outside the proxy's matcher. They are produced by
 * docs/journey/pack.py from the frames docs/journey/scene.py renders.
 */
import index from "./frames/index.json";

export type FrameCut = "wide" | "tall";

/** One frame inside a pack: where its colour and its depth bytes lie. */
export interface PackedFrame {
  index: number;
  colour: readonly [offset: number, length: number];
  depth: readonly [offset: number, length: number];
}

export interface FramePack {
  url: string;
  frames: PackedFrame[];
}

const at = (file: URL) => file.pathname + file.search;
const wide0 = at(new URL("./frames/wide-0.bin", import.meta.url));
const wide1 = at(new URL("./frames/wide-1.bin", import.meta.url));
const wide2 = at(new URL("./frames/wide-2.bin", import.meta.url));
const wide3 = at(new URL("./frames/wide-3.bin", import.meta.url));
const wide4 = at(new URL("./frames/wide-4.bin", import.meta.url));
const tall0 = at(new URL("./frames/tall-0.bin", import.meta.url));
const tall1 = at(new URL("./frames/tall-1.bin", import.meta.url));
const tall2 = at(new URL("./frames/tall-2.bin", import.meta.url));
const tall3 = at(new URL("./frames/tall-3.bin", import.meta.url));
const tall4 = at(new URL("./frames/tall-4.bin", import.meta.url));

const URLS: Record<string, string> = {
  "wide-0.bin": wide0,
  "wide-1.bin": wide1,
  "wide-2.bin": wide2,
  "wide-3.bin": wide3,
  "wide-4.bin": wide4,
  "tall-0.bin": tall0,
  "tall-1.bin": tall1,
  "tall-2.bin": tall2,
  "tall-3.bin": tall3,
  "tall-4.bin": tall4,
};

function packs(cut: FrameCut): FramePack[] {
  return index[cut].packs.map((pack) => ({
    url: URLS[pack.file],
    frames: pack.frames.map(([frame, c0, c1, d0, d1]) => ({
      index: frame,
      colour: [c0, c1] as const,
      depth: [d0, d1] as const,
    })),
  }));
}

export const FRAME_PACKS: Record<FrameCut, FramePack[]> = {
  wide: packs("wide"),
  tall: packs("tall"),
};

/** The pack that holds frame 0 of a cut: the one worth preloading. */
export const FIRST_PACK_URL: Record<FrameCut, string> = {
  wide: wide0,
  tall: tall0,
};
