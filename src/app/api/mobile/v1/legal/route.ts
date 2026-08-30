import { legalIndex } from "@/lib/mobile/legal";
import { apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/legal` — the contract index (docs/API-MOBILE.md §13).
 *
 * Public and static: the documents live in source, not in the database, so
 * this answers from the build with no query behind it. A revision ships with
 * a deploy, which is also what `updatedAt` means.
 */
export function GET() {
  return apiJson(legalIndex(), {
    headers: {
      // A contract changes with a deploy, so a day of shared cache is safe and
      // the phone still sees a new revision the same session it is published.
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
