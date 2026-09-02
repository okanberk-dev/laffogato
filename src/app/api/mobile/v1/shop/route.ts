import { isDbUnreachable } from "@/lib/db/health";
import { listShopForMobile } from "@/lib/mobile/menu";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/shop` — active shop products with server-computed
 * variant prices and the shipping thresholds (docs/API-MOBILE.md §2). Public.
 */
export async function GET() {
  try {
    const shop = await listShopForMobile();
    return apiJson(shop, {
      headers: {
        // Shorter than the menu: this carries stock flags, and a sold-out
        // product should stop looking available within a minute.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Mağazaya şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?",
      );
    }
    console.error("[api/mobile/v1/shop]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
