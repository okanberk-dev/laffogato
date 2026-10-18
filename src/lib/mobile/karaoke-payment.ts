import "server-only";

import type { PublicCustomer } from "@/lib/customer/store";
import type { DbError } from "@/lib/db";
import type { PaymentProvider } from "@/lib/payment/provider";

import { clearLoginLimit, reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { getSettings } from "@/lib/admin/store";
import { ensureCardUserKey } from "@/lib/customer/store";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import {
  sendKaraokeMoneyAlertEmail,
  sendKaraokePaidOperatorEmail,
} from "@/lib/email/send";
import { getPaymentProvider } from "@/lib/payment";
import { isPaymentRefused } from "@/lib/payment/provider";
import { SITE } from "@/lib/seo/site";
import { formatTRYMinor } from "@/lib/utils/commerce";

import {
  createReservation,
  formatReservationDate,
  formatReservationTime,
  getReservation,
  karaokeHoldKey,
  listMine,
  notifyReservationStatus,
  setReservationStatus,
  type CreateReservationResult,
} from "./karaoke";
import {
  isPartialRefund,
  karaokeCancellationRules,
  karaokeCancelPolicyOf,
  karaokeLateRefundMinor,
  karaokeSelfCancelTerms,
  mayReopenPayment,
  paymentDueFrom,
  paymentStatusOf,
  refundAmountOf,
  sweepCutoff,
  type KaraokeLegalConsent,
  type KaraokeReservation,
  type ReservationContact,
} from "./karaoke-core";
import { verifyKaraokeLink } from "./karaoke-link";
import { karaokeEndInstant } from "./karaoke-time";
import { notifyOperatorOfReservation } from "./karaoke-notify";
import { recordPendingCheckout } from "./checkout-ref";
import { istanbulClock } from "./venue";

/**
 * Online prepayment for the karaoke room (operator, 16 Eki 2026: "Karaokede
 * de ödeme alsın"). The other half of karaoke.ts: everything here moves money
 * or decides what money means for a booking.
 *
 * ## The life of a paid booking
 *
 * 1. `bookKaraoke` writes the booking as an unpaid hold (`status:
 *    "requested"`, `paymentStatus: "pending"`) - the hour is held by the
 *    overlap constraint and the cap like any request - and opens a payment
 *    page for exactly the booking's total (`startKaraokePayment`).
 * 2. The POS confirms the money (the browser return, `/odeme/donus`; or the
 *    sweep asking `PaymentList`), and `applyKaraokePaymentSucceeded` books
 *    it: the row becomes `paid`, then `confirmed` through the ordinary status
 *    path, so the member's confirmation (which is now also the receipt) and
 *    the köşk's notice each leave once.
 * 3. A hold nobody paid lapses: `expireUnpaidReservations` asks the POS first
 *    and only an answer of "no payment" (or a day of not being able to ask)
 *    releases the hour (CLAUDE.md rule 29).
 * 4. Cancelling (`cancelKaraokeReservation`): the member, before the
 *    deadline of the booking's own policy (its snapshot; 2 hours on older
 *    rows), and inside it while the policy gives a late share; the staff,
 *    any time and always in full (a business cancellation, MSY m.16/4); an
 *    account that closes. A paid booking's money goes back through the POS
 *    before the booking is cancelled - except a late cancel's share, which
 *    PayNkolay cannot send (whole payments only): the booking is cancelled,
 *    the share is owed (`refunding` + `refundMinor`), and a person refunds it
 *    in PayNkolay's panel and records it (`settleKaraokeRefundByHand`).
 *
 * ## Money that does not fit a booking
 *
 * A payment that lands for a hold that has already lapsed or been cancelled,
 * or a second charge for a booking that is already paid, is recorded, sent
 * back in full (the member must not pay for an hour they do not have), and
 * put in front of a person (audit row + mail). Exactly-which-payment is
 * `paymentRef`: the reference of the payment that paid the row.
 *
 * ## Refunds
 *
 * One refund per payment, claimed in `payment_transactions` under
 * `<providerRef>:refund` - the unique (provider, providerRef) index is the
 * lock, the way it is the lock for the payment itself. The POS's answer is
 * read three ways: done; declined (`PaymentRefusedError` - no money moved,
 * everything is put back); unknown (a timeout, a dropped line - it may have
 * gone through). An unknown answer is never rolled back: the booking stays
 * `refunding` and a person settles it from the panel.
 */

const FREE_PROVIDER = "free";
/** How long a sweep waits for the POS before leaving a hold for next time. */
const POS_LOOKUP_TIMEOUT_MS = 5_000;
/**
 * Past this age an unpaid hold is released even when the POS could not be
 * asked - an outage or a misconfiguration must not hold an hour for good. A
 * payment found afterwards still lands, and is sent back
 * (`applyKaraokePaymentSucceeded`).
 */
const POS_LOOKUP_GIVE_UP_MS = 24 * 60 * 60_000;
/** Unpaid holds one sweep looks at; the rest wait for the next booking. */
export const KARAOKE_SWEEP_BATCH = 20;

export const KARAOKE_PAYMENT_MESSAGES = {
  paymentUnavailable:
    "Ödeme altyapısına şu an ulaşılamıyor; rezervasyon oluşturulmadı ve kartından para çekilmedi. Birazdan tekrar dene.",
  reopenUnavailable:
    "Ödeme sayfası şu an açılamadı; kartından para çekilmedi. Birazdan tekrar dene.",
} as const;

// ─── Persistence ───────────────────────────────────────────────────────────

function rows<T>(
  res: { data: T[] | null; error: DbError | null; status: number },
  ctx: string,
): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

function check(
  res: { error: DbError | null; status: number },
  ctx: string,
): void {
  if (res.error) raiseDbError(ctx, res.error, res.status);
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** `YYYY-MM-DD` or ''. The column never holds a half-read provider date. */
function isoDay(value: string | undefined): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? (value as string) : "";
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** A payment row of a booking, as a refund needs it. */
interface PaymentRecord {
  provider: string;
  providerRef: string;
  status: string;
  amountMinor: number;
  /** `YYYY-MM-DD`, '' when the provider did not report one. */
  trxDate: string;
}

async function paymentRecord(
  reservationId: string,
  providerRef: string,
): Promise<PaymentRecord | null> {
  if (!providerRef) return null;
  const found = rows<PaymentRecord>(
    await getDb()
      .from(TABLES.paymentTransactions)
      .select("provider, providerRef, status, amountMinor, trxDate")
      .eq("orderId", reservationId)
      .eq("providerRef", providerRef)
      .limit(1),
    "karaoke.paymentRecord",
  );
  const row = found[0];
  return row
    ? {
        ...row,
        amountMinor: Number(row.amountMinor ?? 0),
        trxDate: isoDay(row.trxDate ?? ""),
      }
    : null;
}

/** Writes `patch` only while the row is still in `from`; true when it moved. */
async function moveRow(
  id: string,
  patch: Partial<KaraokeReservation>,
  from: {
    paymentStatus: string | readonly string[];
    status?: string;
  },
  ctx: string,
): Promise<boolean> {
  let q = getDb().from(TABLES.karaokeReservations).update(patch).eq("id", id);
  q =
    typeof from.paymentStatus === "string"
      ? q.eq("paymentStatus", from.paymentStatus)
      : q.in("paymentStatus", from.paymentStatus);
  if (from.status) q = q.eq("status", from.status);
  return rows<{ id: string }>(await q.select("id"), ctx).length > 0;
}

/**
 * The provider the sweeps ask, or null when none can be built (a deployment
 * without its POS configuration; tests). Resolved once per sweep.
 */
function lookupProvider(): PaymentProvider | null {
  try {
    return getPaymentProvider();
  } catch {
    return null;
  }
}

// ─── Telling people ────────────────────────────────────────────────────────

function readableSlot(r: KaraokeReservation): { date: string; time: string } {
  return {
    date: formatReservationDate(r.date),
    time: formatReservationTime(r.startHour, r.hours),
  };
}

/**
 * Money that needs a person: an audit row (the record) and a mail to the
 * karaoke address (the same day). Both best-effort - the money has already
 * done whatever it did, and failing to write about it must not undo that.
 */
async function alertMoney(
  r: KaraokeReservation,
  alert: {
    event: string;
    key: string;
    title: string;
    summary: string;
    footnote: string;
    amountMinor: number;
    providerRef: string;
    extra?: Record<string, unknown>;
  },
  /** `audit: false`: the caller writes the row itself, under its actor. */
  { audit = true }: { audit?: boolean } = {},
): Promise<void> {
  console.error(
    `[karaoke] ${alert.event} reservation=${r.id} ref=${alert.providerRef} amount=${alert.amountMinor}`,
  );
  if (audit) {
    try {
      const { logAudit } = await import("@/lib/admin/audit");
      await logAudit({
        actor: "system",
        action: "update",
        entity: "karaoke_reservation",
        entityId: r.id,
        payload: {
          event: alert.event,
          status: r.status,
          paymentStatus: paymentStatusOf(r),
          amountMinor: alert.amountMinor,
          providerRef: alert.providerRef,
          ...alert.extra,
        },
      });
    } catch (err) {
      console.error(
        `[karaoke] audit row for ${alert.event} failed ${r.id}`,
        err,
      );
    }
  }
  try {
    const slot = readableSlot(r);
    const sent = await sendKaraokeMoneyAlertEmail({
      id: r.id,
      key: alert.key,
      title: alert.title,
      summary: alert.summary,
      rows: [
        { label: "Tarih", value: slot.date },
        { label: "Saat", value: slot.time },
        { label: "Tutar", value: formatTRYMinor(alert.amountMinor) },
        { label: "POS referansı", value: alert.providerRef },
        { label: "Üye", value: r.customerName.trim() || "-" },
        { label: "E-posta", value: r.contactEmail || r.customerEmail },
      ],
      footnote: alert.footnote,
    });
    if (!sent.ok) {
      console.error(`[karaoke] money alert not sent ${r.id}: ${sent.error}`);
    }
  } catch (err) {
    console.error(`[karaoke] money alert threw ${r.id}`, err);
  }
}

async function auditStaff(
  r: KaraokeReservation,
  actor: string | undefined,
  action: "transition" | "refund",
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { logAudit } = await import("@/lib/admin/audit");
    await logAudit({
      ...(actor ? { actor } : {}),
      action,
      entity: "karaoke_reservation",
      entityId: r.id,
      payload: { date: r.date, startHour: r.startHour, ...payload },
    });
  } catch (err) {
    console.error(`[karaoke] audit row failed ${r.id}`, err);
  }
}

async function notifyPaid(r: KaraokeReservation): Promise<void> {
  try {
    const slot = readableSlot(r);
    const sent = await sendKaraokePaidOperatorEmail({
      id: r.id,
      source: r.channel === "app" ? "app" : "web",
      customerName: r.customerName,
      customerEmail: r.contactEmail || r.customerEmail,
      phone: r.contactPhone ?? "",
      date: slot.date,
      time: slot.time,
      guests: r.guests,
      paidMinor: r.paidMinor ?? r.totalMinor,
      note: r.note ?? "",
      guest: r.guest === true,
    });
    if (!sent.ok) {
      console.error(`[karaoke] paid notice not sent ${r.id}: ${sent.error}`);
    }
  } catch (err) {
    console.error(`[karaoke] paid notice threw ${r.id}`, err);
  }
}

// ─── Opening the payment page ──────────────────────────────────────────────

/** `payment` in the §7 answers: what the app (or the web form) opens. */
export interface KaraokePayment {
  provider: string;
  /** The site's own card page, `/odeme/paynkolay?d=…&s=…`. */
  redirectUrl: string;
  /** The provider's session lifetime (the order flow's `expiresAt`). */
  expiresAt: string;
}

export type StartKaraokePaymentResult =
  | {
      ok: true;
      reservation: KaraokeReservation;
      /** Null when nothing was owed: the booking is already paid. */
      payment: KaraokePayment | null;
    }
  | { ok: false; reason: "payment_unavailable" };

/**
 * The browser comes back to `/odeme/donus` either way; `app=1` only lets the
 * payment page itself (which may not read the database) word its expiry
 * notice for the app. Where the RETURN lands is the row's `channel`.
 */
function returnUrl(r: KaraokeReservation): string {
  return `${SITE.url}/odeme/donus${r.channel === "app" ? "?app=1" : ""}`;
}

/**
 * Opens a payment page for an unpaid hold, for exactly its total.
 *
 * A booking that owes nothing (an ORO discount set to 100 %) is settled on
 * the spot through the same path a payment takes - the POS refuses a 0.00
 * charge, and such a hold could otherwise never complete. The page's
 * deadline becomes the hold's `paymentDueAt`, so no page outlives its hold.
 */
export async function startKaraokePayment(
  reservation: KaraokeReservation,
  /** The member, or null for a guest booking (the row carries the contact). */
  customer: Pick<PublicCustomer, "id" | "email" | "name" | "phone"> | null,
  opts: { buyerIp?: string; now?: Date } = {},
): Promise<StartKaraokePaymentResult> {
  const now = opts.now ?? new Date();
  if (reservation.totalMinor <= 0) {
    const settled = await applyKaraokePaymentSucceeded({
      reservationId: reservation.id,
      provider: FREE_PROVIDER,
      providerRef: `${FREE_PROVIDER}_${reservation.id}`,
      amountMinor: 0,
      currency: "TRY",
      raw: { source: "zero_total" },
      now,
    });
    if (!settled.ok) {
      console.error(
        `[karaoke] settling a zero-total booking failed ${reservation.id}`,
        settled.error,
      );
    }
    return {
      ok: true,
      reservation: (await getReservation(reservation.id)) ?? reservation,
      payment: null,
    };
  }

  let provider: PaymentProvider;
  try {
    provider = getPaymentProvider();
  } catch (err) {
    console.error("[karaoke] payment provider unavailable", err);
    return { ok: false, reason: "payment_unavailable" };
  }
  // The member's saved cards at PayNkolay (docs/PAYNKOLAY.md §16) are the
  // same for a booking as for an order. Best-effort: a new card still works.
  // A guest has no account to keep cards under: no key, no list, no "kaydet".
  const member = customer && !reservation.guest ? customer : null;
  const cardUserKey = member
    ? await ensureCardUserKey(member.email).catch(() => "")
    : "";
  const buyer = {
    id: member?.id ?? `guest-${reservation.id}`,
    email:
      reservation.contactEmail || member?.email || reservation.customerEmail,
    fullName: reservation.customerName || member?.name || "",
    phone: reservation.contactPhone || member?.phone || undefined,
  };
  let session: Awaited<ReturnType<PaymentProvider["createCheckoutSession"]>>;
  try {
    const slot = readableSlot(reservation);
    session = await provider.createCheckoutSession({
      orderId: reservation.id,
      amountMinor: reservation.totalMinor,
      currency: "TRY",
      customer: buyer,
      billingAddress: { city: "", district: "", line1: "" },
      shippingAddress: { city: "", district: "", line1: "" },
      items: [
        {
          productId: "karaoke",
          name: `Karaoke odası · ${slot.date} ${slot.time}`,
          unitPriceMinor: reservation.totalMinor,
          quantity: 1,
        },
      ],
      successUrl: returnUrl(reservation),
      failureUrl: returnUrl(reservation),
      buyerIp: opts.buyerIp || undefined,
      cardUserKey: cardUserKey || undefined,
    });
  } catch (err) {
    console.error(
      `[karaoke] payment page not opened ${reservation.id}:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return { ok: false, reason: "payment_unavailable" };
  }
  // The proof the mock return checks; for PayNkolay an audit breadcrumb.
  await recordPendingCheckout(
    reservation.id,
    provider.name,
    session.providerRef,
  );
  // Read the clock AFTER the page exists: the page's own deadline is counted
  // from inside createCheckoutSession, so this is never earlier than it.
  const paymentDueAt = paymentDueFrom(new Date());
  // No `updatedAt`: it is the instant of a status change, and this is not one.
  await moveRow(
    reservation.id,
    { paymentDueAt },
    { paymentStatus: "pending", status: "requested" },
    "karaoke.startKaraokePayment",
  );
  return {
    ok: true,
    reservation: { ...reservation, paymentDueAt },
    payment: {
      provider: provider.name,
      redirectUrl: session.redirectUrl,
      expiresAt: session.expiresAt,
    },
  };
}

export type BookKaraokeResult =
  | {
      ok: true;
      reservation: KaraokeReservation;
      /** Null for a request paid at the venue, and for a booking owing 0. */
      payment: KaraokePayment | null;
    }
  | Extract<CreateReservationResult, { ok: false }>
  | {
      ok: false;
      status: 503;
      error: "payment_unavailable";
      message: string;
    };

/**
 * A booking from either surface - the `/karaoke` form and
 * `POST /karaoke/reservations` land here, so one set of rules holds for both
 * (CLAUDE.md: share through the library, not the endpoint).
 *
 * `prepay` is the caller's wish; the panel's switch decides
 * (`settings.karaokePrepay`). A request paid at the venue goes to the köşk
 * as before, and the staff confirm it. A prepaid one is an unpaid hold with a
 * payment page; the köşk hears of it when it is paid.
 */
export async function bookKaraoke(
  /** The signed-in member, or null for a web booking without an account. */
  customer: PublicCustomer | null,
  input: unknown,
  opts: {
    channel: "web" | "app";
    prepay: boolean;
    contact?: ReservationContact;
    legalConsent?: KaraokeLegalConsent;
    buyerIp?: string;
    now?: Date;
  },
): Promise<BookKaraokeResult> {
  const guest = customer === null;
  if (guest && !opts.contact) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      message: "Adını, soyadını, telefonunu ve e-postanı yaz.",
    };
  }
  const now = opts.now ?? new Date();
  // Ask for the POS before anything is written - the order path's lesson: a
  // deployment missing its POS configuration used to leave a booking behind
  // a failure. Only when a payment will actually be taken.
  if ((guest || opts.prepay) && (await getSettings()).karaokePrepay) {
    try {
      getPaymentProvider();
    } catch (err) {
      console.error("[karaoke] payment provider unavailable", err);
      return {
        ok: false,
        status: 503,
        error: "payment_unavailable",
        message: KARAOKE_PAYMENT_MESSAGES.paymentUnavailable,
      };
    }
  }

  const who = customer ?? {
    email: opts.contact?.email ?? "",
    name: opts.contact?.name ?? "",
  };
  const created = await createReservation(who, input, now, opts.contact, {
    channel: opts.channel,
    prepay: guest || opts.prepay,
    legalConsent: opts.legalConsent,
    guest,
    ip: opts.buyerIp,
  });
  if (!created.ok) return created;
  const reservation = created.reservation;

  if (paymentStatusOf(reservation) !== "pending") {
    // The request flow: the room is confirmed by hand, so the köşk is told
    // now. A failure is logged inside and never reaches the member.
    await notifyOperatorOfReservation(reservation, opts.channel);
    return { ok: true, reservation, payment: null };
  }

  const started = await startKaraokePayment(reservation, customer, {
    buyerIp: opts.buyerIp,
    now,
  });
  if (!started.ok) {
    // No payment page was ever opened for this hold, so no money can have
    // moved: the hour goes back now rather than in half an hour.
    await releaseUnpaidHold(reservation, now);
    return {
      ok: false,
      status: 503,
      error: "payment_unavailable",
      message: KARAOKE_PAYMENT_MESSAGES.paymentUnavailable,
    };
  }
  return {
    ok: true,
    reservation: started.reservation,
    payment: started.payment,
  };
}

/**
 * Who may act on a booking without being staff: the signed-in member it was
 * booked by (never a guest booking that merely carries their address), or
 * whoever holds its signed link (karaoke-link.ts). Never the id alone.
 */
export type KaraokeOwner =
  | {
      kind: "member";
      customer: Pick<
        PublicCustomer,
        "id" | "email" | "name" | "phone" | "emailVerified"
      >;
    }
  | { kind: "link"; token: string };

export function ownsReservation(
  owner:
    | { kind: "member"; customer: { email: string; emailVerified: boolean } }
    | { kind: "link"; token: string },
  r: KaraokeReservation,
  now: Date = new Date(),
): boolean {
  if (owner.kind === "member") {
    return (
      owner.customer.emailVerified === true &&
      !r.guest &&
      sameEmail(r.customerEmail, owner.customer.email)
    );
  }
  try {
    return verifyKaraokeLink(owner.token, r, now);
  } catch (err) {
    // No signing secret: no link opens anything.
    console.error("[karaoke] link check unavailable", err);
    return false;
  }
}

export type ReopenKaraokePaymentResult =
  | { ok: true; reservation: KaraokeReservation; payment: KaraokePayment }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_payable"; reservation: KaraokeReservation }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number }
  | {
      ok: false;
      reason: "payment_unavailable";
      reservation: KaraokeReservation;
    }
  /**
   * The POS could not say whether the last page was paid, or it collected a
   * different amount: a new page could charge on top of it (rule 29).
   */
  | { ok: false; reason: "payment_unknown"; reservation: KaraokeReservation };

/**
 * A fresh payment page for the member's own unpaid hold
 * (`POST /karaoke/reservations/{id}/payment`, the web "Ödemeyi tamamla").
 *
 * Only within `KARAOKE_PAYMENT_REOPEN_MINUTES` of the booking: each page lives
 * half an hour, and a hold renewed without end would hold its hour for as long
 * as somebody kept clicking. The POS is asked first - a payment whose return
 * never arrived is booked instead of being charged a second time, since
 * PayNkolay takes a second sale on the same reference - and every reopen
 * counts against the member's `checkout-reopen` budget, the one the order
 * reopen uses. Not knowing is never "not paid" (rule 29): a POS that cannot be
 * asked, or money collected at the wrong amount, opens no page
 * (`payment_unknown`).
 */
export async function reopenKaraokePayment(
  owner: KaraokeOwner,
  id: string,
  opts: { buyerIp?: string; now?: Date } = {},
): Promise<ReopenKaraokePaymentResult> {
  const now = opts.now ?? new Date();
  const r = await getReservation(id);
  if (!r || !ownsReservation(owner, r, now)) {
    return { ok: false, reason: "not_found" };
  }
  const customer = owner.kind === "member" ? owner.customer : null;
  const payable = () =>
    paymentStatusOf(r) === "pending" &&
    r.status === "requested" &&
    r.totalMinor > 0 &&
    mayReopenPayment(r, now);
  if (!payable()) return { ok: false, reason: "not_payable", reservation: r };

  const gate = await reserveLoginAttempt(
    "checkout-reopen",
    "",
    customer ? customer.email : `link:${r.id}`,
  );
  if (gate.blocked) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  // A mismatch is "unknown" here, not "unpaid": money is at the POS, and a
  // second page would charge on top of it. The sweep still lets such a hold
  // go (a person already has it).
  const verdict = await askPosAboutHold(r, now, lookupProvider(), {
    onAmountMismatch: "unknown",
  });
  if (verdict === "paid") {
    return {
      ok: false,
      reason: "not_payable",
      reservation: (await getReservation(id)) ?? r,
    };
  }
  if (verdict === "unknown") {
    return { ok: false, reason: "payment_unknown", reservation: r };
  }
  const started = await startKaraokePayment(r, customer, {
    buyerIp: opts.buyerIp,
    now,
  });
  if (!started.ok || !started.payment) {
    return {
      ok: false,
      reason: "payment_unavailable",
      reservation: r,
    };
  }
  return {
    ok: true,
    reservation: started.reservation,
    payment: started.payment,
  };
}

// ─── Booking a payment ─────────────────────────────────────────────────────

export interface KaraokePaymentInput {
  reservationId: string;
  provider: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  raw?: unknown;
  /** The provider's day for the transaction, `YYYY-MM-DD`; refunds need it. */
  trxDate?: string;
  now?: Date;
}

/**
 * What a confirmed payment did.
 *
 * - `paid`: it paid the hold; the booking is confirmed.
 * - `repeat`: the same payment again (a second return, the sweep after the
 *   return) - nothing new.
 * - `amount_mismatch`: collected is not the booking's total. Recorded, not
 *   applied, a person told. Cannot happen with an untouched payment page:
 *   the amount is in the signed, hashed form.
 * - `refunded` / `refund_refused` / `refund_unknown`: it was not this
 *   booking's payment - the hold had lapsed or been cancelled, or the
 *   booking was already paid - and it was sent back, or the POS declined,
 *   or its answer never came. A person is told in every case.
 */
export type KaraokePaymentOutcome =
  | "paid"
  | "repeat"
  | "amount_mismatch"
  | "refunded"
  | "refund_refused"
  | "refund_unknown";

export type KaraokePaymentApplyResult =
  | {
      ok: true;
      outcome: KaraokePaymentOutcome;
      reservation: KaraokeReservation;
    }
  | { ok: false; error: string };

/**
 * Books a payment the POS confirmed for a karaoke booking. The order path's
 * `applyPaymentSucceeded` is deliberately not reused: that one is order-shaped
 * (loyalty, stock, the order mail) and this one has to send money back.
 *
 * Idempotent: the payment row is unique on (provider, providerRef); the hold
 * moves `pending → paid` in one guarded UPDATE, and `paid → confirmed` in
 * another (`setReservationStatus`), so the member's confirmation and the
 * köşk's notice each leave once however many times one payment is reported.
 */
export async function applyKaraokePaymentSucceeded(
  input: KaraokePaymentInput,
): Promise<KaraokePaymentApplyResult> {
  const now = input.now ?? new Date();
  const r = await getReservation(input.reservationId);
  if (!r) {
    console.error(
      `[karaoke] payment for a booking that does not exist ref=${input.providerRef} reservation=${input.reservationId}`,
    );
    return { ok: false, error: `reservation ${input.reservationId} not found` };
  }

  const ins = await getDb()
    .from(TABLES.paymentTransactions)
    .insert({
      orderId: r.id,
      provider: input.provider,
      providerRef: input.providerRef,
      status: "succeeded",
      amountMinor: input.amountMinor,
      currency: input.currency,
      raw: input.raw ?? null,
      trxDate: isoDay(input.trxDate),
      createdAt: now.toISOString(),
    });
  if (ins.error && ins.error.code !== "23505") {
    return { ok: false, error: ins.error.message };
  }
  const firstReport = !ins.error;
  const payment: PaymentRecord = {
    provider: input.provider,
    providerRef: input.providerRef,
    status: "succeeded",
    amountMinor: input.amountMinor,
    trxDate: isoDay(input.trxDate),
  };

  let current = r;
  if (current.paymentRef === input.providerRef) {
    return {
      ok: true,
      outcome: "repeat",
      reservation: await finishPaid(current, now),
    };
  }

  if (
    paymentStatusOf(current) === "pending" &&
    current.status === "requested"
  ) {
    if (input.amountMinor !== current.totalMinor) {
      if (firstReport) {
        await alertMoney(current, {
          event: "payment_amount_mismatch",
          key: `amount-${input.providerRef}`,
          title: "Tahsilat tutarı rezervasyonla uyuşmuyor",
          summary: `POS ${formatTRYMinor(input.amountMinor)} bildirdi, rezervasyon ${formatTRYMinor(current.totalMinor)}.`,
          footnote:
            "Rezervasyon onaylanmadı. PayNkolay panelinden işleme bak; gerekiyorsa tutarı karta iade et.",
          amountMinor: input.amountMinor,
          providerRef: input.providerRef,
          extra: { expectedMinor: current.totalMinor },
        });
      }
      return { ok: true, outcome: "amount_mismatch", reservation: current };
    }
    const paidAt = now.toISOString();
    const moved = await moveRow(
      current.id,
      {
        paymentStatus: "paid",
        paidAt,
        paidMinor: input.amountMinor,
        paymentRef: input.providerRef,
      },
      { paymentStatus: "pending", status: "requested" },
      "karaoke.applyKaraokePaymentSucceeded",
    );
    if (moved) {
      // Someone who pays is never held back by the unpaid-hold budget.
      await clearLoginLimit(
        "karaoke-hold",
        "",
        karaokeHoldKey(current.customerEmail, current.guest === true),
      );
      if (current.guest && current.contactPhone) {
        await clearLoginLimit(
          "karaoke-hold",
          "",
          `phone:${current.contactPhone}`,
        );
      }
      const paid: KaraokeReservation = {
        ...current,
        paymentStatus: "paid",
        paidAt,
        paidMinor: input.amountMinor,
        paymentRef: input.providerRef,
      };
      const confirmed = await finishPaid(paid, now);
      await notifyPaid(confirmed);
      return { ok: true, outcome: "paid", reservation: confirmed };
    }
    // Lost to the sweep, a cancellation, or this same payment reported twice
    // at once: read what won.
    current = (await getReservation(r.id)) ?? current;
    if (current.paymentRef === input.providerRef) {
      return { ok: true, outcome: "repeat", reservation: current };
    }
  }

  // Not this booking's payment: the hold had lapsed or been cancelled, or the
  // booking is paid by another payment. The member must not pay for an hour
  // they do not have - it goes back.
  return refundStrayPayment(current, payment, now);
}

/**
 * Confirms a booking whose payment is booked. Normally the same request that
 * booked it; again on a repeated report, in case the first one died between
 * the two writes.
 */
async function finishPaid(
  r: KaraokeReservation,
  now: Date,
): Promise<KaraokeReservation> {
  if (r.status !== "requested" || paymentStatusOf(r) !== "paid") return r;
  const res = await setReservationStatus(r.id, "confirmed", now);
  if (res.ok) return res.reservation;
  console.warn(`[karaoke] paid booking not confirmed ${r.id}: ${res.reason}`);
  return (await getReservation(r.id)) ?? r;
}

async function refundStrayPayment(
  r: KaraokeReservation,
  payment: PaymentRecord,
  now: Date,
): Promise<KaraokePaymentApplyResult> {
  // A booking that holds no money of its own carries this payment, so the
  // panel shows it and its refund. One that is paid by another payment is
  // left alone: this is a second charge.
  const status = paymentStatusOf(r);
  const late =
    r.status === "cancelled" && (status === "expired" || status === "none");
  const marked =
    late &&
    (await moveRow(
      r.id,
      {
        paymentStatus: "refunding",
        paymentRef: payment.providerRef,
        paidMinor: payment.amountMinor,
        paidAt: now.toISOString(),
      },
      { paymentStatus: ["expired", "none"], status: "cancelled" },
      "karaoke.refundStrayPayment",
    ));
  const carrier: KaraokeReservation = marked
    ? {
        ...r,
        paymentStatus: "refunding",
        paymentRef: payment.providerRef,
        paidMinor: payment.amountMinor,
      }
    : r;
  const why = late ? "late_payment" : "second_charge";

  const outcome = await runRefund({
    r: carrier,
    payment,
    mode: marked ? "stray" : "detached",
    reason: why,
    now,
  });
  const amount = formatTRYMinor(payment.amountMinor);
  const what = late
    ? "Süresi dolmuş ya da iptal edilmiş bir rezervasyon için ödeme geldi"
    : "Ödenmiş bir rezervasyon için ikinci ödeme geldi";
  if (outcome.kind === "refunded") {
    if (marked) {
      await notifyReservationStatus({
        ...carrier,
        paymentStatus: "refunded",
        refundedAt: now.toISOString(),
      });
    }
    await alertMoney(carrier, {
      event: `${why}_refunded`,
      key: `stray-${payment.providerRef}`,
      title: `${what}; otomatik iade edildi`,
      summary: `${amount} karta iade edildi.`,
      footnote:
        "Senden bir şey beklenmiyor; kayıt için bilgilendirme. Üyeye iade e-postası gitti.",
      amountMinor: payment.amountMinor,
      providerRef: payment.providerRef,
    });
    return {
      ok: true,
      outcome: "refunded",
      reservation: (await getReservation(r.id)) ?? carrier,
    };
  }
  await alertMoney(carrier, {
    event: `${why}_refund_${outcome.kind}`,
    key: `stray-${payment.providerRef}`,
    title: `${what}; iade ${outcome.kind === "refused" ? "YAPILAMADI" : "SONUCU BELİRSİZ"}`,
    summary: `${amount} tahsil edildi ve üyeye ait bir rezervasyon karşılığı yok.`,
    footnote:
      outcome.kind === "refused"
        ? `POS iadeyi reddetti: ${outcome.message}. Panelden "İade et" ile yeniden dene ya da PayNkolay panelinden iade et.`
        : "İade isteği gönderildi ama POS'tan yanıt alınamadı. PayNkolay panelinden iadenin geçip geçmediğine bak; sonucu panelden işaretle.",
    amountMinor: payment.amountMinor,
    providerRef: payment.providerRef,
    extra: { message: outcome.message },
  });
  return {
    ok: true,
    outcome: outcome.kind === "refused" ? "refund_refused" : "refund_unknown",
    reservation: (await getReservation(r.id)) ?? carrier,
  };
}

// ─── Refunds ───────────────────────────────────────────────────────────────

/**
 * - `cancel`: the booking is being cancelled; its row is `refunding`, and a
 *   refund cancels it.
 * - `stray`: a payment for a booking that was already gone; the row is
 *   `refunding` for it and stays cancelled.
 * - `detached`: a second charge; the row belongs to another payment.
 */
type RefundMode = "cancel" | "stray" | "detached";

type RefundOutcome =
  | { kind: "refunded" }
  | { kind: "refused"; message: string }
  | { kind: "unknown"; message: string };

const refundRefOf = (providerRef: string) => `${providerRef}:refund`;

/**
 * Claims, sends and settles the refund of ONE payment, in full (PayNkolay
 * refunds whole payments only, docs/PAYNKOLAY.md §3.2).
 */
async function runRefund(args: {
  r: KaraokeReservation;
  payment: PaymentRecord;
  mode: RefundMode;
  reason: string;
  /** A person asked to try again: an earlier claim may be taken over. */
  retry?: boolean;
  /** Give up waiting for the POS after this long (the answer is then unknown). */
  deadlineMs?: number;
  now: Date;
}): Promise<RefundOutcome> {
  const { r, payment, now } = args;
  const refundRef = refundRefOf(payment.providerRef);
  const db = getDb();

  // 1. The claim. The unique (provider, providerRef) index lets one refund
  // through per payment, whoever else is trying at the same moment.
  const claim = await db.from(TABLES.paymentTransactions).insert({
    orderId: r.id,
    provider: payment.provider,
    providerRef: refundRef,
    status: "refunding",
    amountMinor: payment.amountMinor,
    currency: "TRY",
    raw: { source: "karaoke_refund", mode: args.mode, reason: args.reason },
    trxDate: "",
    createdAt: now.toISOString(),
  });
  // A retry that takes over an earlier claim does not know whether the first
  // refund went through: PayNkolay refuses a second refund of a refunded
  // sale, so a refusal now is NOT proof that no money moved.
  let tookOver = false;
  if (claim.error) {
    if (claim.error.code !== "23505") {
      raiseDbError("karaoke.runRefund", claim.error, claim.status);
    }
    const earlier = await paymentRecord(r.id, refundRef);
    if (earlier?.status === "refunded") {
      await settleRefunded(r, args.mode, now);
      return { kind: "refunded" };
    }
    if (!args.retry) {
      return {
        kind: "unknown",
        message: "Bu ödemenin iadesi zaten başlatılmış; sonucu bekleniyor.",
      };
    }
    tookOver = true;
  }

  // 2. The POS. A booking that cost nothing has nothing to send back.
  let outcome: RefundOutcome;
  if (payment.provider === FREE_PROVIDER || payment.amountMinor <= 0) {
    outcome = { kind: "refunded" };
  } else {
    let provider: PaymentProvider | null = null;
    try {
      provider = getPaymentProvider();
    } catch (err) {
      // Nothing was sent: the refund was never attempted.
      outcome = {
        kind: "refused",
        message: `Ödeme sağlayıcısı kurulamadı (${err instanceof Error ? err.message : "?"})`,
      };
    }
    if (provider) {
      try {
        const work = provider.refund(payment.providerRef, payment.amountMinor, {
          trxDate: payment.trxDate,
          paidMinor: payment.amountMinor,
        });
        await (args.deadlineMs ? withTimeout(work, args.deadlineMs) : work);
        outcome = { kind: "refunded" };
      } catch (err) {
        const message = err instanceof Error ? err.message : "bilinmeyen hata";
        outcome = isPaymentRefused(err)
          ? { kind: "refused", message }
          : { kind: "unknown", message };
      }
    }
  }
  // TypeScript cannot see that every branch above assigned it.
  outcome ??= { kind: "unknown", message: "?" };
  if (tookOver && outcome.kind === "refused") {
    // Never roll back over a refund that may already have happened: the
    // booking stays `refunding` and a person checks PayNkolay's panel.
    outcome = {
      kind: "unknown",
      message: `POS ikinci iadeyi reddetti (ilk iade geçmiş olabilir): ${outcome.message}`,
    };
  }

  // 3. Settle what the POS said.
  if (outcome.kind === "refunded") {
    check(
      await db
        .from(TABLES.paymentTransactions)
        .update({ status: "refunded" })
        .eq("orderId", r.id)
        .eq("providerRef", refundRef),
      "karaoke.runRefund.settle",
    );
    await settleRefunded(r, args.mode, now);
  } else if (outcome.kind === "refused") {
    // No money moved: the claim goes, so the refund can be tried again, and
    // the booking is back where it was.
    check(
      await db
        .from(TABLES.paymentTransactions)
        .delete()
        .eq("orderId", r.id)
        .eq("providerRef", refundRef)
        .eq("status", "refunding"),
      "karaoke.runRefund.release",
    );
    if (args.mode !== "detached") {
      await moveRow(
        r.id,
        { paymentStatus: "paid" },
        { paymentStatus: "refunding" },
        "karaoke.runRefund.rollback",
      );
    }
  }
  // Unknown: nothing is undone. The claim and the `refunding` row are the
  // record that a refund may be on its way; a person settles it.
  return outcome;
}

async function settleRefunded(
  r: KaraokeReservation,
  mode: RefundMode,
  now: Date,
): Promise<boolean> {
  if (mode === "detached") return false;
  const iso = now.toISOString();
  return moveRow(
    r.id,
    mode === "cancel"
      ? {
          paymentStatus: "refunded",
          refundedAt: iso,
          status: "cancelled",
          updatedAt: iso,
        }
      : // Already cancelled: no status change, so `updatedAt` stays the
        // instant of the cancellation (the inbox reads it).
        { paymentStatus: "refunded", refundedAt: iso },
    { paymentStatus: "refunding" },
    "karaoke.settleRefunded",
  );
}

// ─── Unpaid holds ──────────────────────────────────────────────────────────

type HoldVerdict = "paid" | "unpaid" | "unknown";

/**
 * Asks the POS whether an unpaid hold was paid after all - the return does
 * not always arrive (a closed tab, a phone that locked on the bank's page) -
 * and books the payment when it was. "unknown" is never "unpaid".
 *
 * `onAmountMismatch`: what money at the wrong amount means to the caller.
 * The sweep and a cancellation let the hour go ("unpaid", the default); a
 * reopen must not open a second page on top of it ("unknown").
 */
async function askPosAboutHold(
  r: KaraokeReservation,
  now: Date,
  provider: PaymentProvider | null,
  { onAmountMismatch = "unpaid" }: { onAmountMismatch?: HoldVerdict } = {},
): Promise<HoldVerdict> {
  // No provider at all (a deployment missing its POS configuration): the
  // POS could not be asked, which is never "unpaid" (rule 29). The mock has
  // no lookup and no real money: judged on the clock.
  if (!provider) return "unknown";
  if (!provider.lookupPayment) return "unpaid";
  let found: Awaited<ReturnType<NonNullable<PaymentProvider["lookupPayment"]>>>;
  try {
    found = await withTimeout(
      provider.lookupPayment(r.id, new Date(r.createdAt)),
      POS_LOOKUP_TIMEOUT_MS,
    );
  } catch (err) {
    console.error(
      `[karaoke] POS lookup failed ${r.id}:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return "unknown";
  }
  if (!found || found.status !== "succeeded") return "unpaid";
  const applied = await applyKaraokePaymentSucceeded({
    reservationId: r.id,
    provider: provider.name,
    providerRef: found.providerRef,
    amountMinor: found.amountMinor,
    currency: found.currency,
    raw: found.raw,
    trxDate: found.trxDate,
    now,
  });
  if (!applied.ok) return "unknown";
  // Collected, but not what the booking costs: it cannot be confirmed, and a
  // person already has it. The sweep lets the hour go like any unpaid hold's.
  if (applied.outcome === "amount_mismatch") return onAmountMismatch;
  return "paid";
}

/** pending → expired, and the hour is free. True when this call released it. */
async function releaseUnpaidHold(
  r: KaraokeReservation,
  now: Date,
): Promise<boolean> {
  return moveRow(
    r.id,
    {
      status: "cancelled",
      paymentStatus: "expired",
      updatedAt: now.toISOString(),
    },
    { paymentStatus: "pending", status: "requested" },
    "karaoke.releaseUnpaidHold",
  );
}

/**
 * Lets unpaid holds go whose newest payment page has closed and whose bank
 * step has had its grace (karaoke-time.ts), after asking the POS about each.
 *
 * No scheduler in this deployment: it runs before every booking
 * (`createReservation`, where an expired hold would otherwise keep its hour
 * and count against the member's cap) and from the daily cron. Bounded, side
 * by side, each POS call capped at five seconds; never fatal to its caller.
 * Not from the public availability GET: anyone could then make the site
 * call the POS as often as they liked.
 */
export async function expireUnpaidReservations(
  now: Date = new Date(),
): Promise<number> {
  const stale = rows<KaraokeReservation>(
    await getDb()
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("paymentStatus", "pending")
      .lt("paymentDueAt", sweepCutoff(now))
      .order("paymentDueAt", { ascending: true })
      .limit(KARAOKE_SWEEP_BATCH),
    "karaoke.expireUnpaidReservations",
  );
  if (stale.length === 0) return 0;
  const provider = lookupProvider();
  const outcomes = await Promise.allSettled(
    stale.map(async (r) => {
      const verdict = await askPosAboutHold(r, now, provider);
      if (verdict === "paid") return false;
      const age = now.getTime() - Date.parse(r.createdAt);
      if (verdict === "unknown" && age < POS_LOOKUP_GIVE_UP_MS) return false;
      const released = await releaseUnpaidHold(r, now);
      if (released && verdict === "unknown") {
        // A day without an answer: the hour goes back, but a person checks
        // that no money is sitting at the POS for it.
        await alertMoney(r, {
          event: "hold_released_payment_unknown",
          key: "hold-unknown",
          title: "Ödemesi doğrulanamayan rezervasyon serbest bırakıldı",
          summary: "POS'a 24 saat boyunca sorulamadı; saat yeniden açıldı.",
          footnote:
            "PayNkolay panelinde bu rezervasyon için başarılı bir ödeme varsa tutarı karta iade et.",
          amountMinor: r.totalMinor,
          providerRef: "",
        });
      }
      return released;
    }),
  );
  let expired = 0;
  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled") {
      if (outcome.value) expired += 1;
    } else {
      console.error("[karaoke] expiring an unpaid hold failed", outcome.reason);
    }
  }
  return expired;
}

