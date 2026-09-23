import { isDbUnreachable } from "@/lib/db/health";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { getLiveStatus } from "@/lib/mobile/venue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/mobile/v1/live-status - docs/API-MOBILE.md §6.
 *
 * Public: the same "are they open, is there a free table" question a passer-by
 * answers by looking through the window. Thirty seconds of shared cache is
 * shorter than it takes the staff to walk to the panel and back - and no
 * `stale-while-revalidate`, because the panel tells staff "the app sees it
 * within 30 seconds" and an SWR window of two minutes made that untrue.
 */
export async function GET() {
  try {
    const status = await getLiveStatus();
    return apiJson(status, {
      headers: {
        "Cache-Control": "public, s-maxage=30",
      },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Canlı duruma şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      );
    }
    console.error("[api/mobile/v1/live-status]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
