/**
 * The photo store: Cloudflare R2 (S3-compatible), 26 Kas 2026.
 *
 * Panel uploads used to be stored as base64 `data:image/...` values in the
 * rows themselves. Every list query, dump and restore carried them, and the
 * database's monthly transfer quota on Neon ran out on photographs (5.5 GB
 * against 5 GB; the site was without its database for two days). Photos now
 * live in a bucket; a row holds only the public URL.
 *
 * Plain JavaScript, like `src/lib/db/database-url.mjs`, so the app
 * (`./store.ts`) and the one-off move (`scripts/images-to-r2.mjs`) share one
 * compression rule, one key rule and one signer. No SDK: an object PUT and a
 * HEAD are two signed requests (AWS Signature Version 4, which R2 speaks),
 * not worth a dependency of several megabytes.
 *
 * Configuration (Vercel; never written to code or logs):
 *
 * - `IMAGES_S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
 * - `IMAGES_S3_BUCKET`: `laffogato-foto`
 * - `IMAGES_S3_ACCESS_KEY_ID`, `IMAGES_S3_SECRET_ACCESS_KEY`
 * - `IMAGES_PUBLIC_BASE_URL`: the bucket's public address (a custom domain,
 *   or its `https://pub-….r2.dev` address)
 *
 * Without all five the store is "not configured": the panel keeps storing
 * data URLs as before (`./store.ts`), so a deploy that lands before the
 * variables does not take uploads away.
 */

import { createHash, createHmac } from "node:crypto";

import {
  imagePublicUrl,
  isStoredImageUrl,
  normalizePublicBaseUrl,
} from "./url-core.mjs";

export { imagePublicUrl, isStoredImageUrl, normalizePublicBaseUrl };

/** Longest side of a stored photo, in pixels (the uploader's own number). */
export const IMAGE_MAX_DIMENSION = 1600;
/** WebP quality of a stored photo. */
export const IMAGE_WEBP_QUALITY = 80;
/**
 * Pixels sharp will decode at most (a decompression bomb guard). 1600 px on
 * the long side is the output; inputs are phone photos (48 MP at most).
 */
export const IMAGE_MAX_INPUT_PIXELS = 50_000_000;
/** The most bytes one upload may carry. */
export const IMAGE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Every object is named by its content, so it can be cached forever. */
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** Hex digits of the SHA-256 in the object key. */
export const IMAGE_KEY_HASH_LENGTH = 16;

/** The five variables, by role. */
export const IMAGE_STORE_VARS = Object.freeze({
  endpoint: "IMAGES_S3_ENDPOINT",
  bucket: "IMAGES_S3_BUCKET",
  accessKeyId: "IMAGES_S3_ACCESS_KEY_ID",
  secretAccessKey: "IMAGES_S3_SECRET_ACCESS_KEY",
  publicBaseUrl: "IMAGES_PUBLIC_BASE_URL",
});

/**
 * @typedef {{
 *   endpoint: string,
 *   bucket: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   publicBaseUrl: string,
 *   region: string,
 * }} ImageStoreConfig
 */

/**
 * The store's configuration, or null when any of the five is missing or
 * malformed. Never throws and never echoes a value.
 *
 * @param {Record<string, string | undefined>} env usually `process.env`
 * @returns {ImageStoreConfig | null}
 */
export function imageStoreConfigFrom(env) {
  const read = (/** @type {string} */ name) => (env[name] ?? "").trim();
  const endpointRaw = read(IMAGE_STORE_VARS.endpoint);
  const bucket = read(IMAGE_STORE_VARS.bucket);
  const accessKeyId = read(IMAGE_STORE_VARS.accessKeyId);
  const secretAccessKey = read(IMAGE_STORE_VARS.secretAccessKey);
  const publicBaseUrl = normalizePublicBaseUrl(
    env[IMAGE_STORE_VARS.publicBaseUrl],
  );
  if (!endpointRaw || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!publicBaseUrl) return null;
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  let endpoint;
  try {
    const url = new URL(endpointRaw);
    if (url.protocol !== "https:") return null;
    endpoint = url.origin;
  } catch {
    return null;
  }
  // R2 takes "auto"; another S3 host may name its region in IMAGES_S3_REGION.
  const region = read("IMAGES_S3_REGION") || "auto";
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    region,
  };
}

/**
 * The object key for these bytes: `img/<first 16 hex of SHA-256>.<ext>`.
 * The same photo always lands on the same key, so it is uploaded once.
 *
 * @param {Uint8Array} bytes the stored (compressed) bytes
 * @param {string} ext "webp", "jpg", "png", ...
 * @returns {string}
 */
export function imageObjectKey(bytes, ext) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return `img/${hash.slice(0, IMAGE_KEY_HASH_LENGTH)}.${ext}`;
}

/** The formats a stored photo may keep when WebP would be larger. */
const FORMAT_EXT = Object.freeze({
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  avif: "avif",
});

/**
 * @param {string} format sharp's metadata format
 * @returns {{ ext: string, contentType: string } | null}
 */
export function formatInfo(format) {
  const ext = /** @type {Record<string, string>} */ (FORMAT_EXT)[format];
  if (!ext) return null;
  return { ext, contentType: `image/${format}` };
}

/**
 * @typedef {{ body: Buffer, contentType: string, ext: string, width: number, height: number, kept: boolean }} CompressedImage
 */