// ─── Cancelling ────────────────────────────────────────────────────────────

/** Who is cancelling, which decides what they may do. */
export type KaraokeCanceller =
  /**
   * The member, from the web or the app: under the booking's own policy
   * (`karaokeSelfCancelTerms`): in full before its deadline, for its late
   * share inside the window while the start has not come, else refused.
   * `emailVerified` as the account says it now.
   */
  | { kind: "member"; email: string; emailVerified: boolean }
  /** Whoever holds the booking's signed link (a guest): the same window. */
  | { kind: "link"; token: string }
  /**
   * The köşk (a business cancellation, MSY m.16/4): any time. Sending money
   * back needs the panel's `refunds` permission. `reason` is what the staff
   * member wrote in the panel; it goes into the audit row.
   */
  | { kind: "staff"; actor: string; canRefund: boolean; reason?: string }
  /** An account that is closing: every future booking, refunded in full. */
  | { kind: "account"; email: string };

export type CancelKaraokeFailure =
  | "not_found"
  | "not_cancellable"
  | "too_late"
  /** An unpaid hold whose payment the POS could not be asked about. */
  | "payment_unknown"
  /** The POS declined the refund: nothing moved, the booking stands. */
  | "refund_refused"
  /** The refund was sent and its answer never came: a person settles it. */
  | "refund_unknown"
  /** A paid booking, and this panel user may not send money back. */
  | "refund_forbidden"
  | "raced";

