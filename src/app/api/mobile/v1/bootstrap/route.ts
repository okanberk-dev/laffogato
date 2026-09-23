import { isDbUnreachable } from "@/lib/db/health";
import { getBootstrap } from "@/lib/mobile/menu";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/bootstrap` - venue facts, hours, courier fee and the
 * happy-hour rule the app reads on launch (docs/API-MOBILE.md §10). Public.
 */
export async function GET() {
  try {
    const bootstrap = await getBootstrap();
    return apiJson(bootstrap, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Sunucuya şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?",
      );
    }
    console.error("[api/mobile/v1/bootstrap]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
