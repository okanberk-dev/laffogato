import { requireMobileCustomer } from "@/lib/mobile/auth";
import { apiError } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// docs/API-MOBILE.md §0 still names this route's 30 s; nothing here waits.
export const maxDuration = 30;

/**
 * `POST /fal` - fA'L read by AI (karar 177, docs/API-MOBILE.md §20).
 *
 * Retired on 27 Oct 2026: App Review refused the iOS app under Guideline
 * 4.3(b) and fA'L left the app (lafmobil karar 330). The reading is off in
 * code (`falAiEnabled` is false), so the route only answers what §20
 * documents for a feature that is off, in its order: 401 for a caller who
 * is not signed in, then 503 `fal_unavailable`. The body is not read, no
 * consent, quota or seat is looked up, and no photo goes anywhere. The
 * route stays because v1 only grows: an old build that calls it gets the
 * answer it already handles (it read the cup on the device on any refusal).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiError(503, "fal_unavailable", "fA'L'ın yapay zekâ yorumu kaldırıldı.");
  } catch (err) {
    return routeFailure("api/mobile/v1/fal POST", err);
  }
}
