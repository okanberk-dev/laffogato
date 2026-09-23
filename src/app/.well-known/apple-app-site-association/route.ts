import { getPublicSettings } from "@/lib/admin/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/.well-known/apple-app-site-association` - iOS Universal Links.
 *
 * iOS fetches this document (over https, no redirects, from the apex AND the
 * www host it is asked about) and will only open the app for a laffogato.net
 * link if the app's `appID` is listed here. Without it every link the app
 * sends a member - an order confirmation, a coupon, a shared menu item -
 * opens Safari instead of the app that produced it.
 *
 * Served from admin settings rather than as a static file for the reason the
 * whole mobile config exists: the Team ID is not knowable until the Apple
 * developer account is set up, and the site must not need a deploy to learn
 * it. Until an operator fills it in there is nothing honest to publish, so
 * the route answers **404** - an association naming an app that does not
 * exist is worse than none, because iOS caches it.
 *
 * Content type is `application/json` with no extension on the path; that is
 * the spec, and Apple's fetcher is strict about it.
 */
const PATHS = [
  // A path belongs here only when a real laffogato.net URL under it opens an
  // app screen that can actually render THAT url. `NOT` entries come first:
  // iOS takes the first match, and the panel and the API must stay in the
  // browser.
  //
  // What is deliberately absent, and why:
  //
  //   /uye/*     the app has no member routes at all - no `uye` directory in
  //              its router - so every "hesabım", verification and reset link
  //              an iPhone opened landed on its not-found screen. It is also
  //              what keeps /uye/yeni-sifre in a browser, where a recovery
  //              fragment can be read.
  //   /menu/*    the site's URLs there are CATEGORIES (/menu/kahveler) and the
  //              app's route is /menu/[id], an item id. The app would look up
  //              a drink called "kahveler" and find nothing.
  //   /magaza/*  same shape mismatch, twice: categories, plus the product page
  //              at /magaza/urun/<slug>, which is two segments where the app's
  //              /magaza/[id] takes one - so it does not match at all.
  //   /siparis/* the site serves no such page; the order screen is reached by
  //              the app's own `laffogato://siparis/<id>` return from checkout,
  //              which is a custom scheme and needs no association.
  //   /davet/*   neither side has it: the site 404s and the app's davet.tsx
  //              takes no code parameter.
  //
  // Claiming a URL the site does not serve is not harmless. The association is
  // cached for days, so the app intercepts a link, cannot render it, and the
  // member cannot get to the web version either.
  "NOT /admin/*",
  "NOT /api/*",
  "NOT /uye/*",
  "/karaoke",
  "/kampanyalar",
  "/ziyaret",
];

export async function GET() {
  const { mobileApp } = await getPublicSettings();
  const { appleTeamId, bundleId } = mobileApp.store;

  if (!appleTeamId || !bundleId) {
    // Nothing to associate yet. 404 rather than an empty `details` array: an
    // empty document is a positive statement that no app owns these links,
    // and iOS is entitled to cache it for days.
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const body = {
    applinks: {
      details: [{ appID: `${appleTeamId}.${bundleId}`, paths: PATHS }],
    },
    // Lets the app offer the member's saved laffogato.net password on the
    // sign-in screen instead of making them type it again.
    webcredentials: { apps: [`${appleTeamId}.${bundleId}`] },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Long enough that iOS is not refetching it constantly, short enough
      // that adding a second app or a new path does not take a week to land.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
