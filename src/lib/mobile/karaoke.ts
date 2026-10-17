import "server-only";

import type { PublicCustomer } from "@/lib/customer/store";
import type { DbError } from "@/lib/db";

import { reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { getSettings } from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";
import {
  sendKaraokeCancellationEmail,
  sendKaraokeConfirmationEmail,
  type KaraokeEmailData,
} from "@/lib/email/send";

import { KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { SITE } from "@/lib/seo/site";

import { formatReservationDate, formatReservationTime } from "./karaoke-format";
import { karaokeLinkUrl } from "./karaoke-link";
import { istanbulClock } from "./venue";
import {
  buildSlots,
  KARAOKE_FREE_CANCEL_HOURS,
  KARAOKE_NO_REFUND_RULE,
  KARAOKE_OPEN_CAP,
  KARAOKE_REFUND_RULE,
  paymentDueFrom,
  paymentStatusOf,
  quoteReservation,
  rangeConflicts,
  validateReservationRequest,
  type KaraokeAvailability,
  type KaraokeLegalConsent,
  type KaraokeReservation,
  type KaraokeReservationStatus,
  type ReservationContact,
} from "./karaoke-core";

/**
 * Karaoke room reservations (docs/API-MOBILE.md §7) - the database-backed
 * half.
 *
 * One room, booked by the hour. The app asks which hours of a day are free,
 * the member requests a block, the staff confirm or cancel it from
 * /admin/mobil/karaoke. Money is computed here from
 * `settings.karaokeHourlyMinor` - no caller ever sends a price - and ORO
 * members get their discount at the moment of booking.
 *
 * Opening hour, closing hour, longest block, booking window and the ORO
 * percentage are business rules the staff edit at /admin/mobil/ayarlar
 * (`settings.mobileApp.karaoke`, docs/API-MOBILE.md §10). The pure helpers in
 * `karaoke-core.ts` take those rules as an argument so the browser, the tests
 * and the admin panel can reason about them without a database; the entry
 * points below read the live config through `getSettings()`.
 *
 * Two callers, one set of rules: `POST /api/mobile/v1/karaoke/reservations`
 * (Supabase bearer token, the phone) and `bookKaraokeAction` (bcrypt cookie
 * session, the web) both land on `createReservation`.
 */

/** Re-exported so every existing importer of this module keeps working. */
export * from "./karaoke-core";

// ─── Loyalty tier (optional dependency) ────────────────────────────────────

/**
 * The member's loyalty tier, or "" when it cannot be determined. The loyalty
 * module is owned by the rewards feature; a failure there must not block a
 * booking - the member simply pays the undiscounted price.
 */
async function resolveLoyaltyTier(email: string): Promise<string> {
  try {
    const mod = (await import("@/lib/mobile/loyalty")) as {
      getLoyalty?: (email: string) => Promise<{ tier?: string } | null>;
    };
    if (typeof mod.getLoyalty !== "function") return "";
    const loyalty = await mod.getLoyalty(email);
    return typeof loyalty?.tier === "string" ? loyalty.tier : "";
  } catch (err) {
    console.error(
      `[karaoke] loyalty tier unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

// ─── Persistence ───────────────────────────────────────────────────────────

function rows<T>(
  res: { data: T[] | null; error: DbError | null; status: number },
  ctx: string,
): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

function one<T>(
  res: { data: T | null; error: DbError | null; status: number },
  ctx: string,
): T | null {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data;
}

function check(
  res: { error: DbError | null; status: number },
  ctx: string,
): void {
  if (res.error) raiseDbError(ctx, res.error, res.status);
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function listByDate(date: string): Promise<KaraokeReservation[]> {
  const sb = getDb();
  return rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("date", date)
      .order("startHour", { ascending: true }),
    "karaoke.listByDate",
  );
}

export async function getAvailability(
  date: string,
  now: Date = new Date(),
): Promise<KaraokeAvailability> {
  const [settings, bookings] = await Promise.all([
    getSettings(),
    listByDate(date),
  ]);
  const clock = istanbulClock(now);
  const rules = settings.mobileApp.karaoke;
  return {
    date,
    slots: buildSlots(
      bookings,
      clock.date === date ? clock.minutes : undefined,
      rules,
    ),
    hourlyMinor: settings.karaokeHourlyMinor,
    capacity: settings.karaokeCapacity,
    oroDiscountPct: rules.oroDiscountPct,
    firstHour: rules.firstHour,
    closeHour: rules.closeHour,
    maxHours: rules.maxHours,
    bookingWindowDays: rules.bookingWindowDays,
    paymentRequired: settings.karaokePrepay,
    freeCancelHours: KARAOKE_FREE_CANCEL_HOURS,
    consentDocs: [...KARAOKE_CONSENT_DOCS],
    privacyDoc: "kvkk-aydinlatma-metni",
    cancellationRules: [KARAOKE_REFUND_RULE, KARAOKE_NO_REFUND_RULE],
  };
}

export type CreateReservationResult =
  | { ok: true; reservation: KaraokeReservation }
  | {
      ok: false;
      status: 400 | 409 | 429;
      error:
        | "invalid_request"
        | "slot_taken"
        | "too_many_reservations"
        | "rate_limited";
      message: string;
      /**
       * §7: the request field a 400 is about - `note`, or `legalConsent`
       * when a paid booking arrives without its confirmation.
       */
      field?: "note" | "legalConsent";
      /** With 429 `rate_limited`: seconds until another hold is accepted. */
      retryAfterSeconds?: number;
    };

/** What a booking is, beyond the evening itself (16 Eki 2026). */
export interface CreateReservationOptions {
  /** Where it was made: the `/karaoke` form or `POST /karaoke/reservations`. */
  channel?: "web" | "app";
  /**
   * A web booking without an account: `customer` is then the contact the
   * form collected, it is always prepaid, never discounted by a member's
   * tier, and capped per address AND per phone number.
   */
  guest?: boolean;
  /** The caller's address, for the guest per-IP budget. */
  ip?: string;
  /**
   * Hold the hour for an online payment rather than take a request paid at
   * the venue. Honoured only while `settings.karaokePrepay` is on; the
   * reservation's `paymentStatus` says which one the caller got.
   */
  prepay?: boolean;
  /** Required with an honoured `prepay` (MSY m.7): the record of the boxes. */
  legalConsent?: KaraokeLegalConsent;
}

const MSG_CONSENT_REQUIRED =
  "Ödemeden önce ön bilgilendirme formunu ve hizmet sözleşmesini onaylaman gerekiyor.";

const MSG_GUEST_PREPAY_OFF =
  "Üye olmadan rezervasyon şu an alınmıyor. Giriş yaparak rezervasyon yapabilirsin.";

/**
 * Unpaid guest holds allowed at the same time, whoever makes them. Small on
 * purpose: a hold lives about 45 minutes (page + grace) and guests are
 * unverified; a paid booking, or a member's hold, is never counted.
 */
export const KARAOKE_GUEST_PENDING_CAP = 4;

function rateLimited(retryAfterSeconds: number): CreateReservationResult {
  const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
  return {
    ok: false,
    status: 429,
    error: "rate_limited",
    message: `Ödenmemiş çok sayıda rezervasyon denemen oldu. ${hours} saat sonra yeniden dene ya da bizi ara.`,
    retryAfterSeconds,
  };
}

/**
 * Books the room for a member. Price from settings, discount from the loyalty
 * tier. A request paid at the venue is `requested` until the staff confirm;
 * a prepaid one is an unpaid hold (`paymentStatus: "pending"`) that its
 * payment confirms (`karaoke-payment.ts`) or the sweep lets lapse.
 *
 * The conflict check reads before it writes. The window between the two is
 * closed by `karaoke_reservations_no_overlap` (an exclusion constraint over
 * date × hour range, cancelled rows excluded): the JS check answers with a
 * message the member can act on, the constraint is what makes it true when
 * two people tap the same free hour in the same second.
 */
export async function createReservation(
  customer: Pick<PublicCustomer, "email" | "name">,
  input: unknown,
  now: Date = new Date(),
  /** Web form only; the app does not send contact details. */
  contact?: ReservationContact,
  options: CreateReservationOptions = {},
): Promise<CreateReservationResult> {
  const settings = await getSettings();
  const rules = settings.mobileApp.karaoke;
  const clock = istanbulClock(now);
  const validated = validateReservationRequest(input, {
    today: clock.date,
    capacity: settings.karaokeCapacity,
    nowMinutes: clock.minutes,
    rules,
  });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      message: validated.message,
      ...(validated.field ? { field: validated.field } : {}),
    };
  }
  const req = validated.value;
  const guest = options.guest === true;
  // A guest is always a paid booking: with the switch off there is no
  // account to confirm a request against, so the guest form is closed.
  if (guest && (!settings.karaokePrepay || !contact)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      message: MSG_GUEST_PREPAY_OFF,
    };
  }
  // The panel's switch decides; a caller asking for prepay while it is off
  // gets the request flow, which its reservation's `paymentStatus` reports.
  const prepay =
    (guest || options.prepay === true) && settings.karaokePrepay === true;
  if (prepay && !options.legalConsent) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      message: MSG_CONSENT_REQUIRED,
      field: "legalConsent",
    };
  }

  // A guest is counted per network before anything else runs: the sweep
  // below asks the POS about up to KARAOKE_SWEEP_BATCH holds, and a flood of
  // refused guest attempts must not turn into a flood of POS calls.
  if (guest) {
    const byIp = await reserveLoginAttempt(
      "karaoke-guest-ip",
      options.ip ?? "",
      "*",
    );
    if (byIp.blocked) return rateLimited(byIp.retryAfterSeconds);
  }

  // Unpaid holds that have lapsed give their hours back before this booking
  // counts the member's open ones or looks for a free hour - after the POS
  // was asked about each (rule 29). Housekeeping: never fatal.
  try {
    const { expireUnpaidReservations } = await import("./karaoke-payment");
    await expireUnpaidReservations(now);
  } catch (err) {
    console.error("[karaoke] expiring unpaid holds failed", err);
  }

  // A member may hold a couple of open bookings, not the whole calendar. A
  // guest the same, counted per address and per phone number among GUEST
  // bookings only - a typed address must not use up a member's own cap (the
  // trigger counts the two apart as well).
  const isOpen = (r: KaraokeReservation) =>
    r.status !== "cancelled" && r.date >= clock.date;
  const mine = guest
    ? (await listByAddress(customer.email)).filter((r) => r.guest)
    : await listMine(customer.email);
  if (mine.filter(isOpen).length >= KARAOKE_OPEN_CAP) {
    return tooManyReservations();
  }
  if (guest && contact) {
    const byPhone = await listGuestByPhone(contact.phone);
    if (byPhone.filter(isOpen).length >= KARAOKE_OPEN_CAP) {
      return tooManyReservations();
    }
    // Phone and address are unverified, so beyond the per-network budget the
    // room is protected by a ceiling on unpaid guest holds at any one time:
    // squatting can block at most this many blocks for one page's life, and
    // members are never held back by it.
    if ((await countPendingGuestHolds()) >= KARAOKE_GUEST_PENDING_CAP) {
      return {
        ok: false,
        status: 409,
        error: "too_many_reservations",
        message:
          "Şu an ödemesi beklenen çok sayıda üyeliksiz rezervasyon var. Birkaç dakika sonra yeniden dene ya da giriş yaparak rezervasyon yap.",
      };
    }
  }

  const bookings = await listByDate(req.date);
  if (rangeConflicts(req.startHour, req.hours, bookings)) {
    return {
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    };
  }

  // Last, so a refusal above (a taken hour, the cap) costs nothing: each NEW
  // unpaid hold counts against the member's day (`karaoke-hold`), counted
  // before the write so a parallel burst cannot slip past it. A payment
  // clears the count (`applyKaraokePaymentSucceeded`).
  if (prepay) {
    // A guest's typed address has its own bucket: filling it must not lock
    // the member who really owns that address out of booking.
    const gate = await reserveLoginAttempt(
      "karaoke-hold",
      "",
      karaokeHoldKey(customer.email, guest),
    );
    if (gate.blocked) return rateLimited(gate.retryAfterSeconds);
  }
  if (guest && contact) {
    // Without an account the phone number is the other handle: each new
    // guest hold counts against it too, so a fresh address per attempt does
    // not reset the budget.
    const byPhone = await reserveLoginAttempt(
      "karaoke-hold",
      "",
      `phone:${contact.phone}`,
    );
    if (byPhone.blocked) return rateLimited(byPhone.retryAfterSeconds);
  }

  // A guest typed an address; it proves nothing, so it buys no member's
  // discount (the tier is read by address).
  const tier = guest ? "" : await resolveLoyaltyTier(customer.email);
  const quote = quoteReservation(
    req.hours,
    settings.karaokeHourlyMinor,
    tier,
    rules.oroDiscountPct,
  );
  const seq = await nextSeq("krk");
  const iso = now.toISOString();
  const reservation: KaraokeReservation = {
    id: `krk-${String(seq).padStart(5, "0")}`,
    customerEmail: normalizeEmail(customer.email),
    customerName: contact?.name || customer.name,
    ...(contact
      ? {
          contactEmail: contact.email,
          contactPhone: contact.phone,
          contactConsentAt: contact.consentAt,
        }
      : {}),
    date: req.date,
    startHour: req.startHour,
    hours: req.hours,
    guests: req.guests,
    status: "requested",
    ...quote,
    note: req.note,
    createdAt: iso,
    updatedAt: iso,
    // The hour is held for the first payment page's life; opening the page
    // (`startKaraokePayment`) moves it to that page's own deadline.
    paymentStatus: prepay ? "pending" : "none",
    paymentDueAt: prepay ? paymentDueFrom(now) : "",
    paidAt: "",
    refundedAt: "",
    paidMinor: 0,
    paymentRef: "",
    channel: options.channel ?? "",
    legalConsent: prepay ? (options.legalConsent ?? null) : null,
    guest,
  };

  const sb = getDb();
  const ins = await sb.from(TABLES.karaokeReservations).insert(reservation);
  // The count above is the friendly answer; the trigger `karaoke_open_cap`
  // holds when two bookings arrive at the same moment.
  if (/TOO_MANY_OPEN_RESERVATIONS/.test(ins.error?.message ?? "")) {
    return tooManyReservations();
  }
  // 23P01: the exclusion constraint caught a booking that landed between our
  // read and our write. Same answer as the read-side check.
  if (ins.error?.code === "23P01") {
    return {
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    };
  }
  check(ins, "karaoke.createReservation");
  return { ok: true, reservation };
}

function tooManyReservations(): CreateReservationResult {
  return {
    ok: false,
    status: 409,
    error: "too_many_reservations",
    message: `Aynı anda en fazla ${KARAOKE_OPEN_CAP} açık rezervasyonun olabilir.`,
  };
}

/** The member's own reservations, newest date first. */
export async function listMine(email: string): Promise<KaraokeReservation[]> {
  const needle = normalizeEmail(email);
  if (!needle) return [];
  const sb = getDb();
  // `ieq` (lower(col) = lower($1)), not an `ilike` prefilter: ILIKE has no
  // btree opclass, so `karaoke_reservations_email_idx` (on lower()) could
  // never be chosen and every call scanned the table (WP1: 47 ms -> 0.07 ms
  // at 50k bookings). The exact compare below stays as the final word.
  const candidates = rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .ieq("customerEmail", needle)
      .order("date", { ascending: false })
      .order("startHour", { ascending: false }),
    "karaoke.listMine",
  );
  // A guest booking made with the member's address is not the member's: the
  // address was typed, never verified. It is reached by its signed link.
  return candidates.filter(
    (r) => normalizeEmail(r.customerEmail) === needle && !r.guest,
  );
}

/**
 * Every booking under an address, guest ones included - for the per-address
 * cap and for closing an account (the person who verified the address owns
 * what was booked with it).
 */
export async function listByAddress(
  email: string,
): Promise<KaraokeReservation[]> {
  const needle = normalizeEmail(email);
  if (!needle) return [];
  const candidates = rows<KaraokeReservation>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("*")
      .ieq("customerEmail", needle)
      .order("date", { ascending: false }),
    "karaoke.listByAddress",
  );
  return candidates.filter((r) => normalizeEmail(r.customerEmail) === needle);
}

/** Unpaid guest holds open right now, across the whole room. */
async function countPendingGuestHolds(): Promise<number> {
  return rows<{ id: string }>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("id")
      .eq("guest", true)
      .eq("paymentStatus", "pending")
      .limit(KARAOKE_GUEST_PENDING_CAP + 1),
    "karaoke.countPendingGuestHolds",
  ).length;
}

/**
 * The `karaoke-hold` budget's identity: the member's address, or - for a
 * guest - the typed address in a namespace of its own.
 */
export function karaokeHoldKey(email: string, guest: boolean): string {
  const e = normalizeEmail(email);
  return guest ? `guest:${e}` : e;
}

/** Guest bookings under one (normalised) phone number. */
async function listGuestByPhone(phone: string): Promise<KaraokeReservation[]> {
  if (!phone) return [];
  return rows<KaraokeReservation>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("contactPhone", phone)
      .eq("guest", true),
    "karaoke.listGuestByPhone",
  );
}

/**
 * The member's bookings the staff confirmed or cancelled at or after
 * `sinceIso` - what the app's inbox tells them about (docs/API-MOBILE.md §8).
 *
 * `updatedAt` is written when a booking is made and when its status moves
 * (`setReservationStatus`, a cancellation, a lapsed hold), never by anything
 * else - a payment landing does not touch it - so on a confirmed or
 * cancelled row it IS the instant of the decision. Matched like `listMine`:
 * indexed `ieq`, exact compare after.
 *
 * A hold that lapsed unpaid (`paymentStatus: "expired"`) is not a decision
 * anybody made about the member's evening: it is a checkout they walked
 * away from, and telling them "iptal edildi" about it would be noise.
 */
export async function listReservationDecisions(
  email: string,
  sinceIso: string,
): Promise<KaraokeReservation[]> {
  const needle = normalizeEmail(email);
  if (!needle) return [];
  // Indexed case-insensitive equality, as in `listMine` (WP1: this runs on
  // every inbox read; 66 ms -> 0.07 ms at 50k bookings).
  const candidates = rows<KaraokeReservation>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("*")
      .ieq("customerEmail", needle)
      .in("status", ["confirmed", "cancelled"])
      .neq("paymentStatus", "expired")
      .gte("updatedAt", sinceIso),
    "karaoke.listReservationDecisions",
  );
  return candidates.filter(
    (r) => normalizeEmail(r.customerEmail) === needle && !r.guest,
  );
}

// ─── Admin ─────────────────────────────────────────────────────────────────

/** Every reservation from `fromDate` on (default: today), soonest first. */
export async function listReservationsForAdmin(
  fromDate?: string,
): Promise<KaraokeReservation[]> {
  const from = fromDate ?? istanbulClock(new Date()).date;
  const sb = getDb();
  return rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .gte("date", from)
      .order("date", { ascending: true })
      .order("startHour", { ascending: true }),
    "karaoke.listReservationsForAdmin",
  );
}

export async function getReservation(
  id: string,
): Promise<KaraokeReservation | null> {
  const sb = getDb();
  return one<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    "karaoke.getReservation",
  );
}

/**
 * Which status a booking may move to, from where.
 *
 * Without this, the confirm action was an unguarded write: a cancelled
 * booking whose hour had since been given to someone else could be confirmed
 * back into a double booking, and a completed evening could be "cancelled"
 * days later. The panel only offers the legal moves; this makes them the
 * only ones the endpoint accepts.
 */
const RESERVATION_TRANSITIONS: Record<
  KaraokeReservationStatus,
  readonly KaraokeReservationStatus[]
> = {
  requested: ["requested"],
  confirmed: ["requested"],
  cancelled: ["requested", "confirmed"],
};

/**
 * Why a status change did not happen. The panel showed one combined sentence
 * listing every possibility because this used to answer a bare `null`; each
 * reason needs a different thing from the staff member, so each is named.
 */
export type SetReservationStatusFailure =
  /** No row with that id - deleted, or a stale page. */
  | "not_found"
  /** The row has already moved somewhere this transition cannot start from. */
  | "wrong_status"
  /** Another confirmed booking already holds the hour. */
  | "slot_taken"
  /** Someone else changed it between the read and the write. */
  | "raced"
  /**
   * The booking is paid online, or waiting for its payment: its payment
   * confirms it, and cancelling it is `cancelKaraokeReservation`'s job (a
   * refund, or a question to the POS first). This path moves no money.
   */
  | "payment_open";

export type SetReservationStatusResult =
  | {
      ok: true;
      reservation: KaraokeReservation;
      /**
       * Did the member's confirmation/cancellation mail leave? The booking
       * stands either way - a provider outage must not fail the staff
       * member's action - but the panel says so, because a member who was
       * not told is a member who turns up (or does not) on the wrong
       * assumption.
       */
      notified: boolean;
    }
  | { ok: false; reason: SetReservationStatusFailure };

/**
 * Moves a booking's `status` - the staff's Onayla, and the paid booking's own
 * confirmation - and tells the member.
 *
 * Money never moves here. A booking that is waiting for its payment cannot be
 * confirmed by hand (its payment confirms it; confirming it unpaid would let
 * it hold the hour without ever being swept), and only a pay-at-the-venue
 * booking is cancelled through this path: a paid one needs its refund, an
 * unpaid hold needs the POS asked first (rule 29), and both are
 * `cancelKaraokeReservation` in karaoke-payment.ts.
 */
export async function setReservationStatus(
  id: string,
  status: KaraokeReservationStatus,
  now: Date = new Date(),
): Promise<SetReservationStatusResult> {
  const existing = await getReservation(id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (!RESERVATION_TRANSITIONS[status].includes(existing.status)) {
    return { ok: false, reason: "wrong_status" };
  }
  const payment = paymentStatusOf(existing);
  // Never confirmed without its money (operator, 16 Eki 2026: "ödemeyi
  // almadan rezervasyonları onaylama"): a paid booking, or - only while the
  // panel has prepayment switched OFF - a request paid at the venue.
  const moneyAllows =
    status === "confirmed"
      ? payment === "paid" ||
        (payment === "none" && !(await getSettings()).karaokePrepay)
      : status === "cancelled"
        ? payment === "none"
        : true;
  if (!moneyAllows) return { ok: false, reason: "payment_open" };

  // Confirming takes the hour: refuse if another confirmed booking has it.
  if (status === "confirmed") {
    const sameDay = await listByDate(existing.date);
    const clash = rangeConflicts(
      existing.startHour,
      existing.hours,
      sameDay.filter((r) => r.id !== existing.id && r.status === "confirmed"),
    );
    if (clash) return { ok: false, reason: "slot_taken" };
  }

  const sb = getDb();
  const updated = rows<{ id: string }>(
    await sb
      .from(TABLES.karaokeReservations)
      .update({ status, updatedAt: now.toISOString() })
      .eq("id", id)
      // The status guard is what makes the write lose the race rather than
      // overwrite it: the row has moved on since `existing` was read. The
      // payment guard does the same for money: a payment or a refund that
      // landed in between must not be confirmed or cancelled over.
      .eq("status", existing.status)
      .eq("paymentStatus", payment)
      .select("id"),
    "karaoke.setReservationStatus",
  );
  if (updated.length === 0) return { ok: false, reason: "raced" };
  const reservation: KaraokeReservation = {
    ...existing,
    status,
    updatedAt: now.toISOString(),
  };
  const notified = await notifyReservationStatus(reservation);
  return { ok: true, reservation, notified };
}

// ─── Notifying the member ──────────────────────────────────────────────────

export { formatReservationDate, formatReservationTime };

/**
 * Tells the member what just happened to their evening.
 *
 * Both messages are TRANSACTIONAL: the member asked for the room and is being
 * told whether they have it. No consent gate, no unsubscribe link (6563 does
 * not reach a message like this, and `renderEmail` refuses to put a way out
 * on either template). A booking paid online is told what was paid and on
 * which terms (the confirmation is its receipt), and a refund how much went
 * back.
 *
 * TETİKLEYİCİ: `setReservationStatus` (the panel's buttons, a payment's own
 * confirmation) and the cancellations in karaoke-payment.ts - never a request
 * the member can repeat to mail themselves.
 * IDEMPOTENCY: the guards on the UPDATE before each call. The row moves
 * requested → confirmed (or → cancelled) exactly once; a second attempt
 * finds the row already there, loses the race and returns before this.
 *
 * Failure is swallowed on purpose, as in `sendOrderPlacedEmail`: the booking
 * IS confirmed, and the staff member's action must not fail because a mail
 * provider did. A failure is logged with the address masked (KVKK).
 */
/**
 * The booking's page for its mail: the signed link, which opens it for the
 * address the mail goes to. A deployment without a signing secret still
 * mails - pointing a member at their account, a guest at the karaoke page.
 */
function manageUrlFor(r: KaraokeReservation): string {
  try {
    return karaokeLinkUrl(r);
  } catch (err) {
    console.error("[karaoke] booking link unavailable", err);
    return r.guest ? `${SITE.url}/karaoke` : `${SITE.url}/uye/hesap/karaoke`;
  }
}

export async function notifyReservationStatus(
  r: KaraokeReservation,
): Promise<boolean> {
  if (r.status !== "confirmed" && r.status !== "cancelled") return true;
  // The address the member gave on the form for exactly this, else the
  // account's.
  const to = r.contactEmail?.trim() || r.customerEmail;
  if (!to) return false;
  const money = paymentStatusOf(r);
  const paidOnline =
    money === "paid" || money === "refunding" || money === "refunded";
  const payload: KaraokeEmailData = {
    to,
    name: r.customerName,
    date: formatReservationDate(r.date),
    time: formatReservationTime(r.startHour, r.hours),
    guests: r.guests,
    // No `code` column and none needed: the id is unique, sequential and
    // readable - "KRK-00042" is what the member is asked for at the door.
    code: r.id,
    payment: paidOnline
      ? { kind: "online", paidMinor: r.paidMinor ?? r.totalMinor }
      : { kind: "venue" },
    manageUrl: manageUrlFor(r),
    ...(r.status === "cancelled" && money === "refunded"
      ? { refundedMinor: r.paidMinor ?? r.totalMinor }
      : {}),
  };
  try {
    return r.status === "confirmed"
      ? await sendKaraokeConfirmationEmail(payload)
      : await sendKaraokeCancellationEmail(payload);
  } catch (err) {
    const at = r.customerEmail.indexOf("@");
    const masked =
      at < 1
        ? "***"
        : `${r.customerEmail.slice(0, 2)}***${r.customerEmail.slice(at)}`;
    console.error(`[karaoke] ${r.id} bildirimi gönderilemedi (${masked})`, err);
    return false;
  }
}
