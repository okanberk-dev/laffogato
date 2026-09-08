/**
 * Where the app actually lives on the two stores.
 *
 * The app is not published yet, so there is nothing to compile in. Rather
 * than shipping mail with a button that goes nowhere, the links are read from
 * the environment and every surface that uses them treats "empty" as "this
 * section does not exist" — `hasAppLinks()` is what the mail renderer asks
 * before it keeps the app strip (`<!--IF:APP_LINKS-->`).
 *
 * Set both on Vercel when the listings go live; nothing else has to change.
 * Deliberately NO "server-only": the mail renderer and its tests both read it.
 */

export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() ?? "";
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() ?? "";

/**
 * True only when BOTH listings exist.
 *
 * One button on its own reads as "Android users are not welcome" rather than
 * "the other listing is still in review", and the strip is laid out as a
 * pair, so it is all or nothing.
 */
export function hasAppLinks(): boolean {
  return Boolean(APP_STORE_URL && PLAY_STORE_URL);
}