/**
 * Compresses one photo the same way everywhere (the panel's upload and the
 * move of the stored data URLs):
 *
 * - `rotate()`: applies the EXIF orientation;
 * - fits inside 1600 × 1600, never enlarging;
 * - WebP at quality 80 (alpha kept: a cutout stays a cutout);
 * - no metadata (sharp writes none unless asked);
 * - when the WebP would be larger than what came in, the original bytes are
 *   kept in their own format (`kept: true`).
 *
 * Throws when sharp cannot read the bytes or they are not a photo format
 * the site serves.
 *
 * @param {import("sharp").SharpConstructor} sharp `(await import("sharp")).default`
 * @param {Uint8Array} input
 * @returns {Promise<CompressedImage>}
 */
export async function compressImage(sharp, input) {
  const source = sharp(input, {
    limitInputPixels: IMAGE_MAX_INPUT_PIXELS,
    failOn: "error",
  });
  const meta = await source.metadata();
  const original = formatInfo(meta.format ?? "");
  if (!original) {
    throw new Error(`unsupported image format: ${meta.format ?? "unknown"}`);
  }
  const { data, info } = await sharp(input, {
    limitInputPixels: IMAGE_MAX_INPUT_PIXELS,
    failOn: "error",
  })
    .rotate()
    .resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  if (data.length > input.length) {
    // The original is smaller as it is (a small, already compressed JPEG).
    // Its EXIF orientation is applied by every browser and by the app.
    return {
      body: Buffer.from(input),
      contentType: original.contentType,
      ext: original.ext,
      width: meta.autoOrient?.width ?? meta.width ?? info.width,
      height: meta.autoOrient?.height ?? meta.height ?? info.height,
      kept: true,
    };
  }
  return {
    body: data,
    contentType: "image/webp",
    ext: "webp",
    width: info.width,
    height: info.height,
    kept: false,
  };
}

// ─── AWS Signature Version 4 (the subset an object PUT / HEAD needs) ──────

/** @param {string | Uint8Array} data */
function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * @param {Buffer | string} key
 * @param {string} data
 */
function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

/** RFC 3986 encoding of one path segment, as S3 expects it. */
function encodeSegment(/** @type {string} */ segment) {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Signs one request to the bucket. Returns the URL and the headers to send
 * (the payload hash is signed, so the body cannot be swapped in transit).
 *
 * @param {ImageStoreConfig} config
 * @param {{ method: string, key: string, body?: Uint8Array, headers?: Record<string, string>, now?: Date }} request
 * @returns {{ url: string, headers: Record<string, string> }}
 */
export function signImageRequest(config, request) {
  const now = request.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20261126T120000Z
  const day = amzDate.slice(0, 8);
  const host = new URL(config.endpoint).host;
  const path = `/${encodeSegment(config.bucket)}/${request.key
    .split("/")
    .map(encodeSegment)
    .join("/")}`;
  const payloadHash = sha256Hex(request.body ?? "");

  /** @type {Record<string, string>} */
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    headers[name.toLowerCase()] = String(value).trim();
  }
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    request.method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${day}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${config.secretAccessKey}`, day);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const { host: _host, ...sent } = headers;
  return {
    url: `${config.endpoint}${path}`,
    headers: {
      ...sent,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** How long one request to the bucket may take. */
export const IMAGE_STORE_TIMEOUT_MS = 20_000;

/**
 * True when the object is already there (HEAD 200), false on 404. Any other
 * answer throws: a refused key must not read as "missing" and upload again
 * under a wrong assumption, nor as "present" and skip the upload.
 *
 * @param {ImageStoreConfig} config
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<boolean>}
 */
export async function imageObjectExists(config, key, fetchImpl = fetch) {
  const { url, headers } = signImageRequest(config, { method: "HEAD", key });
  const res = await fetchImpl(url, {
    method: "HEAD",
    headers,
    signal: AbortSignal.timeout(IMAGE_STORE_TIMEOUT_MS),
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`image store HEAD ${res.status}`);
}

/**
 * Uploads one object (skipped when the same key is already there) and
 * returns its public URL. Errors name the HTTP status, never the response
 * body or the credentials.
 *
 * @param {ImageStoreConfig} config
 * @param {{ body: Uint8Array, contentType: string, ext: string }} image
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ key: string, url: string, uploaded: boolean }>}
 */
export async function putImageObject(config, image, fetchImpl = fetch) {
  const key = imageObjectKey(image.body, image.ext);
  const url = imagePublicUrl(config.publicBaseUrl, key);
  if (await imageObjectExists(config, key, fetchImpl)) {
    return { key, url, uploaded: false };
  }
  const signed = signImageRequest(config, {
    method: "PUT",
    key,
    body: image.body,
    headers: {
      "content-type": image.contentType,
      "cache-control": IMAGE_CACHE_CONTROL,
    },
  });
  const res = await fetchImpl(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: image.body,
    signal: AbortSignal.timeout(IMAGE_STORE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`image store PUT ${res.status}`);
  return { key, url, uploaded: true };
}

/**
 * The bytes of a `data:image/...;base64,...` value, or null when it is not
 * one (the formats the panel ever stored).
 *
 * @param {string} value
 * @returns {Buffer | null}
 */
export function dataImageBytes(value) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return null;
  }
  const comma = value.indexOf(",");
  if (comma === -1) return null;
  const header = value.slice(5, comma);
  if (!/^image\/(jpeg|png|webp|avif|gif);base64$/.test(header)) return null;
  const bytes = Buffer.from(value.slice(comma + 1), "base64");
  return bytes.length > 0 ? bytes : null;
}
