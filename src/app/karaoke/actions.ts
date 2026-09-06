"use server";

import { revalidatePath } from "next/cache";

import { requireCustomer } from "@/lib/customer/auth";
import { isDbUnreachable } from "@/lib/db/health";
import { createReservation } from "@/lib/mobile/karaoke";

export interface BookKaraokeState {
  error?: string;
  /** Reservation number, set once the booking is taken. */
  booked?: { date: string; startHour: number; hours: number; guests: number };
}

/**
 * Book the karaoke room from the web.
 *
 * This deliberately calls `createReservation` — the same function
 * `POST /api/mobile/v1/karaoke/reservations` calls — rather than the endpoint
 * itself. The endpoint authenticates with a Supabase bearer token issued to
 * the phone; the web carries a bcrypt cookie session. Going through the
 * library keeps ONE set of rules (opening hours, longest block, the two-open-
 * bookings cap, the overlap exclusion constraint) for both surfaces without
 * touching the mobile contract or widening its auth.
 */
export async function bookKaraokeAction(
  _prev: BookKaraokeState,
  formData: FormData,
): Promise<BookKaraokeState> {
  const customer = await requireCustomer();

  if (!customer.emailVerified) {
    return {
      error:
        "Rezervasyon yapabilmek için önce e-postanı doğrula. Doğrulama bağlantısını hesabından yeniden gönderebilirsin.",
    };
  }

  const num = (key: string) => Number(formData.get(key));
  const input = {
    date: String(formData.get("date") ?? ""),
    startHour: num("startHour"),
    hours: num("hours"),
    guests: num("guests"),
    note: String(formData.get("note") ?? ""),
  };

  try {
    const result = await createReservation(customer, input);
    if (!result.ok) return { error: result.message };
    revalidatePath("/karaoke");
    return {
      booked: {
        date: result.reservation.date,
        startHour: result.reservation.startHour,
        hours: result.reservation.hours,
        guests: result.reservation.guests,
      },
    };
  } catch (err) {
    if (isDbUnreachable(err)) {
      return {
        error:
          "Rezervasyon servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      };
    }
    console.error("[karaoke/bookKaraokeAction]", err);
    return { error: "Beklenmeyen bir hata oluştu. Tekrar dener misin?" };
  }
}
