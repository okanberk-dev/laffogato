import { compareSemver } from "./app-config";

/**
 * The laffogato.net paths the iOS app is allowed to open
 * (`/.well-known/apple-app-site-association`, the route next to the
 * `.well-known` folder). Pure, so the route and its tests read one list.
 *
 * A path belongs here only when a real laffogato.net URL under it opens an
 * app screen that can actually render THAT url. `NOT` entries come first:
 * iOS takes the first match, and the panel and the API must stay in the
 * browser.
 *
 * What is deliberately absent, and why:
 *
 *   /uye/*     the app has no member routes at all - no `uye` directory in
 *              its router - so every "hesabım", verification and reset link
 *              an iPhone opened landed on its not-found screen. It is also
 *              what keeps /uye/yeni-sifre in a browser, where a recovery
 *              fragment can be read.
 *   /menu/*    the site's URLs there are CATEGORIES (/menu/kahveler) and the
 *              app's route is /menu/[id], an item id. The app would look up
 *              a drink called "kahveler" and find nothing.
 *   /magaza/*  same shape mismatch, twice: categories, plus the product page
 *              at /magaza/urun/<slug>, which is two segments where the app's
 *              /magaza/[id] takes one - so it does not match at all.
 *   /siparis/* the site serves no such page; the order screen is reached by
 *              the app's own `laffogato://siparis/<id>` return from checkout,
 *              which is a custom scheme and needs no association.
 *   /davet/*   neither side has it: the site 404s and the app's davet.tsx
 *              takes no code parameter.
 *
 * Claiming a URL the site does not serve is not harmless. The association is
 * cached for days, so the app intercepts a link, cannot render it, and the
 * member cannot get to the web version either.
 */
export const AASA_PATHS: readonly string[] = [
  "NOT /admin/*",
  "NOT /api/*",
  "NOT /uye/*",
  "/karaoke",
  "/kampanyalar",
  // Table QR (claimed 5 Kas 2026): every released iOS build (1.1.0 and
  // later; 1.0.0 never reached the store) has the app's masa/[kod] screen,
  // so a printed table card scanned with the iPhone camera opens the app at
  // that table (docs/API-MOBILE.md §22). Android's pathPrefix "/masa/" is in
  // lafmobil's app.json and ships with its first Play build.
  "/masa/*",
  "/ziyaret",
];

/**
 * The first app version whose router has `uygulama/dogrula`, the screen the
 * sign-up mail's confirmation link opens (docs/AUTH.md §5d in lafmobil).
 */
export const EMAIL_LINK_APP_VERSION = "1.1.1";

/**
 * Paths an app version opens only from `EMAIL_LINK_APP_VERSION` on. Claimed
 * once the panel's minimum supported version (Mobil → Ayarlar → "En düşük
 * sürüm") reaches it, i.e. once no installed build can be handed a URL it
 * has no screen for. Until then the same URL is the site's page
 * (`/uygulama/dogrula`), which confirms the address on a button press.
 */
export const AASA_PATHS_FROM_EMAIL_LINK_VERSION: readonly string[] = [
  "/uygulama/*",
];

/** The association's `paths` for the panel's minimum supported app version. */
export function aasaPaths(minSupportedAppVersion: string): string[] {
  const all = [...AASA_PATHS];
  if (compareSemver(minSupportedAppVersion, EMAIL_LINK_APP_VERSION) >= 0) {
    // Before "/ziyaret", after the NOT rules: order only matters for NOT.
    all.push(...AASA_PATHS_FROM_EMAIL_LINK_VERSION);
  }
  return all;
}

/** Every path any supported app version may be handed (what Android lists). */
export function aasaPathsAtLatest(): string[] {
  return [...AASA_PATHS, ...AASA_PATHS_FROM_EMAIL_LINK_VERSION];
}
