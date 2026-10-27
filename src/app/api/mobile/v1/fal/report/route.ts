import { requireMobileCustomer } from "@/lib/mobile/auth";
import { apiError } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /fal/report` - "Bu yorumu bildir" (docs/API-MOBILE.md §20, additive).
 *
 * It let a member flag an AI reading from inside the app, as Google Play's
 * AI-generated content policy asks: the reading's words, a reason from a
 * closed list and the model's name, never the photo.
 *
 * Retired on 27 Oct 2026 with the AI reading itself (App Review 4.3(b),
 * lafmobil karar 330): there is no reading left to report, Veri Saklama
 * says no new report is taken, and no build after that calls this. A
 * signed-in call is answered 503 `fal_unavailable`, the answer §20 gives
 * POST /fal for the feature switched off (additive note in §20), and
 * nothing is read or written. The panel's old reports run out after ninety
 * days (src/lib/retention.ts).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiError(503, "fal_unavailable", "fA'L uygulamadan kaldırıldı; bildirim alınmıyor.");
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/report POST", err);
  }
}
