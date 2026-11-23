import { readMobileMenuMarker } from "@/lib/admin/change-marker";
import { rememberedRead } from "@/lib/admin/remembered-read";
import { TAG_MENU, TAG_SITE } from "@/lib/cache/tags";
import { isDbUnreachable } from "@/lib/db/health";
import { ifNoneMatchHits, strongEtag } from "@/lib/http/etag";
import { readMobileMenu } from "@/lib/mobile/menu";
import { apiError } from "@/lib/mobile/respond";
import { HOME_BRANCH, isBranchId, siteBranches } from "@/lib/panel/branches";

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

/** The menu as it is sent, its ETag, and until when it holds without a write. */
interface MenuRead {
  body: string;
  etag: string;
  validUntil: string | null;
}

async function readMenu(branch: string): Promise<MenuRead> {
  const { menu, validUntil } = await readMobileMenu(branch, new Date());
  const body = JSON.stringify(menu);
  return { body, etag: strongEtag(body), validUntil };
}

/**
 * How many price instants one ask may step over (one `rememberedRead` each)
 * before it reads the menu itself; more than a branch has in a poll window.
 */
const MAX_PRICE_STEPS = 4;

/**
 * `GET /api/mobile/v1/menu` - the cafe menu with the customisation table
 * (docs/API-MOBILE.md §1). Public: it is the printed menu on the counter.
 *
 * The menu is always read from the database. Only "has it changed?" is
 * answered without it (22 Kas 2026): the ETag of the last read is kept
 * under the menu's change marker (src/lib/admin/remembered-read.ts), and an
 * `If-None-Match` that names it gets its 304 while no menu item, branch
 * availability or setting has been written since. LafPOS asks that every
 * 15 minutes of an open business day and the app on every refresh; each
 * ask used to read every menu row, photos included, to hash them. Any
 * other ETag, or none, reads the database as before; nothing is decided
 * from the cache (an order's price and "Tükendi" are read live when it is
 * placed).
 *
 * `?branch=` (23 Kas 2026, optional; docs/API-MOBILE.md §1 "Şube"): the
 * menu as that branch sells it, its "Satışta / Tükendi" and its own prices
 * (a Marina table's order is charged Marina's). Absent, empty or the home
 * branch: today's menu, unchanged. A branch the site does not know: 400
 * `invalid_branch`. A branch's ETag is remembered under its own scope, and
 * only until its next price instant (`validUntil`): nothing is written
 * then, so the marker does not move; the first ask after it reads the menu
 * once more, under a scope named by that instant, and that read is
 * remembered in turn.
 */
export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("branch");
    let branch = HOME_BRANCH;
    if (requested !== null && requested !== "") {
      if (
        !isBranchId(requested) ||
        !siteBranches(process.env).includes(requested)
      ) {
        return apiError(400, "invalid_branch", "Bu şubenin menüsü bulunamadı.");
      }
      branch = requested;
    }
    const home = branch === HOME_BRANCH;
    const ifNoneMatch = request.headers.get("if-none-match");
    let menu: MenuRead | null = null;
    if (ifNoneMatch) {
      // The marker before the read (remembered-read.ts).
      const marker = await readMobileMenuMarker();
      const nowMs = Date.now();
      let scope = home ? "" : branch;
      for (let step = 0; step < MAX_PRICE_STEPS; step++) {
        const read = await rememberedRead({
          name: "mobile-menu-etag",
          scope,
          marker,
          tags: [TAG_MENU, TAG_SITE],
          nowMs,
          read: () => readMenu(branch),
          remember: (m): { etag: string; validUntil?: string } =>
            m.validUntil
              ? { etag: m.etag, validUntil: m.validUntil }
              : { etag: m.etag },
        });
        if (read.from === "database") {
          menu = read.live;
          break;
        }
        const until = read.remembered?.validUntil;
        if (typeof until === "string" && Date.parse(until) <= nowMs) {
          scope = `${branch}@${until}`;
          continue;
        }
        const known = read.remembered?.etag;
        if (typeof known === "string" && ifNoneMatchHits(ifNoneMatch, known)) {
          return new Response(null, {
            status: 304,
            headers: { "Cache-Control": MENU_CACHE_CONTROL, ETag: known },
          });
        }
        break;
      }
    }
    const { body, etag } = menu ?? (await readMenu(branch));
    const headers = {
      "Cache-Control": MENU_CACHE_CONTROL,
      ETag: etag,
    };

    // A conditional GET costs the app a header and saves it the payload; the
    // CDN uses the same exchange to extend its own copy past the TTL rather
    // than re-downloading a menu that has not changed.
    if (ifNoneMatchHits(ifNoneMatch, etag)) {
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
