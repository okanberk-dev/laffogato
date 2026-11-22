import "server-only";

import { getSettings } from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";
import { SITE } from "@/lib/seo/site";
import { karaokeTaxRate } from "@/lib/utils/kdv";

import {
  getReservation,
  listReservationsForDate,
  notifyReservationStatus,
  setReservationStatus,
} from "./karaoke";
import {
  DESK_BLOCK_NOTE_PREFIX,
  DESK_PLACEHOLDER_DOMAIN,
  isCalendarDate,
  isDeskPlaceholderEmail,
  quoteReservation,
  rangeConflicts,
  type KaraokeReservation,
} from "./karaoke-core";
import {
  effectiveKaraokeCancelPolicy,
  karaokeDeadlineFor,
} from "./karaoke-time";
import { istanbulClock } from "./venue";

/**
 * Karaoke hours taken at the köşk itself (operator, 22 Kas 2026: "laffogato
 * admin panelinden veya ladmin panelinden de manuel rezervasyon alınsın,
 * oradan dolu yapılabilsin ki insanlar siteden bakınca görsünler").
 *
 * Two kinds, both `channel: "desk"`:
 * - `booking`: a group booked by phone or at the counter. Confirmed at once,
 *   paid at the köşk (`paymentStatus: "none"`): no card, no POS, no
 *   invoice here (the till rings it up), never counted as online sales.
 *   An e-mail, when the staff types one, gets the usual confirmation and
 *   puts the booking in that member's account.
 * - `block`: hours the köşk closes (an event, maintenance). Nobody is
 *   mailed; the row only holds the hours.
 *
 * Either way the hours are taken on the site's calendar, in the app and on
 * the till the moment the row is written (`karaoke_reservations_no_overlap`
 * has the last word on a clash; the write expires `live:karaoke`, which
 * also pings the panel). A row without an e-mail carries a unique address
 * under `.invalid` (RFC 2606): it counts against no one's open-bookings cap
 * and no mail is ever sent to it.
 */

export type DeskKind = "booking" | "block";

export interface DeskReservationInput {
  kind: DeskKind;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  name: string;
  phone: string;
  email: string;
  note: string;
}

export type DeskReservationResult =
  | { ok: true; reservation: KaraokeReservation; notified: boolean }
  | {
      ok: false;
      error: "invalid" | "slot_taken" | "too_many";
      message: string;
      field?: keyof DeskReservationInput;
    };

