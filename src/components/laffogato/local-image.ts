import { isStoreImage } from "@/lib/images/public";

/**
 * Whether next/image may resize this source.
 *
 * Only the site's own static files: a path on this origin that is not a
 * route (/gorsel serves panel uploads through a handler of its own) and not
 * protocol-relative. An admin-entered URL on some other host stays a plain
 * <img> - next/image would need a wildcard remotePattern to take it.
 */
export function isLocalStatic(src: string | undefined | null): src is string {
  return (
    typeof src === "string" &&
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.startsWith("/gorsel/") &&
    !src.startsWith("/api/")
  );
}

/**
 * Whether next/image may resize this source: the site's own static files,
 * and photos in our photo store (R2, 26 Kas 2026), whose address
 * `next.config.ts` adds to `images.remotePatterns`. Anything else (a
 * `/gorsel/` upload served by its own route, a link an admin pasted) is
 * drawn as it is (`unoptimized`): next/image would refuse an unlisted host.
 */
export function canOptimizeImage(src: string | undefined | null): boolean {
  return isLocalStatic(src) || isStoreImage(src);
}
