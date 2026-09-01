import "server-only";

/**
 * Decodes a stored `data:image/...;base64,...` value into servable bytes.
 *
 * Returns null for anything that is not a data URL — those are external
 * `https://` images the browser fetches directly.
 */
export function decodeDataImage(
  value: string | undefined,
): { body: Buffer; contentType: string } | null {
  if (!value || !value.startsWith("data:image/")) return null;
  const comma = value.indexOf(",");
  if (comma === -1) return null;
  const header = value.slice(5, comma); // e.g. "image/jpeg;base64"
  if (!header.endsWith(";base64")) return null;
  const contentType = header.slice(0, -";base64".length);
  // Only the image types the uploader can produce; never echo an arbitrary
  // content type back from stored data.
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(contentType)) return null;
  try {
    return { body: Buffer.from(value.slice(comma + 1), "base64"), contentType };
  } catch {
    return null;
  }
}

/**
 * Cached hard and forever: the URL contains the product id and the slot, and
 * the bytes behind it change only when the admin replaces the image — which
 * also revalidates the pages that link to it.
 */
export const IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=86400";
