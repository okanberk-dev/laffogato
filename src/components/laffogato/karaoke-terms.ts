import { formatReservationDate } from "@/lib/mobile/karaoke-format";
import {
  KARAOKE_FREE_CANCEL_HOURS_MAX,
  istanbulTimeLabel,
  karaokeDeadlineFor,
  karaokeFreeCancelEnd,
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
   * Until when a cancel refunds the whole payment ("30 Ekim 2026, 18:00"; at
   * 0 hours the start itself); null before an hour is picked, or once that
   * moment has passed (`freePassed`).
   */
  freeUntil: string | null;
  /**
   * The picked hour is already inside the window when the page was drawn
   * (tonight at 21:00 with two free hours, at 19:30): there is no free
   * cancel left to name, every cancel after booking is late.
   */
  freePassed: boolean;
  /**
   * What a cancel after that refunds of this total, in kuruş, when it is a
   * part of it (a late share of 1..99 % behind a free window); null
   * otherwise (the sentences already say "tamamı" or "iade yapılmaz", and
   * at 0 hours there is no late cancel).
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
  // The start minus the window; 0 hours is the start itself (free until
  // then, ASK-OTH-3-CFG).
  const deadline =
    pick.startHour !== null
      ? karaokeDeadlineFor(policy, {
          date: pick.date,
          startHour: pick.startHour,
        })
      : null;
  // A deadline already behind the clock is not a moment to cancel before:
  // the booking's own snapshot would be late from the start
  // (`withinFreeCancel` counts the named minute itself: the page printed
  // at 18:00:30 still names 18:00, and a cancel then refunds in full).
  const nowMs = pick.now?.getTime();
  const freePassed =
    deadline !== null &&
    nowMs !== undefined &&
    Number.isFinite(nowMs) &&
    nowMs >= karaokeFreeCancelEnd(deadline);
  return {
    rules: [cancellationRules[0], cancellationRules[1]],
    policy,
    freeUntil: deadline && !freePassed ? karaokeInstantLabel(deadline) : null,
    freePassed,
    lateShareMinor:
      h > 0 && p > 0 && p < 100
        ? karaokeLateRefundMinor(pick.totalMinor, p)
        : null,
  };
}
