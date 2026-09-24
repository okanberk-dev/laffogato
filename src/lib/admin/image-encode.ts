/**
 * How the panel's uploader turns a picked file into the data URL it stores
 * (glass round G5; lafmobil docs/DESIGN-GLASS.md §6.5 "Yükleme").
 *
 * Client-safe and pure: `image-upload.tsx` hands it a drawing surface backed
 * by a real canvas, the tests hand it a fake one. Nothing here touches the
 * DOM.
 *
 * - An opaque photo is stored as JPEG 0.82, as before.
 * - A photo with transparency (a cutout: any pixel with alpha below 255) is
 *   stored with its transparency, as WebP 0.9. The app draws such a photo
 *   straight onto its scene, and the server marks it `photoCutout`. It used
 *   to be flattened onto white and stored as a JPEG.
 * - A browser whose canvas cannot encode WebP (Safari answers a WebP request
 *   with a PNG) stores the cutout as PNG. The prefix of the answer is read,
 *   never assumed.
 * - Whatever the format, a result longer than the server's cap is drawn
 *   again smaller, step by step, until it fits; when even the smallest step
 *   does not, the operator gets a Turkish message. The server drops an
 *   oversize photo without a word (`product-schema.ts`, the menu action), so
 *   this is the only place that can say it.
 */

/** Longest side of a stored photo, in pixels. */
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;
export const WEBP_QUALITY = 0.9;

/**
 * The longest stored data URL the server keeps, in characters (the whole
 * `data:image/...;base64,...` string). The product schema and the menu
 * action read this same constant.
 */
export const MAX_STORED_IMAGE_LENGTH = 2 * 1024 * 1024;

/** Each downscale step keeps this share of the longest side. */
export const DOWNSCALE_STEP = 0.85;

/**
 * The smallest longest side a downscale may reach. The app draws a product
 * about 250 pt tall on its stage (750 px on a 3x screen); below this a photo
 * is too soft to be worth storing, and the operator is better told.
 */
export const MIN_DIMENSION = 512;

export type StoredImageFormat = "jpeg" | "webp" | "png";

/** One drawing of the source at a given size. */
export interface EncodeCanvas {
  /** True when any pixel has alpha below 255. */
  hasTransparency(): boolean;
  /** `HTMLCanvasElement.toDataURL`: the browser may answer another type. */
  toDataURL(type: string, quality?: number): string;
}

/** The picked file, decoded, and a way to draw it at any size. */
export interface EncodeSource {
  width: number;
  height: number;
  /** Draws the whole source scaled to `width` × `height` on a fresh canvas. */
  draw(width: number, height: number): EncodeCanvas;
}

export interface EncodedImage {
  dataUrl: string;
  format: StoredImageFormat;
  width: number;
  height: number;
  /** The source had transparency, and the stored photo keeps it. */
  transparent: boolean;
}

/** A failure the uploader shows to the operator as it is (Turkish). */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** True when any pixel of an RGBA buffer is not fully opaque. */
export function hasTransparentPixel(rgba: ArrayLike<number>): boolean {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 255) return true;
  }
  return false;
}

/** The size a source is first drawn at: its own, or 1600 px on the long side. */
export function fitWithin(
  width: number,
  height: number,
  longest: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  const scale = long > longest ? longest / long : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The format a data URL actually carries, from its prefix. */
export function dataUrlFormat(dataUrl: string): StoredImageFormat | null {
  if (dataUrl.startsWith("data:image/jpeg")) return "jpeg";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  if (dataUrl.startsWith("data:image/png")) return "png";
  return null;
}

/**
 * Encodes one drawing. A transparent drawing asks for WebP and takes the PNG
 * the browser may answer instead; an opaque one is a JPEG. A result with no
 * image in it (`data:,`, a canvas too large for the browser) is an error.
 */
function encode(
  canvas: EncodeCanvas,
  transparent: boolean,
  fileName: string,
): { dataUrl: string; format: StoredImageFormat } {
  const dataUrl = transparent
    ? canvas.toDataURL("image/webp", WEBP_QUALITY)
    : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const format = dataUrlFormat(dataUrl);
  if (!format || (!transparent && format !== "jpeg")) {
    throw new UploadError(`${fileName} kaydedilecek biçime çevrilemedi.`);
  }
  if (transparent && format === "jpeg") {
    // A JPEG has no alpha: the cutout would be stored on a black ground.
    throw new UploadError(`${fileName} saydamlığıyla kaydedilemedi.`);
  }
  return { dataUrl, format };
}

export function encodeForUpload(
  source: EncodeSource,
  fileName: string,
): EncodedImage {
  let { width, height } = fitWithin(source.width, source.height, MAX_DIMENSION);
  const first = source.draw(width, height);
  const transparent = first.hasTransparency();
  let { dataUrl, format } = encode(first, transparent, fileName);

  while (dataUrl.length > MAX_STORED_IMAGE_LENGTH) {
    const nextLong = Math.floor(Math.max(width, height) * DOWNSCALE_STEP);
    if (nextLong < MIN_DIMENSION) {
      throw new UploadError(tooLargeMessage(fileName, format));
    }
    ({ width, height } = fitWithin(width, height, nextLong));
    ({ dataUrl, format } = encode(
      source.draw(width, height),
      transparent,
      fileName,
    ));
  }

  return { dataUrl, format, width, height, transparent };
}

function tooLargeMessage(fileName: string, format: StoredImageFormat): string {
  const base = `${fileName} küçültülse de 2 MB sınırına sığmadı.`;
  if (format === "png") {
    // Only a browser that cannot encode WebP gets here with a cutout.
    return `${base} Bu tarayıcı saydam fotoğrafı WebP'ye çeviremiyor; Chrome ya da Firefox ile yüklemeyi dene.`;
  }
  return `${base} Daha küçük bir dosya dene.`;
}
