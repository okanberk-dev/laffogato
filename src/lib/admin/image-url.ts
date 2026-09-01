/**
 * Where an uploaded image is served from.
 *
 * Images uploaded through the admin are stored as base64 `data:` URLs in the
 * row. That is fine at rest and terrible on the wire: a data URL is inlined
 * into the RSC payload of every page that lists the product, so a shop page
 * with eleven products shipped several megabytes of base64 on *every*
 * navigation, and the browser could not cache a byte of it.
 *
 * These routes hand out the same bytes behind a stable, immutable URL. The
 * payload then carries ~30 characters instead of ~400 KB, and the browser
 * caches the image like any other. An externally-hosted `https://` image is
 * left exactly as it is.
 *
 * Client-safe: no server imports, so the admin previews can use it too.
 */

export function isDataImage(value: string): boolean {
  return value.startsWith("data:image/");
}

/** The public path for product image `index` of product `id`. */
export function productImagePath(id: string, index: number): string {
  return `/gorsel/urun/${encodeURIComponent(id)}/${index}`;
}

/** The public path for an uploaded menu-item photo. */
export function menuImagePath(id: string): string {
  return `/gorsel/menu/${encodeURIComponent(id)}`;
}

/** The public path for a shop-hero slide's background. */
export function heroImagePath(id: string): string {
  return `/gorsel/hero/${encodeURIComponent(id)}`;
}

/**
 * Rewrites a stored image value for delivery: data URLs become a served path,
 * anything else (an https:// URL an admin pasted) passes through untouched.
 */
export function servedImage(stored: string, path: string): string {
  return isDataImage(stored) ? path : stored;
}
