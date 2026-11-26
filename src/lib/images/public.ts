import { isStoredImageUrl, normalizePublicBaseUrl } from "./url-core.mjs";

/**
 * The photo store's public base URL as the browser knows it. Client-safe:
 * `next.config.ts` copies `IMAGES_PUBLIC_BASE_URL` into
 * `NEXT_PUBLIC_IMAGES_BASE_URL` at build time (it is a public address, not a
 * secret), and adds the same address to `images.remotePatterns`. null when
 * the deployment was built without a store.
 */
export const IMAGE_STORE_BASE_URL = normalizePublicBaseUrl(
  process.env.NEXT_PUBLIC_IMAGES_BASE_URL,
);

/** True for a photo in our bucket (R2): next/image may resize it. */
export function isStoreImage(src: string | null | undefined): src is string {
  return typeof src === "string" && isStoredImageUrl(src, IMAGE_STORE_BASE_URL);
}
