import type { NextRequest } from "next/server";

import { clientIp } from "@/lib/admin/rate-limit";
import { isDbUnreachable } from "@/lib/db/health";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { toReservationJson } from "@/lib/mobile/karaoke";
import { reopenKaraokePayment } from "@/lib/mobile/karaoke-payment";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/karaoke/reservations/{id}/payment` - a fresh payment
 * page for the member's own unpaid hold (§7), like the order reopen (§3).
 * 200 `{ reservation, payment }`. A stranger's id is 404 like a missing one;
 * a booking with nothing to pay (paid, lapsed, past the reopen window) is 409
 * `not_payable`; a member who keeps reopening is 429 `rate_limited`
 * (`checkout-reopen`, the order reopen's budget); a page that cannot be
 * opened, or a last attempt the POS cannot vouch for, is 503
 * `payment_unavailable`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    if (!isKaraokeRef(id)) {
      return apiError(404, "not_found", "Rezervasyon bulunamadı.");
    }
    const result = await reopenKaraokePayment(
      { kind: "member", customer: auth.customer },
      id,
      { buyerIp: await clientIp() },
    );
    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return apiError(404, "not_found", "Rezervasyon bulunamadı.");
        case "rate_limited":
          return apiError(
            429,
            "rate_limited",
            "Kısa sürede çok fazla ödeme denemesi oldu. Birkaç dakika sonra yeniden dene.",
            { "Retry-After": String(result.retryAfterSeconds) },
          );
        case "payment_unavailable":
          return apiError(
            503,
            "payment_unavailable",
            "Ödeme sayfası şu an açılamadı; kartından para çekilmedi. Birazdan tekrar dene.",
          );
        case "payment_unknown":
          // Same code as above, so an app that knows one 503 knows both; the
          // sentence does not claim the card was not charged - the last
          // attempt is exactly what could not be read.
          return apiError(
            503,
            "payment_unavailable",
            "Önceki ödemenin durumunu şu an doğrulayamıyoruz. Birkaç dakika sonra tekrar dene.",
          );
        default:
          return apiError(
            409,
            "not_payable",
            "Bu rezervasyon ödeme beklemiyor ya da ödeme süresi doldu.",
            undefined,
            { reservation: toReservationJson(result.reservation) },
          );
      }
    }
    return apiJson(
      {
        reservation: toReservationJson(result.reservation),
        payment: result.payment,
      },
      { private: true },
    );
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Rezervasyon servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      );
    }
    console.error("[api/mobile/v1/karaoke/reservations/[id]/payment]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
