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
 * - The form posts all of an item's photos on every save, so their total is
 *   capped too (`MAX_UPLOAD_TOTAL_LENGTH`): a photo that would pass it is
 *   refused here with a Turkish message, before the platform refuses the
 *   whole save.
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

/**
 * The most one save may post for a photo field, in characters of the JSON
 * the uploader puts in its hidden input. The form posts every photo of the
 * item on every save, stored ones included, so this is also the most a
 * product's photos can add up to through the panel.
 *
 * A Vercel Function refuses a request body over 4.5 MB with 413
 * `FUNCTION_PAYLOAD_TOO_LARGE` before the action runs, and Next's
 * `bodySizeLimit` cannot raise that platform ceiling. The panel's error page
 * then replaces the product wizard and every unsaved field is lost. Two or
 * three transparent photos stored as PNG (a browser that cannot encode WebP)
 * reach the ceiling. 4 MB leaves room for the rest of the form.
 */
export const MAX_UPLOAD_TOTAL_LENGTH = 4 * 1024 * 1024;

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

/** The length of the uploader's hidden field for these photos. */
export function uploadFieldLength(images: readonly string[]): number {
  return JSON.stringify(images).length;
}

export interface UploadFit {
  /** The photos that fit, in the order they came. */
  accepted: string[];
  /** Indexes into `incoming` of the photos that do not fit. */
  refused: number[];
  /** The hidden field's length with the accepted photos added. */
  length: number;
  /** The length the first refused photo would have given; 0 when none. */
  refusedLength: number;
}

/**
 * Which of the freshly added photos still fit in one save next to the photos
 * the field already holds, measured the way the form posts them (the JSON
 * array, quotes and commas included). They are taken in order; one that does
 * not fit is left out and a later, smaller one may still fit.
 */
export function fitUploadTotal(
  current: readonly string[],
  incoming: readonly string[],
  limit: number = MAX_UPLOAD_TOTAL_LENGTH,
): UploadFit {
  let length = uploadFieldLength(current);
  let count = current.length;
  let refusedLength = 0;
  const accepted: string[] = [];
  const refused: number[] = [];
  incoming.forEach((photo, index) => {
    const added = JSON.stringify(photo).length + (count > 0 ? 1 : 0);
    if (length + added > limit) {
      refused.push(index);
      if (refusedLength === 0) refusedLength = length + added;
      return;
    }
    length += added;
    count += 1;
    accepted.push(photo);
  });
  return { accepted, refused, length, refusedLength };
}

/**
 * A field length in MB for the operator (tr-TR, at most one decimal),
 * rounded up: a total over the limit never reads as the limit itself.
 */
export function formatUploadMB(length: number): string {
  const mb = Math.ceil((length / (1024 * 1024)) * 10) / 10;
  return mb.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

/**
 * Why the photos at `names` were left out: the item's photos would pass the
 * one-save total (`length` characters with them). When a PNG is among them,
 * the operator is told the cause and the way out: only a browser that cannot
 * encode WebP stores a cutout as PNG, and a PNG cutout is several times the
 * size of the same photo in WebP.
 */
export function uploadTotalMessage(
  names: readonly string[],
  length: number,
  hasPng: boolean,
): string {
  const who = names.length === 1 ? names[0] : names.join(", ");
  const base = `${who} eklenmedi: bu ürünün fotoğrafları toplamda ${formatUploadMB(length)} MB olurdu, tek kayıtta en çok ${formatUploadMB(MAX_UPLOAD_TOTAL_LENGTH)} MB gönderilebilir. Önce bir fotoğrafı kaldır ya da daha küçük bir dosya seç.`;
  if (!hasPng) return base;
  return `${base} Bu tarayıcı saydam fotoğrafı PNG olarak saklıyor; Chrome ya da Firefox ile yüklersen WebP olur ve çok daha az yer tutar.`;
}

/**
 * The standing note for an item whose stored photos already pass the
 * one-save total (saved before this limit existed). Adding is refused, but a
 * save would still post them all, so the operator is told before saving.
 */
export function uploadTotalNotice(length: number): string {
  return `Bu ürünün fotoğrafları toplamda ${formatUploadMB(length)} MB; tek kayıtta en çok ${formatUploadMB(MAX_UPLOAD_TOTAL_LENGTH)} MB gönderilebilir. Kaydetmeden önce bir fotoğrafı kaldır: kayıt reddedilirse formdaki değişiklikler kaybolur.`;
}

function tooLargeMessage(fileName: string, format: StoredImageFormat): string {
  const base = `${fileName} küçültülse de 2 MB sınırına sığmadı.`;
  if (format === "png") {
    // Only a browser that cannot encode WebP gets here with a cutout.
    return `${base} Bu tarayıcı saydam fotoğrafı WebP'ye çeviremiyor; Chrome ya da Firefox ile yüklemeyi dene.`;
  }
  return `${base} Daha küçük bir dosya dene.`;
}
