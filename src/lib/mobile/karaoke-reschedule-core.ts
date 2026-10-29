/**
 * Moving a karaoke booking to another day or hour from the panel (operator,
 * 27 Eki 2026: "admin panelden saati değiştirebilir yap, değişince de kişiye
 * mail gitsin").
 *
 * Only the evening moves: the length, the party, the price, the payment and
 * the cancellation policy the booking was made under stay as they were. The
 * policy's deadline is recounted under the rule the booking was made under
 * (`karaokeMovedDeadline`): from the booking, capped before the new start,
 * since 28 Eki 2026; back from the new start for a booking made before.
 * Everything the evening's end decides follows the new start (the signed
 * link, the e-Arşiv invoice's due time).
 *
 * Pure, with no Zod and no database: the panel's plan
 * (lib/admin/karaoke-panel.ts, client-safe), the dialog, the server
 * (`rescheduleReservation` in karaoke.ts) and the tests read one rule.
 */

import { karaokeEndInstant } from "./karaoke-time";

/** Why a booking cannot be moved; null when it can. */
export type KaraokeRescheduleBlock =
  /** Cancelled: it holds no hour to move. */
  | "cancelled"
  /** Its evening is over. */
  | "ended"
  /**
   * An unpaid hold (its payment page names the old evening, and the sweep
   * may let it go any minute), or money on its way back.
   */
  | "payment_open";

export const KARAOKE_RESCHEDULE_REFUSAL: Record<
  KaraokeRescheduleBlock,
  string
> = {
  cancelled: "İptal edilmiş bir rezervasyonun saati değiştirilemez.",
  ended:
    "Bu rezervasyonun saati geçti; geçmiş bir rezervasyonun saati değiştirilemez.",
  payment_open:
    "Ödemesi beklenen ya da iadesi süren bir rezervasyonun saati değiştirilemez. Ödeme ya da iade sonuçlanınca yeniden dene.",
};

/**
 * Which bookings can be moved: one still holding its hour (requested or
 * confirmed), whose evening is not over, paid online or paid at the köşk.
 * An evening already under way may still move (a party that came late),
 * but only to an hour that has not begun (`validateReservationRequest`).
 */
export function karaokeRescheduleBlock(
  r: {
    status: string;
    date: string;
    startHour: number;
    hours: number;
    paymentStatus?: string | null;
  },
  now: Date,
): KaraokeRescheduleBlock | null {
  if (r.status === "cancelled") return "cancelled";
  if (karaokeEndInstant(r).getTime() <= now.getTime()) return "ended";
  const money = r.paymentStatus || "none";
  if (money !== "none" && money !== "paid") return "payment_open";
  return null;
}

/**
 * The start hours the dialog offers for a block of `hours`: every hour from
 * the room's first to the last one that still ends by closing time.
 */
export function karaokeRescheduleStarts(
  hours: number,
  rules: { firstHour: number; closeHour: number },
): number[] {
  const starts: number[] = [];
  for (let h = rules.firstHour; h + hours <= rules.closeHour; h += 1) {
    starts.push(h);
  }
  return starts;
}

/**
 * What the dialog's date and hour boxes offer: today to the last day the
 * room's calendar is open (YYYY-MM-DD, the köşk's calendar), and the room's
 * first and closing hour. The server checks the same window.
 */
export interface KaraokeRoomCalendar {
  today: string;
  lastDay: string;
  firstHour: number;
  closeHour: number;
}

export function karaokeRoomCalendar(
  rules: { firstHour: number; closeHour: number; bookingWindowDays: number },
  today: string,
): KaraokeRoomCalendar {
  const [y, m, d] = today.split("-").map((n) => parseInt(n, 10));
  const lastDay = new Date(
    Date.UTC(y, m - 1, d + Math.max(0, rules.bookingWindowDays)),
  )
    .toISOString()
    .slice(0, 10);
  return {
    today,
    lastDay,
    firstHour: rules.firstHour,
    closeHour: rules.closeHour,
  };
}

/**
 * The room's rules a move is checked against: the panel's, except that a
 * booking longer than today's longest block (the setting was lowered after
 * it was made) keeps its own length.
 */
export function karaokeRescheduleRules<T extends { maxHours: number }>(
  rules: T,
  hours: number,
): T {
  return hours > rules.maxHours ? { ...rules, maxHours: hours } : rules;
}