export type CancelKaraokeResult =
  | {
      ok: true;
      reservation: KaraokeReservation;
      /** The payment went back to the card. */
      refunded: boolean;
      /** Did the member's mail leave (true when none was due). */
      notified: boolean;
      /**
       * No mail was due: the köşk cancelled a pay-at-the-venue evening that
       * is already over (a no-show written down, karar D7).
       */
      silent?: true;
      /**
       * A late cancel's share, kuruş, owed back and not sent yet: a person
       * refunds it in PayNkolay's panel (`refunded` is false).
       */
      refundOwedMinor?: number;
    }
  | {
      ok: false;
      reason: CancelKaraokeFailure;
      reservation?: KaraokeReservation;
      message?: string;
    };

/**
 * Cancels a karaoke booking, sending its money back first when it was paid.
 *
 * A member's (or a link holder's) cancel follows the booking's snapshot:
 * refused inside the window when its late share is 0 (and from the start on,
 * always), and inside the window with a share below 100 % a confirmed
 * booking is cancelled with the share owed (`cancelWithShareOwed`); a paid
 * one the köşk never confirmed goes back in full. The köşk's cancel always
 * refunds everything.
 *
 * - Paid at the venue (`none`): cancelled, as the panel always did.
 * - Unpaid hold (`pending`): the POS is asked first (rule 29). Paid after
 *   all: booked, and cancelled as a paid booking. Unknown: refused, nothing
 *   changes. Not paid: released.
 * - Paid: `paid → refunding`, the refund, then `refunded` + `cancelled`. A
 *   declined refund puts the booking back as it was; an unanswered one leaves
 *   it `refunding` for a person, and the booking stands until then.
 */