const NAME_MAX = 60;
const NOTE_MAX = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function int(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(str(v), 10);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/** Reads the form or a panel's JSON body into a desk request. */
export function readDeskInput(
  raw: Record<string, unknown>,
): DeskReservationInput {
  const kind = str(raw.kind) === "block" ? "block" : "booking";
  return {
    kind,
    date: str(raw.date),
    startHour: int(raw.startHour),
    hours: int(raw.hours),
    guests: kind === "block" ? 1 : int(raw.guests),
    name: str(raw.name).slice(0, NAME_MAX),
    phone: str(raw.phone)
      .replace(/[^\d+ ]/g, "")
      .slice(0, 20),
    email: str(raw.email).toLowerCase().slice(0, 120),
    note: str(raw.note).slice(0, NOTE_MAX),
  };
}

/**
 * The room's day as a desk booking may use it: from the room's first hour
 * to its closing hour, never an hour that has already ended, at most the
 * booking window ahead. Longer than a customer's limit is allowed (a block
 * may close a whole evening).
 */
export function validateDeskInput(
  input: DeskReservationInput,
  ctx: {
    today: string;
    nowMinutes: number;
    firstHour: number;
    closeHour: number;
    capacity: number;
    bookingWindowDays: number;
  },
):
  | { ok: true }
  | { ok: false; message: string; field: keyof DeskReservationInput } {
  if (!isCalendarDate(input.date)) {
    return { ok: false, field: "date", message: "Geçerli bir gün seç." };
  }
  if (input.date < ctx.today) {
    return { ok: false, field: "date", message: "Geçmiş bir gün seçilemez." };
  }
  const last = new Date(`${ctx.today}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + Math.max(1, ctx.bookingWindowDays));
  if (input.date > last.toISOString().slice(0, 10)) {
    return {
      ok: false,
      field: "date",
      message: `En çok ${ctx.bookingWindowDays} gün sonrası seçilebilir.`,
    };
  }
  if (
    !Number.isInteger(input.startHour) ||
    input.startHour < ctx.firstHour ||
    input.startHour >= ctx.closeHour
  ) {
    return {
      ok: false,
      field: "startHour",
      message: `Başlangıç ${String(ctx.firstHour).padStart(2, "0")}:00 ile ${String(ctx.closeHour - 1).padStart(2, "0")}:00 arasında olmalı.`,
    };
  }
  if (
    !Number.isInteger(input.hours) ||
    input.hours < 1 ||
    input.startHour + input.hours > ctx.closeHour
  ) {
    return {
      ok: false,
      field: "hours",
      message: `Süre en az 1 saat olmalı ve ${String(ctx.closeHour).padStart(2, "0")}:00'ı geçmemeli.`,
    };
  }
  if (
    input.date === ctx.today &&
    (input.startHour + input.hours) * 60 <= ctx.nowMinutes
  ) {
    return {
      ok: false,
      field: "startHour",
      message: "Bu saatler bugün geçti.",
    };
  }
  if (
    input.kind === "booking" &&
    (!Number.isInteger(input.guests) ||
      input.guests < 1 ||
      input.guests > ctx.capacity)
  ) {
    return {
      ok: false,
      field: "guests",
      message: `Kişi sayısı 1 ile ${ctx.capacity} arasında olmalı.`,
    };
  }
  if (input.kind === "booking" && !input.name) {
    return { ok: false, field: "name", message: "Misafirin adını yaz." };
  }
  if (input.email && !EMAIL_RE.test(input.email)) {
    return { ok: false, field: "email", message: "E-posta adresi geçersiz." };
  }
  return { ok: true };
}

/**
 * A desk booking's two rule sentences, stored on the row like every
 * booking's (`karaokeRulesOf` reads exactly two; with one it would fall
 * back to the online rule and promise a card refund nobody paid for).
 */
export function deskBookingRules(): [string, string] {
  return [
    "Bu rezervasyonun ödemesi köşkte alınır; kartla ön ödeme alınmadı.",
    `Değişiklik ya da iptal için bizi ara: ${SITE.phone}.`,
  ];
}

/**
 * Writes a desk booking or block. `actor` names who did it in the audit log
 * ("Yönetim paneli · Ad", "lafpos:Kasa 1", an admin's e-mail).
 */
