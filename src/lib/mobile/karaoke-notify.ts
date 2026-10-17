import "server-only";

import { sendKaraokeOperatorEmail } from "@/lib/email/send";

import type { KaraokeReservation } from "./karaoke-core";

/**
 * Tells the köşk that a karaoke booking was just taken - by the app or by the
 * web `/karaoke` form (both land on `createReservation`).
 *
 * ## Why this file exists
 *
 * The room is held by hand: a reservation is written with
 * `status: "requested"` and a person confirms or cancels it from
 * /admin/mobil/karaoke. Until this, nothing told that person a request had
 * arrived - they had to open the panel and look. A booking made at 23:40 for
 * the following evening sat unread, and the member had been told in the app
 * that the köşk would come back to them.
 *
 * It is NOT the member's confirmation mail. `sendKaraokeConfirmationEmail`
 * and the `karaoke-rezervasyon` template are that, and their words are
 * "Saatin ayrıldı" - true only once staff have confirmed. Sending it here
 * would promise on their behalf.
 *
 * ## Why the failure is swallowed
 *
 * The reservation row is already written and already visible in the panel
 * when this runs. Losing a booking because Resend was unreachable would be a
 * worse bug than a missed notification, so the error is logged and the member
 * never sees it. A log line is the operator's signal that mail is broken;
 * Ayarlar → "Test e-postası gönder" is how they confirm it.
 */
const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/**
 * `2026-09-20` → `20 Eylül 2026`.
 *
 * Split by hand rather than through `Intl`: the stored date is a calendar day
 * in Istanbul with no time on it, and handing `new Date("2026-09-20")` to a
 * formatter reads it as UTC midnight - which in a negative-offset deployment
 * prints the day before. The month table is the whole cost of not having that
 * bug.
 */
function readableDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `20` + `2` → `20:00 - 22:00`. The room is booked in whole hours. */
function readableTime(startHour: number, hours: number): string {
  const pad = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  return `${pad(startHour)} - ${pad(startHour + hours)}`;
}

export async function notifyOperatorOfReservation(
  reservation: KaraokeReservation,
  source: "app" | "web" = "app",
): Promise<void> {
  try {
    const result = await sendKaraokeOperatorEmail({
      id: reservation.id,
      source,
      customerName: reservation.customerName,
      customerEmail: reservation.contactEmail || reservation.customerEmail,
      phone: reservation.contactPhone ?? "",
      date: readableDate(reservation.date),
      time: readableTime(reservation.startHour, reservation.hours),
      guests: reservation.guests,
      totalMinor: reservation.totalMinor,
      note: reservation.note ?? "",
    });
    if (!result.ok) {
      console.error(
        `[karaoke] operator notice not sent for ${reservation.id}: ${result.error}`,
      );
    }
  } catch (err) {
    console.error("[karaoke] operator notice threw", err);
  }
}