export async function cancelKaraokeReservation(
  id: string,
  by: KaraokeCanceller,
  opts: { now?: Date; refundDeadlineMs?: number } = {},
): Promise<CancelKaraokeResult> {
  const now = opts.now ?? new Date();
  let r = await getReservation(id);
  if (!r) return { ok: false, reason: "not_found" };
  const allowed =
    by.kind === "staff"
      ? true
      : by.kind === "account"
        ? // The account's own bookings only: a guest booking that merely
          // carries the address was never proven to be this person's (an
          // account can be opened and closed without verifying anything).
          !r.guest && sameEmail(r.customerEmail, by.email)
        : by.kind === "member"
          ? ownsReservation(
              {
                kind: "member",
                customer: { email: by.email, emailVerified: by.emailVerified },
              },
              r,
              now,
            )
          : ownsReservation({ kind: "link", token: by.token }, r, now);
  // A stranger's booking answers exactly like a missing one.
  if (!allowed) return { ok: false, reason: "not_found" };
  if (r.status === "cancelled") {
    return { ok: false, reason: "not_cancellable", reservation: r };
  }
  // The booking's own rule (its snapshot) binds every self-service
  // cancellation - for money, account closure too: closing an account must
  // not become a way to refund an evening already sung (or no-showed). Only
  // the köşk overrides it, and the köşk always refunds in full (MSY m.16/4,
  // TBK m.136/2): the late share is never applied to a staff cancel.
  const lateMatters =
    by.kind === "member" ||
    by.kind === "link" ||
    (by.kind === "account" && paymentStatusOf(r) === "paid");
  // The share of the payment this cancel refunds: null = all of it.
  let lateShare: number | null = null;
  if (lateMatters) {
    const terms = karaokeSelfCancelTerms(r, now);
    if (terms.kind === "refused") {
      return {
        ok: false,
        reason: "too_late",
        reservation: r,
        message: karaokeCancellationRules(karaokeCancelPolicyOf(r))
          .tooLateMessage,
      };
    }
    if (terms.kind === "late" && terms.percent < 100) lateShare = terms.percent;
  }
  // Every cancellation leaves an audit row, whoever made it; a member or a
  // link holder is named by kind (no address in the log).
  const actor =
    by.kind === "staff"
      ? by.actor
      : by.kind === "member"
        ? "customer"
        : by.kind === "link"
          ? "guest-link"
          : "account-closure";
  const why = by.kind === "staff" && by.reason ? { reason: by.reason } : {};

  if (paymentStatusOf(r) === "pending") {
    const verdict = await askPosAboutHold(r, now, lookupProvider());
    if (verdict === "unknown") {
      return { ok: false, reason: "payment_unknown", reservation: r };
    }
    if (verdict === "unpaid") {
      if (!(await releaseUnpaidHold(r, now))) {
        return { ok: false, reason: "raced", reservation: r };
      }
      const released: KaraokeReservation = {
        ...r,
        status: "cancelled",
        paymentStatus: "expired",
        updatedAt: now.toISOString(),
      };
      // The member's own unfinished checkout needs no letter; a member whose
      // hold the köşk let go may be at the card form right now.
      const notified =
        by.kind === "staff" ? await notifyReservationStatus(released) : true;
      await auditStaff(released, actor, "transition", {
        status: "cancelled",
        paymentStatus: "expired",
        by: by.kind,
        ...why,
      });
      return { ok: true, reservation: released, refunded: false, notified };
    }
    // Paid after all: carry on as a paid booking.
    r = (await getReservation(id)) ?? r;
    if (r.status === "cancelled") {
      return { ok: false, reason: "not_cancellable", reservation: r };
    }
  }

  const money = paymentStatusOf(r);
  if (money === "none") {
    // An evening already over that the köşk writes off (the guest did not
    // come): a cancellation mail after the fact helps nobody (karar D7).
    const silent =
      by.kind === "staff" && karaokeEndInstant(r).getTime() <= now.getTime();
    const res = await setReservationStatus(id, "cancelled", now, {
      notify: !silent,
    });
    if (!res.ok) {
      return {
        ok: false,
        reason:
          res.reason === "not_found"
            ? "not_found"
            : res.reason === "raced"
              ? "raced"
              : "not_cancellable",
        reservation: r,
      };
    }
    await auditStaff(res.reservation, actor, "transition", {
      status: "cancelled",
      by: by.kind,
      ...(silent ? { ended: true } : {}),
      ...why,
    });
    return {
      ok: true,
      reservation: res.reservation,
      refunded: false,
      notified: res.notified,
      ...(silent ? { silent: true as const } : {}),
    };
  }
  if (money !== "paid") {
    return { ok: false, reason: "not_cancellable", reservation: r };
  }
  if (by.kind === "staff" && !by.canRefund) {
    return { ok: false, reason: "refund_forbidden", reservation: r };
  }

  const paid = r.paidMinor ?? 0;
  // The late share is what letting go of a promised hour costs. A paid
  // booking the köşk never confirmed (its hour lost to another booking, or
  // its confirmation unfinished) was never promised: the panel cancels it in
  // full, and so does the member's own cancel (MSY m.16/4, TBK m.136).
  const share = r.status === "confirmed" ? lateShare : null;
  const owed = share === null ? paid : karaokeLateRefundMinor(paid, share);
  // A share below the whole payment cannot go through the POS (PayNkolay
  // refunds whole payments only, docs/PAYNKOLAY.md §3.2; operator decision
  // D9): the booking is cancelled now, its hour freed, and the share is owed.
  // A share that rounds to nothing, or to all of it, refunds in full.
  if (owed > 0 && owed < paid) {
    return cancelWithShareOwed(r, owed, share ?? 0, {
      actor,
      by: by.kind,
      now,
    });
  }

  const reserved = await moveRow(
    id,
    { paymentStatus: "refunding" },
    { paymentStatus: "paid", status: r.status },
    "karaoke.cancelKaraokeReservation",
  );
  if (!reserved) return { ok: false, reason: "raced", reservation: r };
  const refunding: KaraokeReservation = { ...r, paymentStatus: "refunding" };
  const payment = await paymentRecord(r.id, r.paymentRef ?? "");
  if (!payment) {
    // A paid booking without its payment record has nothing to refund
    // against; put it back and tell a person rather than guess.
    await moveRow(
      id,
      { paymentStatus: "paid" },
      { paymentStatus: "refunding" },
      "karaoke.cancelKaraokeReservation.rollback",
    );
    await alertMoney(r, {
      event: "refund_without_payment_row",
      key: `norow-${r.paymentRef || "none"}`,
      title: "İade edilecek ödeme kaydı bulunamadı",
      summary: "Rezervasyon ödenmiş görünüyor ama ödeme satırı yok.",
      footnote: "Rezervasyon iptal edilmedi. PayNkolay panelinden ödemeye bak.",
      amountMinor: r.paidMinor ?? 0,
      providerRef: r.paymentRef ?? "",
    });
    return {
      ok: false,
      reason: "refund_refused",
      reservation: r,
      message: "Ödeme kaydı bulunamadı.",
    };
  }

  const outcome = await runRefund({
    r: refunding,
    payment,
    mode: "cancel",
    reason: by.kind,
    deadlineMs: opts.refundDeadlineMs,
    now,
  });
  if (outcome.kind === "refunded") {
    const iso = now.toISOString();
    const cancelled: KaraokeReservation = {
      ...refunding,
      status: "cancelled",
      paymentStatus: "refunded",
      refundedAt: iso,
      updatedAt: iso,
    };
    const notified = await notifyReservationStatus(cancelled);
    await auditStaff(cancelled, actor, "refund", {
      status: "cancelled",
      paymentStatus: "refunded",
      amountMinor: payment.amountMinor,
      providerRef: payment.providerRef,
      by: by.kind,
      ...why,
    });
    return { ok: true, reservation: cancelled, refunded: true, notified };
  }
  const slot = readableSlot(r);
  await alertMoney(refunding, {
    event: `cancel_refund_${outcome.kind}`,
    key: `cancel-${outcome.kind}-${payment.providerRef}`,
    title:
      outcome.kind === "refused"
        ? "Karaoke iptalinde iade YAPILAMADI"
        : "Karaoke iptalinde iade SONUCU BELİRSİZ",
    summary: `${slot.date} ${slot.time} rezervasyonunun iptali için ${formatTRYMinor(payment.amountMinor)} iade isteği.`,
    footnote:
      outcome.kind === "refused"
        ? `POS iadeyi reddetti: ${outcome.message}. Rezervasyon iptal edilmedi, ödendi olarak duruyor.`
        : "İade isteği gönderildi ama POS'tan yanıt alınamadı; rezervasyon 'iade sonucu bekleniyor' durumunda. PayNkolay panelinden bak, sonucu panelden işaretle.",
    amountMinor: payment.amountMinor,
    providerRef: payment.providerRef,
    extra: { by: by.kind, message: outcome.message, ...why },
  });
  if (outcome.kind === "refused") {
    return {
      ok: false,
      reason: "refund_refused",
      reservation: r,
      message: outcome.message,
    };
  }
  return {
    ok: false,
    reason: "refund_unknown",
    reservation: refunding,
    message: outcome.message,
  };
}