export async function createDeskReservation(
  input: DeskReservationInput,
  actor: string,
  now: Date = new Date(),
): Promise<DeskReservationResult> {
  const settings = await getSettings();
  const rules = settings.mobileApp.karaoke;
  const clock = istanbulClock(now);
  const valid = validateDeskInput(input, {
    today: clock.date,
    nowMinutes: clock.minutes,
    firstHour: rules.firstHour,
    closeHour: rules.closeHour,
    capacity: settings.karaokeCapacity,
    bookingWindowDays: rules.bookingWindowDays,
  });
  if (!valid.ok) {
    return {
      ok: false,
      error: "invalid",
      message: valid.message,
      field: valid.field,
    };
  }

  const sameDay = await listReservationsForDate(input.date);
  if (rangeConflicts(input.startHour, input.hours, sameDay)) {
    return {
      ok: false,
      error: "slot_taken",
      field: "startHour",
      message: "Bu saatlerin bir kısmı dolu. Takvime bakıp başka bir saat seç.",
    };
  }

  const seq = await nextSeq("krk");
  const id = `krk-${String(seq).padStart(5, "0")}`;
  const iso = now.toISOString();
  const isBlock = input.kind === "block";
  const email = isBlock ? "" : input.email;
  const quote = isBlock
    ? { priceMinor: 0, discountMinor: 0, totalMinor: 0 }
    : quoteReservation(input.hours, settings.karaokeHourlyMinor, "", 0);
  const policy = effectiveKaraokeCancelPolicy(settings);
  const reservation: KaraokeReservation = {
    id,
    customerEmail: email || `desk-${id}@${DESK_PLACEHOLDER_DOMAIN}`,
    customerName: isBlock ? input.name || "Kapalı saat" : input.name,
    ...(email ? { contactEmail: email } : {}),
    ...(input.phone && !isBlock ? { contactPhone: input.phone } : {}),
    date: input.date,
    startHour: input.startHour,
    hours: input.hours,
    guests: isBlock ? 1 : input.guests,
    status: "confirmed",
    ...quote,
    note: isBlock
      ? `${DESK_BLOCK_NOTE_PREFIX}${input.note ? `: ${input.note}` : ""}`
      : input.note,
    createdAt: iso,
    updatedAt: iso,
    paymentStatus: "none",
    paymentDueAt: "",
    paidAt: "",
    refundedAt: "",
    paidMinor: 0,
    paymentRef: "",
    channel: "desk",
    legalConsent: null,
    guest: false,
    taxRatePct: karaokeTaxRate(settings.taxRates),
    freeCancelHours: policy.freeCancelHours,
    lateRefundPercent: policy.lateRefundPercent,
    cancelDeadline: karaokeDeadlineFor(policy, input, now).toISOString(),
    cancellationRules: deskBookingRules(),
    refundMinor: null,
  };

  const ins = await getDb()
    .from(TABLES.karaokeReservations)
    .insert(reservation);
  if (/TOO_MANY_OPEN_RESERVATIONS/.test(ins.error?.message ?? "")) {
    return {
      ok: false,
      error: "too_many",
      field: "email",
      message:
        "Bu e-postanın zaten iki açık rezervasyonu var. E-postayı boş bırakıp yeniden dene.",
    };
  }
  if (ins.error?.code === "23P01") {
    return {
      ok: false,
      error: "slot_taken",
      field: "startHour",
      message: "Bu saatler az önce doldu. Takvime bakıp başka bir saat seç.",
    };
  }
  if (ins.error)
    raiseDbError("karaoke.createDeskReservation", ins.error, ins.status);

  try {
    const { logAudit } = await import("@/lib/admin/audit");
    await logAudit({
      actor,
      action: "create",
      entity: "karaoke_reservation",
      entityId: id,
      payload: {
        event: isBlock ? "desk_block" : "desk_booking",
        date: input.date,
        startHour: input.startHour,
        hours: input.hours,
        guests: reservation.guests,
      },
    });
  } catch (err) {
    console.error(`[karaoke] audit row failed ${id}`, err);
  }

  // Only a real address is mailed: the confirmation, paid at the köşk.
  const notified =
    !isBlock && email ? await notifyReservationStatus(reservation) : true;
  return { ok: true, reservation, notified };
}

export type CancelDeskResult =
  | { ok: true; reservation: KaraokeReservation }
  | {
      ok: false;
      error: "not_found" | "not_desk" | "already_cancelled" | "raced";
    };

/**
 * Frees a desk booking or block (the panel's own rows only: a booking paid
 * online is cancelled, and refunded, in this site's panel).
 */
export async function cancelDeskReservation(
  id: string,
  actor: string,
  now: Date = new Date(),
): Promise<CancelDeskResult> {
  const r = await getReservation(id);
  if (!r) return { ok: false, error: "not_found" };
  if (r.channel !== "desk") return { ok: false, error: "not_desk" };
  if (r.status === "cancelled")
    return { ok: false, error: "already_cancelled" };
  const notify = !isDeskPlaceholderEmail(r.customerEmail);
  const res = await setReservationStatus(id, "cancelled", now, { notify });
  if (!res.ok) return { ok: false, error: "raced" };
  try {
    const { logAudit } = await import("@/lib/admin/audit");
    await logAudit({
      actor,
      action: "transition",
      entity: "karaoke_reservation",
      entityId: id,
      payload: { event: "desk_cancel", date: r.date, startHour: r.startHour },
    });
  } catch (err) {
    console.error(`[karaoke] audit row failed ${id}`, err);
  }
  return {
    ok: true,
    reservation: { ...r, status: "cancelled", updatedAt: now.toISOString() },
  };
}
