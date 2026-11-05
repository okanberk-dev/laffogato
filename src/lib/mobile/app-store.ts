/**
 * Where the app actually lives on the two stores.
 *
 * The iOS app is on the App Store (1.1.0, approved; operator, 5 Kas 2026), so
 * its listing is compiled in as the default. Google Play has no listing yet:
 * its link is read from the environment, and every surface that uses it
 * treats "empty" as "this listing does not exist".
 *
 * `NEXT_PUBLIC_APP_STORE_URL` still overrides the App Store default (a
 * localized or campaign link); `NEXT_PUBLIC_PLAY_STORE_URL` is set on Vercel
 * when the Play listing goes live, and nothing else has to change.
 * Deliberately NO "server-only": the mail renderer and its tests both read it.
 */

/**
 * The App Store listing of L'Affogato (App Store Connect Apple ID 6823861367,
 * `ascAppId` in lafmobil's eas.json). Without the name slug on purpose: Apple
 * redirects the bare id to the current listing, and a slug that changes with
 * the app's name would not.
 */
export const LIVE_APP_STORE_URL = "https://apps.apple.com/tr/app/id6823861367";

export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || LIVE_APP_STORE_URL;
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() ?? "";

/**
 * True only when BOTH listings exist. What the e-mails ask before they keep
 * their app strip (`<!--IF:APP_LINKS-->`): the strip is laid out as a pair,
 * and a mail cannot say "Android yakında" the way a page can.
 */
export function hasAppLinks(): boolean {
  return Boolean(APP_STORE_URL && PLAY_STORE_URL);
}

/**
 * True when at least one listing exists: what the site's store buttons ask
 * (`AppStoreLinks`). A page shows the listing that exists and says, in the
 * same block, that the other one is coming.
 */
export function hasAnyAppLink(): boolean {
  return Boolean(APP_STORE_URL || PLAY_STORE_URL);
}
