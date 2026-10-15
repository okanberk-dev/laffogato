import { z } from "zod";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  falReportsToday,
  recordFalReport,
  withdrawFalReport,
} from "@/lib/mobile/fal";
import {
  FAL_REPORT_DAILY_LIMIT,
  FAL_REPORT_TEXT_MAX,
  falReportModel,
  falReportReason,
  falReportText,
} from "@/lib/mobile/fal-core";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const BODY = z.object({
  text: z.string({ message: "Bildirilen yorum eksik." }).max(FAL_REPORT_TEXT_MAX * 2, "Bildirilen yorum çok uzun."),
  reason: z.string().max(64).optional(),
  model: z.string().max(128).optional(),
});

function reportLimit() {
  return apiError(
    429,
    "fal_report_limit",
    "Bugünlük bildirim sınırına ulaştın. Teşekkür ederiz; yarın yeniden bildirebilirsin.",
  );
}

/**
 * `POST /fal/report` - "Bu yorumu bildir" (docs/API-MOBILE.md §20, additive).
 *
 * Google Play's AI-generated content policy wants a member to be able to flag
 * an AI reading from inside the app. The report carries the reading's words
 * as the member saw them, a reason from a closed list and the model's name -
 * never the photo, which is not kept anywhere.
 *
 * Deliberately NOT behind `FAL_AI_ENABLED` or the R12 consent: a reading the
 * member is looking at stays reportable after the operator switches the AI
 * off or the member withdraws consent. The app only offers the link under a
 * reading that came back with `ai: true`, so a device reading is never
 * reported here.
 *
 * In order: signed in (401); a verified address (403 `email_unverified`);
 * a body with the words (400); under
 * `FAL_REPORT_DAILY_LIMIT` reports this Istanbul day (429 `fal_report_limit`).
 * The same words twice on one day are stored once and answered as a success.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    // Only an `ai: true` reading is reportable, and POST /fal reads only for a
    // verified address (WS1-01). An unconfirmed sign-up therefore has nothing
    // to report; without this it could post ten free-text rows a day per
    // throwaway address into the panel's report list.
    if (!auth.customer.emailVerified) {
      return apiError(403, "email_unverified", "Bildirim için önce e-postanı doğrula.");
    }

    const body = await parseJsonBody(request, BODY);
    if (!body.ok) return body.response;
    const text = falReportText(body.data.text);
    if (!text) {
      return apiError(400, "invalid_request", "Bildirilen yorum boş ya da çok uzun.");
    }

    const today = await falReportsToday(auth.customer.email);
    if (today.includes(text)) {
      return apiJson({ ok: true as const }, { private: true });
    }
    if (today.length >= FAL_REPORT_DAILY_LIMIT) return reportLimit();

    const id = await recordFalReport(auth.customer.email, {
      reason: falReportReason(body.data.reason),
      text,
      model: falReportModel(body.data.model),
    });
    // The count above is read before the insert, so a burst of reports sent
    // at once all saw room under the cap and all landed. Counted again with
    // this row in it: past the cap, this request's own row is taken back.
    // Parallel losers may all withdraw - the safe direction for a cap.
    if (id !== null) {
      const after = await falReportsToday(auth.customer.email);
      if (after.length > FAL_REPORT_DAILY_LIMIT) {
        await withdrawFalReport(id);
        return reportLimit();
      }
    }
    return apiJson({ ok: true as const }, { status: 201, private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/fal/report POST", err);
  }
}
