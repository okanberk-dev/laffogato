import { formatReservationDate } from "@/lib/mobile/karaoke-format";
import {
  KARAOKE_FREE_CANCEL_HOURS_MAX,
  istanbulTimeLabel,
  karaokeDeadlineFor,
  karaokeLateRefundMinor,
  type KaraokeCancelPolicy,
} from "@/lib/mobile/karaoke-time";

/**
 * The cancellation terms the karaoke screens print, read from the server and
 * never typed in here: the two sentences of the policy a booking made now
 * gets (the availability's `cancellationRules`, karaoke.ts), the last moment
 * a cancel still refunds everything, as a date and an hour, and what a late
 * cancel refunds of this total. The booking's own page reads its snapshot
 * the same way (karaoke-reservation-view.tsx).
 *
 * Pure and dependency-free like karaoke-time.ts, so the booking form (a
 * client component) can import it without the store or Zod.
 */

const ISTANBUL_OFFSET_MS = 3 * 60 * 60_000;

/**
 * "30 Ekim 2026, 18:00": an instant on the köşk's clock (CLAUDE.md rule
 * 22). The day is read after the fixed +3 shift, so a deadline a day or two
 * before the evening names its own day, not the booking's.
 */
export function karaokeInstantLabel(at: Date): string {
  const ms = at.getTime();
  if (!Number.isFinite(ms)) return "";
  const day = new Date(ms + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
  return `${formatReservationDate(day)}, ${istanbulTimeLabel(at.toISOString())}`;
}

/** What the availability carries about the policy (karaoke-core §7.1). */
export interface KaraokeTermsSource {
  freeCancelHours?: number;
  lateRefundPercent?: number;
  cancellationRules?: readonly string[];
}

export interface KaraokeBookingTerms {
  /** `[refundRule, lateRule]`, verbatim from the server. */
  rules: [string, string];
  /** The two numbers the sentences were made from: echoed with the booking. */
  policy: KaraokeCancelPolicy;
  /**
   * Until when a booking made NOW could be cancelled for the whole payment
   * ("30 Ekim 2026, 18:00"): this moment plus the window, ending at the
   * latest the minute before the start (`karaokeDeadlineFor`). `now` is the
   * form's moving clock (the server's at the draw plus the tab's elapsed
   * time), so it is never a moment already gone by. Null before an hour is
   * picked, or without the server's clock. The booking's own deadline is
   * fixed when it is written, moments later; the confirmation and the
   * booking's page print that one.
   */
  freeUntil: string | null;
  /**
   * What a cancel after that refunds of this total, in kuruş, when it is a
   * part of it (a late share of 1..99 %); null otherwise (the sentences
   * already say "tamamı" or "iade yapılmaz").
   */
  lateShareMinor: number | null;
}

const whole = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

/**
 * The terms of the booking being made, or null when the server sent no
 * readable rule (then nothing is printed, nothing is echoed, and a paid
 * booking cannot be sent: see `karaokeStepIssue`).
 */
export function karaokeBookingTerms(
  src: KaraokeTermsSource | null | undefined,
  pick: {
    date: string;
    startHour: number | null;
    totalMinor: number;
    /** The server's clock when the page was drawn; without it, never passed. */
    now?: Date;
  },
): KaraokeBookingTerms | null {
  if (!src) return null;
  const { freeCancelHours: h, lateRefundPercent: p, cancellationRules } = src;
  if (!whole(h, KARAOKE_FREE_CANCEL_HOURS_MAX) || !whole(p, 100)) return null;
  if (
    !Array.isArray(cancellationRules) ||
    cancellationRules.length !== 2 ||
    !cancellationRules.every((s) => typeof s === "string" && s.trim() !== "")
  ) {
    return null;
  }
  const policy: KaraokeCancelPolicy = {
    freeCancelHours: h,
    lateRefundPercent: p,
  };
  // The window a booking made now gets: from this moment for the policy's
  // hours, ending before the start (28 Eki 2026). Without the server's clock
  // there is no moment to count from, and the sentences stand alone.
  const deadline =
    pick.startHour !== null && pick.now
      ? karaokeDeadlineFor(
          policy,
          { date: pick.date, startHour: pick.startHour },
          pick.now,
        )
      : null;
  return {
    rules: [cancellationRules[0], cancellationRules[1]],
    policy,
    freeUntil:
      deadline && Number.isFinite(deadline.getTime())
        ? karaokeInstantLabel(deadline)
        : null,
    lateShareMinor:
      p > 0 && p < 100 ? karaokeLateRefundMinor(pick.totalMinor, p) : null,
  };
}
