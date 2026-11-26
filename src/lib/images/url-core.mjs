/**
 * The photo store's URLs, client-safe (no Node imports): the admin uploader,
 * the site's image components and the server all tell "a photo in our
 * bucket" apart the same way. The store itself: `./store-core.mjs`.
 */

/**
 * The public base URL, normalised: https, no query, no fragment, no trailing
 * slash. null when it is not one.
 *
 * @param {string | undefined} raw
 * @returns {string | null}
 */
export function normalizePublicBaseUrl(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** The path shape of every key this store writes. */
const KEY_PATH = /^\/img\/[0-9a-f]{16}\.(webp|jpg|png|gif|avif)$/;

/**
 * The public URL of an object.
 *
 * @param {string} publicBaseUrl normalised (see normalizePublicBaseUrl)
 * @param {string} key
 * @returns {string}
 */
export function imagePublicUrl(publicBaseUrl, key) {
  return `${publicBaseUrl}/${key}`;
}

/**
 * True when `value` is a photo this store wrote: under the public base URL
 * and named like one of its keys. A pasted link to anywhere else is not.
 *
 * @param {string} value
 * @param {string | null} publicBaseUrl normalised, or null (no store)
 * @returns {boolean}
 */
export function isStoredImageUrl(value, publicBaseUrl) {
  if (!publicBaseUrl || typeof value !== "string") return false;
  if (!value.startsWith(`${publicBaseUrl}/`)) return false;
  const rest = value.slice(publicBaseUrl.length);
  return KEY_PATH.test(rest);
}
