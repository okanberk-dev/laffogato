import "server-only";

import {
  compressImage,
  dataImageBytes,
  imageStoreConfigFrom,
  isStoredImageUrl,
  normalizePublicBaseUrl,
  putImageObject,
  IMAGE_MAX_UPLOAD_BYTES,
  IMAGE_STORE_TIMEOUT_MS,
  type ImageStoreConfig,
} from "./store-core.mjs";

/**
 * The photo store as the app uses it (rules: `./store-core.mjs`).
 *
 * `uploadImage` is the one way a panel upload reaches the bucket: the bytes
 * are compressed here, on the server, with the same settings the move of the
 * old data URLs used (`scripts/images-to-r2.mjs`), named by their content
 * and uploaded once. The row then stores only the URL.
 */

export type { ImageStoreConfig };

/** The store's configuration, or null (the panel keeps data URLs then). */
export function imageStoreConfig(): ImageStoreConfig | null {
  return imageStoreConfigFrom(process.env);
}

export function imageStoreConfigured(): boolean {
  return imageStoreConfig() !== null;
}

/** The bucket's public base URL, or null when no store is configured. */
export function imageStoreBaseUrl(): string | null {
  return imageStoreConfig()?.publicBaseUrl ?? null;
}

/** True when `value` is a photo our store wrote (see `isStoredImageUrl`). */
export function isOwnImageUrl(value: string): boolean {
  return isStoredImageUrl(
    value,
    normalizePublicBaseUrl(process.env.IMAGES_PUBLIC_BASE_URL),
  );
}

async function loadSharp() {
  return (await import("sharp")).default;
}

export class ImageUploadError extends Error {
  constructor(
    /** Turkish, shown to the operator as it is. */
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/**
 * Compresses and uploads one photo; returns its public URL. Throws
 * `ImageUploadError` with a Turkish message the panel can show.
 */
export async function uploadImage(bytes: Uint8Array): Promise<string> {
  const config = imageStoreConfig();
  if (!config) {
    throw new ImageUploadError("Görsel deposu ayarlı değil.", 503);
  }
  if (bytes.length === 0) {
    throw new ImageUploadError("Dosya boş.", 400);
  }
  if (bytes.length > IMAGE_MAX_UPLOAD_BYTES) {
    throw new ImageUploadError("Dosya 12 MB'ı aşıyor.", 413);
  }
  let compressed;
  try {
    compressed = await compressImage(await loadSharp(), bytes);
  } catch {
    throw new ImageUploadError(
      "Bu dosya okunamadı. JPEG, PNG ya da WebP yükle.",
      415,
    );
  }
  try {
    const { url } = await putImageObject(config, compressed);
    return url;
  } catch (error) {
    // The status only: the store's answer can echo the request.
    console.error(
      "[images] upload failed:",
      error instanceof Error ? error.message : "unknown",
    );
    throw new ImageUploadError(
      "Görsel depoya yüklenemedi. Biraz sonra yeniden dene.",
      502,
    );
  }
}

/** The most bytes `readStoredImage` downloads. */
const READ_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The bytes of a photo this store wrote, read back from its public URL (the
 * scene pick reads the photo being saved, `src/lib/backdrop/scene.ts`).
 * null for any other value, an answer that is not 200, or a body over 8 MB.
 * Never throws.
 */
export async function readStoredImage(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer | null> {
  const inline = dataImageBytes(value);
  if (inline) return inline;
  if (!isOwnImageUrl(value)) return null;
  try {
    const res = await fetchImpl(value, {
      signal: AbortSignal.timeout(IMAGE_STORE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > READ_MAX_BYTES) return null;
    const body = Buffer.from(await res.arrayBuffer());
    return body.length > 0 && body.length <= READ_MAX_BYTES ? body : null;
  } catch {
    return null;
  }
}

/** What the panel says when a save carries a new data URL (Turkish). */
export const NEW_DATA_IMAGE_REFUSAL =
  "Bu fotoğraf eski yoldan geldi ve kaydedilmedi. Sayfayı yenileyip fotoğrafı yeniden yükle.";

/**
 * True when this save would store a `data:image/...` value the row did not
 * already hold, on a deployment that has the photo store.
 *
 * New uploads go to the store and arrive as URLs (`/admin/gorsel-yukle`);
 * a data URL in a save is then a form opened before the deploy, or a
 * hand-made request, and would fill the database with photographs again.
 * A data URL the row already holds is let through unchanged: the edit forms
 * post an item's stored photos back on every save, and the rows not yet
 * moved (`scripts/images-to-r2.mjs`) must stay editable. Without a store the
 * panel stores data URLs as before.
 */
export function refusesNewDataImages(
  next: readonly (string | null | undefined)[],
  previous: readonly (string | null | undefined)[],
): boolean {
  if (!imageStoreConfigured()) return false;
  const kept = new Set(previous.filter((v): v is string => !!v));
  return next.some(
    (v) => typeof v === "string" && v.startsWith("data:") && !kept.has(v),
  );
}
