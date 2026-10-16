import type { NextRequest } from "next/server";

import { isDbUnreachable } from "@/lib/db/health";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  KARAOKE_TOO_LATE_MESSAGE,
  toReservationJson,
} from "@/lib/mobile/karaoke";
import { cancelKaraokeReservation } from "@/lib/mobile/karaoke-payment";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/karaoke/reservations/{id}/cancel` - the member
 * cancels their own booking (§7, additive). Allowed while MORE than two hours
 * remain before the start (Europe/Istanbul); a paid booking is refunded in
 * full through the POS first. Later: 409 `too_late`, nothing refunded.
 *
 * 200 `{ reservation, refunded }`. A stranger's id is 404. An unpaid hold
 * whose payment the POS could not be asked about is 503 `payment_unknown`
 * and nothing changes (CLAUDE.md rule 29). A declined refund is 502
 * `refund_failed` and the booking stands as it was; a refund whose answer
 * never came is 409 `refund_pending` - the staff settle it, and the member
 * is mailed.
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
    const result = await cancelKaraokeReservation(id, {
      kind: "member",
      email: auth.customer.email,
      emailVerified: auth.customer.emailVerified,
    });
    if (!result.ok) {
      const extra = result.reservation
        ? { reservation: toReservationJson(result.reservation) }
        : undefined;
      switch (result.reason) {
        case "not_found":
          return apiError(404, "not_found", "Rezervasyon bulunamadı.");
        case "too_late":
          return apiError(
            409,
            "too_late",
            KARAOKE_TOO_LATE_MESSAGE,
            undefined,
            extra,
          );
        case "payment_unknown":
          return apiError(
            503,
            "payment_unknown",
            "Ödemenin durumu şu an doğrulanamadı, bu yüzden iptal yapılmadı. Birkaç dakika sonra yeniden dene.",
            undefined,
            extra,
          );
        case "refund_refused":
          return apiError(
            502,
            "refund_failed",
            "İade şu an yapılamadı; rezervasyonun iptal edilmedi ve olduğu gibi duruyor. Ekibimize haber gitti.",
            undefined,
            extra,
          );
        case "refund_unknown":
          return apiError(
            409,
            "refund_pending",
            "İade isteğin bankaya iletildi ama sonucu henüz gelmedi. Ekibimiz kontrol edip sana e-postayla dönecek.",
            undefined,
            extra,
          );
        default:
          return apiError(
            409,
            "not_cancellable",
            "Bu rezervasyon iptal edilemez durumda (zaten iptal edilmiş ya da iadesi sürüyor).",
            undefined,
            extra,
          );
      }
    }
    return apiJson(
      {
        reservation: toReservationJson(result.reservation),
        refunded: result.refunded,
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
    console.error("[api/mobile/v1/karaoke/reservations/[id]/cancel]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
