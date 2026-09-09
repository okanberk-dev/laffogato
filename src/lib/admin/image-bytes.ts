import "server-only";

import { createHash } from "node:crypto";

import { isDataImage } from "./image-url";

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
 * How many hex digits of the digest travel in the URL.
 *
 * 12 digits is 48 bits. A collision would mean a replaced photo keeping its
 * predecessor's URL — the exact bug this stamp exists to kill — so the length
 * is set well past the point where that is conceivable for the handful of
 * photos one menu item sees in its life, and a dozen characters in a URL cost
 * nothing.
 */
const VERSION_LENGTH = 12;

/**
 * The full content digest of a stored image, or "" when the value is not an
 * uploaded data URL (an admin-pasted `https://` URL has no bytes of ours to
 * stamp, and its own host decides its caching).
 *
 * The digest runs over the stored string rather than the decoded bytes: the
 * two are one-to-one, and this way the route can compare the stamp it was
 * given against the digest it needs for the ETag with a single hash. Node's
 * sha256 is hardware-backed and measures ~1 ms for the largest image the
 * uploader can store (2 MB), which is the cost of hashing a whole catalogue
 * of photos once per request.
 */
export function imageDigest(stored: string | undefined): string {
  if (!stored || !isDataImage(stored)) return "";
  return createHash("sha256").update(stored).digest("hex");
}

/**
 * The short stamp that goes in the URL (`?v=…`). Derived from the content, so
 * the same photo keeps the same URL — nothing re-downloads — and a different
 * photo lands on a URL no cache has ever seen.
 */
export function imageVersion(stored: string | undefined): string {
  return imageDigest(stored).slice(0, VERSION_LENGTH);
}

/**
 * True when `version` is the stamp this exact content would be given.
 *
 * The length is checked, not just the prefix: a hand-shortened `?v=6f` matches
 * a prefix but is not a stamp we ever hand out, and it must not be the thing
 * that earns a year of `immutable`.
 */
export function versionMatchesDigest(version: string, digest: string): boolean {
  return version.length === VERSION_LENGTH && digest.startsWith(version);
}

/**
 * For a URL with NO stamp, or one whose stamp does not match what is stored.
 *
 * This used to be `s-maxage=86400` on the promise that the bytes "change only
 * when the admin replaces the image — which also revalidates the pages that
 * link to it". The pages, yes; the image URL, no. It never changed, so a
 * replaced photo stayed invisible behind the CDN for a day and behind the
 * mobile app's URL-keyed disk cache for longer. Five minutes, plus the ETag
 * below, is what an unstamped URL gets now.
 */
export const IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=300";

/**
 * For a URL whose `?v=` matches the stored content.
 *
 * Immutable is honest here rather than aspirational: the stamp IS the digest
 * of the bytes being served, so this URL cannot ever answer with different
 * bytes. New photo, new stamp, new URL — and this entry is simply never asked
 * for again.
 */
export const IMMUTABLE_IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable";
