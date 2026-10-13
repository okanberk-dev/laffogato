import { z } from "zod";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  buildFalContext,
  completeFalReading,
  falReadingsToday,
  hasFalConsent,
  readCupWithAI,
  releaseFalReading,
  reserveFalReading,
} from "@/lib/mobile/fal";
import {
  FAL_CONSENT_VERSION,
  FAL_DAILY_LIMIT,
  FAL_IMAGE_MAX_BYTES,
  decodeCupImage,
  falAiEnabled,
} from "@/lib/mobile/fal-core";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// base64 is 4/3 of the bytes; a little room for a data-URL prefix.
const BODY = z.object({
  image: z
    .string()
    .min(8)
    .max(Math.ceil((FAL_IMAGE_MAX_BYTES * 4) / 3) + 64),
});

/**
 * `POST /fal` - fA'L read by AI (karar 177, docs/API-MOBILE.md §20).
 *
 * In order: the member is signed in; the feature is on (key AND switch,
 * else 503 `fal_unavailable` and the app reads the cup itself); their R12
 * consent stands at the current version (else 403 `consent_required`);
 * today's readings are under the limit (else 429 `fal_limit`); the body is
 * a JPEG of a sane size (else 400 `invalid_image`). The photo goes to the
 * model and nowhere else - it is not stored, logged or kept after the reply.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;

    if (!falAiEnabled(process.env)) {
      return apiError(503, "fal_unavailable", "fA'L'ın yapay zekâ yorumu şu an kapalı; falına cihazında bakıyoruz.");
    }
    if (!(await hasFalConsent(auth.customer.email))) {
      return apiError(403, "consent_required", "Yapay zekâ yorumu için önce onayın gerekiyor.");
    }
    const used = await falReadingsToday(auth.customer.email);
    if (used >= FAL_DAILY_LIMIT) {
      return apiError(429, "fal_limit", `Bugünlük ${FAL_DAILY_LIMIT} fal hakkını kullandın. Yarın yine bekleriz.`);
    }

    const body = await parseJsonBody(request, BODY);
    if (!body.ok) return body.response;
    const jpeg = decodeCupImage(body.data.image);
    if (!jpeg) {
      return apiError(400, "invalid_image", "Fotoğraf okunamadı. Bir daha dener misin?");
    }

    // The early count above turns most callers away cheaply; the seat is what
    // actually holds the cap, taken only now that the photo is known to be
    // readable (a bad body must not spend a turn).
    const seat = await reserveFalReading(auth.customer.email, FAL_DAILY_LIMIT);
    if (!seat.ok) {
      return apiError(429, "fal_limit", `Bugünlük ${FAL_DAILY_LIMIT} fal hakkını kullandın. Yarın yine bekleriz.`);
    }
    let outcome: Awaited<ReturnType<typeof readCupWithAI>>;
    try {
      const context = await buildFalContext(auth.customer);
      outcome = await readCupWithAI(jpeg.toString("base64"), context);
    } catch (err) {
      await releaseFalReading(seat.id).catch(() => undefined);
      throw err;
    }
    if (!outcome.ok) {
      await releaseFalReading(seat.id);
      return apiError(502, "fal_failed", "Yapay zekâ şu an falına bakamadı; falına cihazında bakıyoruz.");
    }
    await completeFalReading(seat.id, outcome.reading.cupSeen, outcome.model);

    return apiJson(
      {
        reading: outcome.reading,
        ai: true,
        consentVersion: FAL_CONSENT_VERSION,
        remainingToday: Math.max(0, FAL_DAILY_LIMIT - seat.used - 1),
        // Additive (23 Eyl 2026): which model wrote it, so a "Bu yorumu
        // bildir" report can name it (POST /fal/report, §20).
        model: outcome.model,
      },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/fal POST", err);
  }
}
