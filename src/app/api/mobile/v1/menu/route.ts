import { isDbUnreachable } from "@/lib/db/health";
import { ifNoneMatchHits, strongEtag } from "@/lib/http/etag";
import { listMenuForMobile } from "@/lib/mobile/menu";
import { apiError } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * A minute of shared cache keeps a launch spike off the database, and
 * stale-while-revalidate means nobody waits on it for a menu.
 *
 * The window is the CDN's share of how long a price, a photo or a "Tükendi"
 * takes to reach the app: 60 s fresh, then at most 60 s more of the stale
 * copy while one request refreshes it, so two minutes at worst; the app's
 * own staleTime (2 minutes since 6 Kas 2026) comes on top
 * (docs/API-MOBILE.md "Tazelik penceresi"). It was 300 s + 300 s until
 * 6 Kas 2026 (and the stale window 3600 s until 28 Oct 2026); the operator
 * wants a price or photo changed on the site to reach the app on its own,
 * quickly. A shorter window costs at most one database read per minute per
 * CDN region while the app is in use, and the ETag below keeps most of
 * those answers to a header.
 *
 * `revalidatePath()` in the admin cannot shorten this: it "invalidates the
 * Next.js server cache, but the CDN will continue serving its cached copy
 * until the `s-maxage` TTL expires" (`docs/01-app/02-guides/cdn-caching.md`
 * in the installed Next 16) - and this route is `force-dynamic`, so it has no
 * server cache entry to invalidate in the first place. Purging would need a
 * CDN purge API call with a deploy-scoped token; that is a secret and a
 * failure mode for a minute or two of lag. The image URLs themselves carry a
 * content stamp, so a new photo is fetched as soon as the menu naming it
 * arrives.
 */
const MENU_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=60";

/**
 * `GET /api/mobile/v1/menu` - the cafe menu with the customisation table
 * (docs/API-MOBILE.md §1). Public: it is the printed menu on the counter.
 */
export async function GET(request: Request) {
  try {
    const menu = await listMenuForMobile();
    const body = JSON.stringify(menu);
    const etag = strongEtag(body);
    const headers = {
      "Cache-Control": MENU_CACHE_CONTROL,
      ETag: etag,
    };

    // A conditional GET costs the app a header and saves it the payload; the
    // CDN uses the same exchange to extend its own copy past the TTL rather
    // than re-downloading a menu that has not changed.
    if (ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(body, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Menüye şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?",
      );
    }
    console.error("[api/mobile/v1/menu]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
