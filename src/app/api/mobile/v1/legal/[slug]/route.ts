import { legalDoc } from "@/lib/mobile/legal";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/legal/{slug}` — one contract, whole (§13).
 *
 * The app shows this text at the moment of consent, so it is the site's own
 * document rather than a summary of it: same revision, same wording, same
 * `updatedAt` the order records.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const doc = legalDoc(slug);
  if (!doc) {
    return apiError(404, "not_found", "Bu belge bulunamadı.");
  }
  return apiJson(
    { doc },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
