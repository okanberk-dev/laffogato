import { headers } from "next/headers";
import { z } from "zod";

import { clientIp } from "@/lib/admin/rate-limit";
import { getSettings } from "@/lib/admin/store";
import { isDbUnreachable } from "@/lib/db/health";
import { karaokeConsentVersion } from "@/lib/legal/store";
import { KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  KARAOKE_CONFIRMATIONS,
  listMine,
  toReservationJson,
} from "@/lib/mobile/karaoke";
import { bookKaraoke } from "@/lib/mobile/karaoke-payment";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MSG = {
  dbDown:
    "Rezervasyon servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  badJson: "İstek gövdesi geçerli JSON olmalı.",
  internal: "Beklenmeyen bir hata oluştu.",
  unverified: "Rezervasyon yapabilmek için önce e-postanı doğrula.",
  update:
    "Karaoke rezervasyonu artık rezervasyon sırasında kartla ödeniyor. Devam etmek için uygulamayı güncelle.",
  consent:
    "Ödemeden önce Ön Bilgilendirme Formu'nu ve Mesafeli Hizmet Sözleşmesi'ni onaylaman, Aydınlatma Metni'ni okuduğunu belirtmen gerekiyor.",
} as const;

/**
 * The two additive request fields (16 Eki 2026, §7). Both optional: an app
 * build from before them sends neither and is answered exactly as it reads.
 */
const PrepayFields = z.object({
  prepay: z.boolean().optional(),
  legalConsent: z.boolean().optional(),
});

/** GET /api/mobile/v1/karaoke/reservations - the member's own bookings (§7). */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const reservations = await listMine(auth.customer.email);
    return apiJson(
      { reservations: reservations.map(toReservationJson) },
      { private: true },
    );
  } catch (err) {
    if (isDbUnreachable(err)) return apiError(503, "unavailable", MSG.dbDown);
    console.error("[api/mobile/v1/karaoke/reservations GET]", err);
    return apiError(500, "internal", MSG.internal);
  }
}

/**
 * POST /api/mobile/v1/karaoke/reservations → 201 `{ reservation, payment }`
 * (§7).
 *
 * With prepayment on (`settings.karaokePrepay`, the default) a booking is an
 * unpaid hold confirmed only by its payment: the app sends `prepay: true`
 * and `legalConsent: true` and opens `payment.redirectUrl`. A build that does
 * not send `prepay` cannot pay, so it is told to update (426
 * `app_update_required`) instead of being taken as a pay-at-the-venue request
 * the köşk would never confirm. With prepayment off, every build gets the old
 * request flow (`payment: null`, `paymentStatus: "none"`).
 *
 * A build may echo the cancellation rule it showed (`expectedCancelPolicy`,
 * §7.1, optional): a rule the panel changed meanwhile is 409
 * `policy_changed` with the new rule, and nothing is booked.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_request", MSG.badJson);
  }
  const extra = PrepayFields.safeParse(body ?? {});
  if (!extra.success) {
    return apiError(400, "invalid_request", MSG.consent, undefined, {
      field: "legalConsent",
    });
  }

  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    // The same gate POST /orders has keeps an unconfirmed sign-up from
    // filling the calendar.
    if (!auth.customer.emailVerified) {
      return apiError(403, "email_unverified", MSG.unverified);
    }
    const { karaokePrepay } = await getSettings();
    const prepay = karaokePrepay && extra.data.prepay === true;
    if (karaokePrepay && !prepay) {
      return apiError(426, "app_update_required", MSG.update);
    }
    const ip = await clientIp();
    let legalConsent;
    if (prepay) {
      if (extra.data.legalConsent !== true) {
        return apiError(400, "invalid_request", MSG.consent, undefined, {
          field: "legalConsent",
        });
      }
      const h = await headers();
      legalConsent = {
        acceptedAt: new Date().toISOString(),
        documents: [...KARAOKE_CONSENT_DOCS],
        version: await karaokeConsentVersion(),
        confirmations: [...KARAOKE_CONFIRMATIONS],
        surface: "app" as const,
        ip,
        userAgent: (h.get("user-agent") ?? "").slice(0, 300),
      };
    }

    const result = await bookKaraoke(auth.customer, body, {
      channel: "app",
      prepay,
      legalConsent,
      buyerIp: ip,
    });
    if (!result.ok) {
      // `field` is additive (§7): an older app reads `error` and `message`
      // exactly as before. So is the new rule on 409 `policy_changed`
      // (§7.1), which only a request carrying `expectedCancelPolicy` gets.
      const retry =
        "retryAfterSeconds" in result && result.retryAfterSeconds
          ? { "Retry-After": String(result.retryAfterSeconds) }
          : undefined;
      const extra = {
        ...("field" in result && result.field ? { field: result.field } : {}),
        ...("policy" in result && result.policy ? result.policy : {}),
      };
      return apiError(
        result.status,
        result.error,
        result.message,
        retry,
        Object.keys(extra).length > 0 ? extra : undefined,
      );
    }
    return apiJson(
      {
        reservation: toReservationJson(result.reservation),
        payment: result.payment,
      },
      { status: 201, private: true },
    );
  } catch (err) {
    if (isDbUnreachable(err)) return apiError(503, "unavailable", MSG.dbDown);
    console.error("[api/mobile/v1/karaoke/reservations POST]", err);
    return apiError(500, "internal", MSG.internal);
  }
}
