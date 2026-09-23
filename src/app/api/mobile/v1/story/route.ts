import { isDbUnreachable } from "@/lib/db/health";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { getStory } from "@/lib/mobile/story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/story` - founder, timeline and press quotes for the
 * app's Hikâye screen (docs/API-MOBILE.md §16). Public: it is the same story
 * the site tells any visitor.
 */
export async function GET() {
  try {
    const story = await getStory();
    return apiJson(story, {
      headers: {
        // Editorial copy: a change made in the panel reaches the phone within
        // five minutes, the same budget bootstrap has.
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
    console.error("[api/mobile/v1/story]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