/**
 * A member's late cancel under a policy whose late share is below 100 %
 * (operator decision D9, 17 Eki 2026). PayNkolay cannot refund part of a
 * payment (docs/PAYNKOLAY.md §3.2), so nothing is sent to the POS: one
 * guarded write cancels the booking, frees its hour and records the share
 * owed (`refunding` + `refundMinor`); the member is told how much goes back,
 * and the köşk is mailed to refund it in PayNkolay's panel and press "Elle
 * iade edildi" (`settleKaraokeRefundByHand`). No money moves here, so there
 * is nothing to roll back (rules 25 and 29 hold trivially).
 */
async function cancelWithShareOwed(
  r: KaraokeReservation,
  owedMinor: number,
  percent: number,
  ctx: { actor: string; by: KaraokeCanceller["kind"]; now: Date },
): Promise<CancelKaraokeResult> {
  const iso = ctx.now.toISOString();
  const moved = await moveRow(
    r.id,
    {
      status: "cancelled",
      paymentStatus: "refunding",
      refundMinor: owedMinor,
      updatedAt: iso,
    },
    { paymentStatus: "paid", status: r.status },
    "karaoke.cancelWithShareOwed",
  );
  if (!moved) return { ok: false, reason: "raced", reservation: r };
  const cancelled: KaraokeReservation = {
    ...r,
    status: "cancelled",
    paymentStatus: "refunding",
    refundMinor: owedMinor,
    updatedAt: iso,
  };
  const notified = await notifyReservationStatus(cancelled);
  const slot = readableSlot(r);
  await alertMoney(
    cancelled,
    {
      event: "late_cancel_share_owed",
      key: `late-share-${r.paymentRef || r.id}`,
      title: "Geç iptal: kısmi iade bekliyor",
      summary: `${slot.date} ${slot.time} rezervasyonu geç iptal edildi ve saat boşaldı. Kurala göre ${formatTRYMinor(owedMinor)} (%${percent}) karta iade edilecek.`,
      footnote:
        'Kısmi iade POS\'a otomatik gönderilemiyor. PayNkolay panelinden bu tutarı karta iade et, sonra panelde "Elle iade edildi" ile kaydet; üyeye iade e-postası o zaman gider.',
      amountMinor: owedMinor,
      providerRef: r.paymentRef ?? "",
      extra: {
        by: ctx.by,
        lateRefundPercent: percent,
        paidMinor: r.paidMinor ?? 0,
      },
    },
    { audit: false },
  );
  // One audit row, under who cancelled (the mail above is the alert).
  await auditStaff(cancelled, ctx.actor, "refund", {
    event: "late_cancel_share_owed",
    status: "cancelled",
    paymentStatus: "refunding",
    amountMinor: owedMinor,
    paidMinor: r.paidMinor ?? 0,
    lateRefundPercent: percent,
    providerRef: r.paymentRef ?? "",
    by: ctx.by,
  });
  return {
    ok: true,
    reservation: cancelled,
    refunded: false,
    notified,
    refundOwedMinor: owedMinor,
  };
}

