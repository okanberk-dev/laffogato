import "server-only";

import { decodeDataImage } from "@/lib/admin/image-bytes";

import { BACKDROP_ALGO_VERSION } from "./families";
import { pickBackdrop, type PickResult } from "./pick";

/**
 * Reads a stored photo into the small RGBA sample `pick.ts` works on, and runs
 * the pick (lafmobil docs/DESIGN-GLASS.md §6.5 step 1).
 *
 * Server only: `sharp` is native. The panel's save actions call
 * `backdropFromImage` after the uploaded data URL has been validated, and
 * `scripts/backfill-backdrops.mjs` calls it for photos already stored.
 */

/** The sample's longest side. Plenty for a body colour, and ~4096 pixels at most. */
export const SAMPLE_SIZE = 64;

/**
 * The most pixels (width x height, as the file's header declares them) a
 * photo may have before sharp decodes it. The panel's uploader never stores
 * more than 1600 px on the long side (2.6 MP) and the bundled menu photos are
 * 1024 px, so this only stops a hand-made file: a small PNG that declares a
 * huge canvas would otherwise be decoded up to sharp's own default (268 MP)
 * in the memory of one save. Such a photo reads as unreadable, like any
 * bytes sharp refuses.
 */
export const MAX_INPUT_PIXELS = 4096 * 4096;

/**
 * sharp, loaded on first use instead of at module top. It is native: a
 * deploy whose function lacked the platform binary used to fail on import,
 * and with it every action in the menu and product action files (saves,
 * deletes and bulk edits alike). Loaded here, a sharp that will not load
 * costs only the scene pick: the photo reads as unreadable and the save goes
 * on (`scene.ts`).
 */
async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch (error) {
    console.error(
      "[backdrop] sharp could not be loaded, saving without a scene pick:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export interface ImageSample {
  /** RGBA, 4 bytes per pixel, row-major. */
  pixels: Uint8Array;
  width: number;
  height: number;
  /** No pixel of the sample is transparent. */
  isOpaque: boolean;
}

/**
 * A stored image (`data:image/...;base64,...`) or its bytes → the sample, or
 * null when it is not an image sharp can read: bytes it refuses, a canvas
 * over `MAX_INPUT_PIXELS`, or no sharp at all. An `https://` URL is not
 * fetched here: the caller decides whether a remote photo is read at all.
 */
export async function sampleImage(
  input: Buffer | Uint8Array | string,
): Promise<ImageSample | null> {
  const bytes =
    typeof input === "string" ? (decodeDataImage(input)?.body ?? null) : input;
  if (!bytes || bytes.length === 0) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    // `rotate()` with no angle applies the EXIF orientation, so the centre
    // weighting lands on what the camera saw as the centre.
    const { data, info } = await sharp(bytes, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // `stats()` on the pipeline above would describe the ORIGINAL input, not
    // the resized one, so the sample is written out first and measured as a
    // raw image of its own.
    const { isOpaque } = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).stats();
    return {
      pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width: info.width,
      height: info.height,
      isOpaque,
    };
  } catch {
    return null;
  }
}

export interface ImageBackdrop {
  /** The stored photo has transparency: the app draws it on the scene, uncut. */
  photoCutout: boolean;
  pick: PickResult;
  /** The algorithm that made the pick (`BACKDROP_ALGO_VERSION`). */
  version: string;
}

/**
 * The scene for a stored photo, with the item's `hue` as the prior and its
 * category (a `gear` or `merch` product gets no automatic pick). null when
 * the photo cannot be read; the caller then keeps what it had.
 */
export async function backdropFromImage(
  input: Buffer | Uint8Array | string,
  item: { hue?: string | null; category?: string | null },
): Promise<ImageBackdrop | null> {
  const sample = await sampleImage(input);
  if (!sample) return null;
  return {
    photoCutout: !sample.isOpaque,
    pick: pickBackdrop({ ...sample, hue: item.hue, category: item.category }),
    version: BACKDROP_ALGO_VERSION,
  };
}
