import { isDbUnreachable } from "@/lib/db/health";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import {
  createReservation,
  listMine,
  toReservationJson,
} from "@/lib/mobile/karaoke";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { notifyOperatorOfReservation } from "@/lib/mobile/karaoke-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const MSG = {
  dbDown:
    "Rezervasyon servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  badJson: "İstek gövdesi geçerli JSON olmalı.",
  internal: "Beklenmeyen bir hata oluştu.",
  unverified: "Rezervasyon yapabilmek için önce e-postanı doğrula.",
} as const;

/** GET /api/mobile/v1/karaoke/reservations — the member's own bookings (§7). */
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

/** POST /api/mobile/v1/karaoke/reservations → 201 · 400 · 409 slot_taken (§7). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_request", MSG.badJson);
  }

  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    // A booking holds the room for four hours and there is no payment behind
    // it; the same gate POST /orders has keeps an unconfirmed sign-up from
    // filling the calendar.
    if (!auth.customer.emailVerified) {
      return apiError(403, "email_unverified", MSG.unverified);
    }
    const result = await createReservation(auth.customer, body);
    if (!result.ok) {
      return apiError(result.status, result.error, result.message);
    }
    // The room is booked by hand, so a request nobody reads is a request
    // nobody honours. Awaited rather than fired and forgotten: this runtime
    // can freeze the moment the response is returned, and a 15-second budget
    // has room for one mail. Its failure is logged inside and never reaches
    // the member — the reservation is already written and visible in the
    // panel, and losing a booking over a bounced mail would be the worse bug.
    await notifyOperatorOfReservation(result.reservation);
    return apiJson(
      { reservation: toReservationJson(result.reservation) },
      { status: 201, private: true },
    );
  } catch (err) {
    if (isDbUnreachable(err)) return apiError(503, "unavailable", MSG.dbDown);
    console.error("[api/mobile/v1/karaoke/reservations POST]", err);
    return apiError(500, "internal", MSG.internal);
  }
}