// ─── A person settles what did not settle itself ───────────────────────────

export type ResolveRefundResult =
  | {
      ok: true;
      reservation: KaraokeReservation;
      refunded: boolean;
      /** Did the member's refund mail leave (`notifyReservationStatus`). */
      notified: boolean;
    }
  | {
      ok: false;
      /**
       * `by_hand`: a late cancel's share, which only a person refunds (in
       * PayNkolay's panel) and records (`settleKaraokeRefundByHand`).
       */
      reason:
        | "not_found"
        | "not_refundable"
        | "refused"
        | "unknown"
        | "raced"
        | "by_hand";
      message?: string;
    };

/** What a person typed when they moved the money by hand (audit only). */
export interface ResolveRefundOptions {
  reason?: string;
}

/**
 * "İadeyi yeniden dene" / "İade et" in the panel (refund permission): a
 * booking whose refund is `refunding` (its answer never came), or one that is
 * cancelled while still `paid` (a declined refund of a late payment, an
 * account closure the POS did not answer). The POS is asked again; if the
 * first refund did go through, PayNkolay declines the second and nothing
 * moves - which is why the panel says to look at PayNkolay's panel first.
 */
export async function retryKaraokeRefund(
  id: string,
  actor: string,
  now: Date = new Date(),
  opts: ResolveRefundOptions = {},
): Promise<ResolveRefundResult> {
  const r = await getReservation(id);
  if (!r) return { ok: false, reason: "not_found" };
  // A late cancel's share is never sent to the POS: it would refund the
  // whole payment (whole payments only), or be refused. A person refunds it.
  if (isPartialRefund(r)) return { ok: false, reason: "by_hand" };
  const money = paymentStatusOf(r);
  const payment = await paymentRecord(r.id, r.paymentRef ?? "");
  if (!payment) return { ok: false, reason: "not_refundable" };

  let mode: RefundMode;
  let carrier: KaraokeReservation = r;
  if (money === "refunding") {
    mode = r.status === "cancelled" ? "stray" : "cancel";
  } else if (money === "paid" && r.status === "cancelled") {
    const moved = await moveRow(
      id,
      { paymentStatus: "refunding" },
      { paymentStatus: "paid", status: "cancelled" },
      "karaoke.retryKaraokeRefund",
    );
    if (!moved) return { ok: false, reason: "not_refundable" };
    mode = "stray";
    carrier = { ...r, paymentStatus: "refunding" };
  } else {
    return { ok: false, reason: "not_refundable" };
  }

  const outcome = await runRefund({
    r: carrier,
    payment,
    mode,
    reason: "staff_retry",
    retry: true,
    now,
  });
  await auditStaff(carrier, actor, "refund", {
    event: "refund_retry",
    outcome: outcome.kind,
    amountMinor: payment.amountMinor,
    providerRef: payment.providerRef,
    ...(outcome.kind === "refunded" ? {} : { message: outcome.message }),
    ...(opts.reason ? { reason: opts.reason } : {}),
  });
  if (outcome.kind !== "refunded") {
    return { ok: false, reason: outcome.kind, message: outcome.message };
  }
  const settled = (await getReservation(id)) ?? carrier;
  // The panel says whether the member was told, so it must be the real answer.
  const notified = await notifyReservationStatus(settled);
  return { ok: true, reservation: settled, refunded: true, notified };
}

