import { legalIndex } from "@/lib/mobile/legal";
import { apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/legal` - the contract index (docs/API-MOBILE.md §13).
 *
 * Public. Dynamic rather than static because an admin can publish an
 * override in /admin/hukuk between deploys, and the title, summary and
 * effective date it carries belong in the list too. The coded documents are
 * the fallback when the database is away, so the index always answers.
 */
export async function GET() {
  try {
    return apiJson(await legalIndex(), {
      headers: {
        // Same window as bootstrap: an override published in the panel is on
        // every phone within five minutes, and the CDN keeps answering while
        // it revalidates.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    return routeFailure("api/mobile/v1/legal", err);
  }
}
