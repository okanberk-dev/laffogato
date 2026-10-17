/**
 * Where an uploaded image is served from.
 *
 * Images uploaded through the admin are stored as base64 `data:` URLs in the
 * row. That is fine at rest and terrible on the wire: a data URL is inlined
 * into the RSC payload of every page that lists the product, so a shop page
 * with eleven products shipped several megabytes of base64 on *every*
 * navigation, and the browser could not cache a byte of it.
 *
 * These routes hand out the same bytes behind a stable, cacheable URL. The
 * payload then carries ~40 characters instead of ~400 KB, and the browser
 * caches the image like any other. An externally-hosted `https://` image is
 * left exactly as it is.
 *
 * Client-safe: no server imports, so the admin previews can use it too. The
 * digest that fills `version` is server-side (`image-bytes.ts`) because it
 * needs `node:crypto`.
 */

/**
 * The query parameter that carries the content stamp, e.g.
 * `/gorsel/menu/mnu-0007?v=6f1c2a9d3b40`.
 *
 * Why a version is needed at all: the path alone is a *constant* per item, so
 * a replaced photo reached every cache under the URL its predecessor had
 * already populated. The CDN kept the old bytes for a day and the mobile app's
 * disk cache - keyed by URL, with no expiry of its own - kept them until the
 * app was reinstalled. Uploading a new photo did nothing visible.
 *
 * Why a query parameter rather than a path segment: Next.js already relies on
 * the query string being part of the CDN cache key for its own correctness -
 * the `_rsc` parameter distinguishes the RSC payload of a route from its HTML
 * ("The `_rsc` search parameter must be included in the cache key. Ensure your
 * CDN does not strip query parameters from cache keys",
 * `docs/01-app/02-guides/cdn-caching.md` in the installed Next). A CDN that
 * dropped it would already be serving this site wrong in worse ways. The
 * stamp therefore travels the same way, and no route file has to move.
 */
export const IMAGE_VERSION_PARAM = "v";

export function isDataImage(value: string): boolean {
  return value.startsWith("data:image/");
}

/** Appends the content stamp; an empty version leaves the path untouched. */
function stamped(path: string, version: string): string {
  if (!version) return path;
  return `${path}?${IMAGE_VERSION_PARAM}=${encodeURIComponent(version)}`;
}

/** The public path for product image `index` of product `id`. */
export function productImagePath(
  id: string,
  index: number,
  version = "",
): string {
  return stamped(`/gorsel/urun/${encodeURIComponent(id)}/${index}`, version);
}

/** The public path for an uploaded menu-item photo. */
export function menuImagePath(id: string, version = ""): string {
  return stamped(`/gorsel/menu/${encodeURIComponent(id)}`, version);
}

/** The public path for a shop-hero slide's background. */
export function heroImagePath(id: string, version = ""): string {
  return stamped(`/gorsel/hero/${encodeURIComponent(id)}`, version);
}

/** The public path for a home-hero slide's uploaded picture. */
export function homeHeroImagePath(id: string, version = ""): string {
  return stamped(`/gorsel/ana-hero/${encodeURIComponent(id)}`, version);
}

/**
 * Rewrites a stored image value for delivery: data URLs become a served path,
 * anything else (an https:// URL an admin pasted) passes through untouched.
 *
 * Pair it with `imageVersion(stored)` from `image-bytes.ts` so the path
 * carries the stamp:
 * `servedImage(it.image, menuImagePath(it.id, imageVersion(it.image)))`.
 */
export function servedImage(stored: string, path: string): string {
  return isDataImage(stored) ? path : stored;
}