/**
 * The refund's claim row, as refunded, for a refund a person recorded:
 * `amountMinor` is what went back (a late cancel's share, or the whole
 * payment).
 */
async function recordRefundByHand(
  reservationId: string,
  payment: PaymentRecord,
  amountMinor: number,
  actor: string,
  now: Date,
): Promise<void> {
  const refundRef = refundRefOf(payment.providerRef);
  const db = getDb();
  const ins = await db.from(TABLES.paymentTransactions).insert({
    orderId: reservationId,
    provider: payment.provider,
    providerRef: refundRef,
    status: "refunded",
    amountMinor,
    currency: "TRY",
    raw: { source: "karaoke_refund", mode: "manual", actor },
    trxDate: "",
    createdAt: now.toISOString(),
  });
  if (!ins.error) return;
  if (ins.error.code !== "23505") {
    raiseDbError("karaoke.settleKaraokeRefundByHand", ins.error, ins.status);
  }
  check(
    await db
      .from(TABLES.paymentTransactions)
      .update({ status: "refunded" })
      .eq("orderId", reservationId)
      .eq("providerRef", refundRef),
    "karaoke.settleKaraokeRefundByHand.claim",
  );
}

/**
 * "İade POS'ta görüldü": a person looked at PayNkolay's panel and the refund
 * is there. Records it as refunded - booking, then claim row - and tells the
 * member. Two rows qualify:
 *
 * - `refunding`: a refund whose answer never came;
 * - `paid` + `cancelled`: money the köşk still holds for a booking that is
 *   gone (a declined refund of a late payment, an account closure the POS did
 *   not answer), which someone refunded straight from PayNkolay's panel.
 *
 * The panel offered the second one before and this refused it ("iadesi
 * beklenmiyor"), so a refund done at PayNkolay could never be recorded.
 */
export async function settleKaraokeRefundByHand(
  id: string,
  actor: string,
  now: Date = new Date(),
  opts: ResolveRefundOptions = {},
): Promise<ResolveRefundResult> {
  const r = await getReservation(id);
  if (!r) return { ok: false, reason: "not_found" };
  const money = paymentStatusOf(r);
  const heldAfterCancel = money === "paid" && r.status === "cancelled";
  if (money !== "refunding" && !heldAfterCancel) {
    return { ok: false, reason: "not_refundable" };
  }
  const payment = await paymentRecord(r.id, r.paymentRef ?? "");
  // The booking first, guarded on the state that was read; the claim row only
  // once this call has won it. The other way round, a settle that lost to a
  // colleague's "İadeyi başlat" left a `refunded` claim behind, and the next
  // refund took that claim for a refund already made: "İade yapıldı" and the
  // member's mail, with nothing sent to the POS.
  const moved = heldAfterCancel
    ? await moveRow(
        r.id,
        { paymentStatus: "refunded", refundedAt: now.toISOString() },
        { paymentStatus: "paid", status: "cancelled" },
        "karaoke.settleKaraokeRefundByHand.paid",
      )
    : await settleRefunded(
        r,
        r.status === "cancelled" ? "stray" : "cancel",
        now,
      );
  // Someone else moved it in between (a refund under way, a second person
  // settling it): this call recorded nothing and tells nobody.
  if (!moved) return { ok: false, reason: "raced" };
  if (payment) {
    // The booking already says refunded: a failed claim write must not cost
    // the audit row and the member's mail below.
    try {
      await recordRefundByHand(r.id, payment, refundAmountOf(r), actor, now);
    } catch (err) {
      console.error(`[karaoke] manual refund claim not written ${r.id}`, err);
    }
  }
  await auditStaff(r, actor, "refund", {
    event: "refund_settled_by_hand",
    from: money,
    amountMinor: isPartialRefund(r)
      ? refundAmountOf(r)
      : (payment?.amountMinor ?? r.paidMinor ?? 0),
    ...(isPartialRefund(r)
      ? {
          share: true,
          lateRefundPercent: karaokeCancelPolicyOf(r).lateRefundPercent,
        }
      : {}),
    providerRef: r.paymentRef ?? "",
    ...(opts.reason ? { reason: opts.reason } : {}),
  });
  const settled = (await getReservation(id)) ?? r;
  const notified = await notifyReservationStatus(settled);
  return { ok: true, reservation: settled, refunded: true, notified };
}

// ─── Account closure ───────────────────────────────────────────────────────

/** Each POS call an account closure waits for (DELETE /me has 15 s). */
const ACCOUNT_CLOSURE_POS_DEADLINE_MS = 5_000;

/**
 * `DELETE /me` and the web's account deletion: every future booking is
 * cancelled while the rows still carry the member's address, and every paid
 * one is refunded in full (MSY: the member keeps no evening, the business
 * keeps no money). The bookings are at most KARAOKE_OPEN_CAP, handled side by
 * side, each POS call bounded so the closure is not held hostage by the POS.
 *
 * What does not settle on the spot is still cancelled - the account is
 * closing either way - and put in front of a person: a refund the POS
 * declined or did not answer (the booking keeps `paid` / `refunding` for the
 * panel), or an unpaid hold the POS could not be asked about.
 */
export async function cancelKaraokeForClosedAccount(
  email: string,
  now: Date = new Date(),
): Promise<void> {
  const today = istanbulClock(now).date;
  // The account's own bookings; guest rows with the same address are left
  // alone (they are reached by their signed link, and nothing proves the
  // person closing this account made them).
  const future = (await listMine(email)).filter(
    (r) => r.date >= today && r.status !== "cancelled",
  );
  const outcomes = await Promise.allSettled(
    future.map(async (r) => {
      const res = await cancelKaraokeReservation(
        r.id,
        { kind: "account", email },
        { now, refundDeadlineMs: ACCOUNT_CLOSURE_POS_DEADLINE_MS },
      );
      if (res.ok) return;
      const current = (await getReservation(r.id)) ?? r;
      if (current.status === "cancelled") return;
      const money = paymentStatusOf(current);
      if (res.reason === "too_late") {
        // Paid, and inside the booking's window with no late share (or
        // already under way): no refund under its rule, and the evening
        // stays booked. A person decides whether the köşk refunds it anyway.
        const { freeCancelHours: h } = karaokeCancelPolicyOf(current);
        await alertMoney(current, {
          event: "account_closed_late_paid_booking",
          key: "account-late",
          title:
            h > 0
              ? `Kapanan hesabın ${h} saatten az kalan ödenmiş rezervasyonu`
              : "Kapanan hesabın ücretsiz iptal süresi olmayan ödenmiş rezervasyonu",
          summary:
            "Hesap kapandı; rezervasyonun iptal kuralı gereği iade yapılmadı ve rezervasyon olduğu gibi duruyor.",
          footnote:
            "İptal ve iade kuralı gereği iade yok. Köşk yine de iade etmek isterse panelden iptal et (iade yetkisi gerekir).",
          amountMinor: current.paidMinor ?? current.totalMinor,
          providerRef: current.paymentRef ?? "",
        });
        return;
      }
      if (money === "pending") {
        await releaseUnpaidHold(current, now);
        await alertMoney(current, {
          event: "account_closed_payment_unknown",
          key: "account-hold",
          title: "Kapanan hesabın ödeme bekleyen rezervasyonu",
          summary:
            "Hesap kapandı; POS'a ödeme durumu sorulamadı ve saat serbest bırakıldı.",
          footnote:
            "PayNkolay panelinde bu rezervasyon için başarılı bir ödeme varsa tutarı karta iade et.",
          amountMinor: current.totalMinor,
          providerRef: "",
        });
        return;
      }
      await moveRow(
        current.id,
        { status: "cancelled", updatedAt: now.toISOString() },
        { paymentStatus: money, status: current.status },
        "karaoke.cancelKaraokeForClosedAccount",
      );
      // A declined or unanswered refund has already been put in front of a
      // person by cancelKaraokeReservation; the booking is now released.
    }),
  );
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error("[deleteMe] karaoke cancel failed", outcome.reason);
    }
  }
}
