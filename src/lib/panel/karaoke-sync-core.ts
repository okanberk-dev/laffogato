import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  KaraokePaymentStatus,
  KaraokeReservation,
  KaraokeReservationStatus,
} from "@/lib/mobile/karaoke-core";
import {
  karaokeEndInstant,
  karaokeStartInstant,
} from "@/lib/mobile/karaoke-time";

/**
 * The karaoke link between this site and the köşk's back-office panel
 * (ladmin.laffogato.net, the `lafmaliyet` project): the panel rings and
 * counts down the room on the bar's always-open screen, so it has to hear of
 * a booking the moment one is made or changes, without polling this site.
 *
 * Two requests, both signed with the same shared secret
 * (`KARAOKE_SYNC_SECRET`, set to the same value in both projects):
 *
 * 1. **Ping, site → panel.** A write that expires `live:karaoke`
 *    (src/lib/cache/tags.ts) sends `POST /api/karaoke/ping` to the panel
 *    after the response (src/lib/panel/karaoke-ping.ts). It carries no
 *    booking at all - only "something changed".
 * 2. **Pull, panel → site.** The panel answers a ping (and an opened board
 *    that is stale) with `GET /api/panel/karaoke?from&to`
 *    (src/app/api/panel/karaoke/route.ts) and gets the window's bookings
 *    in the shape below: the first name, the hour, the head count, the
 *    states. No e-mail, phone, surname, consent record or payment reference
 *    ever leaves (docs/PANEL-KARAOKE.md).
 *
 * Deliberately pure (no `server-only`, no database): the route, the ping and
 * the tests share it, and the panel project carries a byte-compatible copy of
 * the signature rules. Change the canonical string on one side only and every
 * request starts failing with 401.
 */

export const TIMESTAMP_HEADER = "x-laf-timestamp";
export const SIGNATURE_HEADER = "x-laf-signature";

/** How far apart the two clocks may be, either way, in seconds. */
export const MAX_SKEW_SECONDS = 300;

/** Shorter than this and the secret is treated as unset: the link is off. */
export const MIN_SECRET_LENGTH = 32;

export const DEFAULT_PANEL_URL = "https://ladmin.laffogato.net";

export interface PanelSyncConfig {
  secret: string;
  /** Origin of the panel, no trailing slash. */
  panelUrl: string;
}

/**
 * The link's configuration, or `null` when it is off: no secret, a secret
 * too short to be one, or a `PANEL_URL` that is not an https URL (http is
 * accepted for localhost only, for a panel running on the developer's
 * machine). Off means the ping sends nothing and the pull answers 503.
 */
export function panelSyncConfig(
  env: Record<string, string | undefined>,
): PanelSyncConfig | null {
  const secret = env.KARAOKE_SYNC_SECRET?.trim() ?? "";
  if (secret.length < MIN_SECRET_LENGTH) return null;
  const panelUrl = (env.PANEL_URL?.trim() || DEFAULT_PANEL_URL).replace(
    /\/+$/,
    "",
  );
  let parsed: URL;
  try {
    parsed = new URL(panelUrl);
  } catch {
    return null;
  }
  const local =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    return null;
  }
  return { secret, panelUrl };
}

// ─── Signature ─────────────────────────────────────────────────────────────

/**
 * The query string in a form both sides compute the same way whatever order
 * the parameters were written in: pairs sorted by key, then value (plain
 * code-unit comparison, not `localeCompare`), each percent-encoded.
 */
export function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([ak, av], [bk, bv]) =>
      ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
    )
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export interface SignatureInput {
  /** Unix seconds. */
  timestamp: number;
  method: string;
  url: URL;
  /** The raw body exactly as sent; "" for a GET. */
  body: string;
}

/**
 * What is signed: the instant, the method, the path, the canonical query
 * and the body's SHA-256. The host is left out on purpose - the request may
 * reach the canonical host through a redirect - and the path is not.
 */
export function canonicalString(input: SignatureInput): string {
  return [
    String(input.timestamp),
    input.method.toUpperCase(),
    input.url.pathname,
    canonicalQuery(input.url.searchParams),
    createHash("sha256").update(input.body, "utf8").digest("hex"),
  ].join("\n");
}

/** HMAC-SHA256 of the canonical string, lowercase hex. */
export function sign(secret: string, input: SignatureInput): string {
  return createHmac("sha256", secret)
    .update(canonicalString(input))
    .digest("hex");
}

/** The two headers a signed request carries. */
export function signedHeaders(
  secret: string,
  method: string,
  url: URL,
  body: string,
  nowMs: number = Date.now(),
): Record<string, string> {
  const timestamp = Math.floor(nowMs / 1000);
  return {
    [TIMESTAMP_HEADER]: String(timestamp),
    [SIGNATURE_HEADER]: `v1=${sign(secret, { timestamp, method, url, body })}`,
  };
}

/**
 * Whether a request carries a valid signature from the other side: a
 * timestamp within five minutes of `nowMs` (so a captured request cannot be
 * replayed later), and the `v1=` signature of exactly this method, path,
 * query and body. Compared in constant time (CLAUDE.md rule 7).
 */
export function verifySignature(
  secret: string,
  input: {
    method: string;
    url: URL;
    body: string;
    timestamp: string | null;
    signature: string | null;
    nowMs?: number;
  },
): boolean {
  if (!input.timestamp || !input.signature) return false;
  if (!/^\d{9,12}$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(now - timestamp) > MAX_SKEW_SECONDS) return false;
  const match = /^v1=([0-9a-f]{64})$/.exec(input.signature.trim());
  if (!match) return false;
  const want = Buffer.from(
    sign(secret, {
      timestamp,
      method: input.method,
      url: input.url,
      body: input.body,
    }),
    "hex",
  );
  const got = Buffer.from(match[1], "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

// ─── The pull's window ─────────────────────────────────────────────────────

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Türkiye keeps UTC+3 all year (CLAUDE.md rule 22). */
const ISTANBUL_OFFSET_MS = 3 * HOUR_MS;

/** Without `to`, the window reaches this many days past `from`. */
export const PANEL_DEFAULT_SPAN_DAYS = 90;
/** A wider window is refused: the panel never needs one. */
export const PANEL_MAX_SPAN_DAYS = 400;
/** Rows one pull returns at most; `complete` says whether more existed. */
export const PANEL_MAX_ROWS = 2000;

/** The Istanbul calendar day of an instant, `YYYY-MM-DD`. */
export function istanbulDayOf(at: Date): string {
  return new Date(at.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

function dayToUtc(day: string): number {
  const [y, m, d] = day.split("-").map((s) => parseInt(s, 10));
  return Date.UTC(y, m - 1, d);
}

function addDays(day: string, days: number): string {
  return new Date(dayToUtc(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A real calendar day written `YYYY-MM-DD` (2026-02-30 is not one). */
function calendarDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
    ? value
    : null;
}

/**
 * The days the pull reads, both inclusive. `from` defaults to yesterday in
 * Istanbul (a booking that started at 23:00 is still running at 00:30),
 * `to` to 90 days after `from`. `null` - a 400 - for a malformed day, a
 * window that ends before it starts, or one wider than 400 days.
 */
export function parsePanelRange(
  params: URLSearchParams,
  now: Date,
): { from: string; to: string } | null {
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  const from =
    rawFrom === null ? addDays(istanbulDayOf(now), -1) : calendarDay(rawFrom);
  if (!from) return null;
  const to =
    rawTo === null
      ? addDays(from, PANEL_DEFAULT_SPAN_DAYS)
      : calendarDay(rawTo);
  if (!to || to < from) return null;
  if ((dayToUtc(to) - dayToUtc(from)) / DAY_MS > PANEL_MAX_SPAN_DAYS) {
    return null;
  }
  return { from, to };
}

/** LafPOS's key reaches this many Istanbul days either side of today. */
export const LAFPOS_KARAOKE_REACH_DAYS = 1;

/**
 * Whether `range` stays inside what LafPOS's key may read: Istanbul
 * yesterday to tomorrow, both inclusive. The till runs today's room; a day
 * either way covers its business day, which runs to 05:00 (a session begun
 * last night is still on the till's yesterday), and a clock a little off
 * at midnight. The panel reads up to 400 days (`parsePanelRange`), but
 * LafPOS's key sits on the café's machine: a stolen machine must read a
 * few days of first names and notes, not the years the site keeps them
 * (src/lib/retention.ts). The route answers a wider window from LafPOS's
 * key 403, a window with no `from` too (yesterday and 90 days on).
 */
export function withinLafposKaraokeReach(
  range: { from: string; to: string },
  now: Date,
): boolean {
  const today = istanbulDayOf(now);
  return (
    range.from >= addDays(today, -LAFPOS_KARAOKE_REACH_DAYS) &&
    range.to <= addDays(today, LAFPOS_KARAOKE_REACH_DAYS)
  );
}

// ─── What the panel is told ────────────────────────────────────────────────

const STATUSES: readonly KaraokeReservationStatus[] = [
  "requested",
  "confirmed",
  "cancelled",
];
const PAYMENT_STATUSES: readonly KaraokePaymentStatus[] = [
  "none",
  "pending",
  "paid",
  "refunding",
  "refunded",
  "expired",
];

export const PANEL_FIRST_NAME_MAX = 40;
export const PANEL_NOTE_MAX = 300;

/**
 * One booking as the panel sees it. Everything a person at the bar needs to
 * run the room and nothing that identifies the guest beyond a first name.
 */
export interface PanelKaraokeReservation {
  id: string;
  /** YYYY-MM-DD, Istanbul calendar day. */
  date: string;
  startHour: number;
  hours: number;
  /** The instants the block starts and ends in Tuzla, ISO-8601 UTC. */
  startsAt: string;
  endsAt: string;
  guests: number;
  status: KaraokeReservationStatus;
  paymentStatus: KaraokePaymentStatus;
  firstName: string;
  note: string;
  totalMinor: number;
  channel: "web" | "app" | "";
  createdAt: string;
  updatedAt: string;
  /**
   * A cancelled booking's refund, kuruş (additive, 29 Eki 2026): what went
   * back or goes back. 0 = nothing (a late guest request under a 0 % rule:
   * the hours were put on sale, and `paymentStatus` reads "refunded" though
   * no money moved), a share below the payment = a late share or a resold
   * hour's part. `null` = no partial amount: if anything goes back it is the
   * whole payment (a cancelled booking still `paid`, `refunding` or
   * `refunded` in full, or one nothing was paid for), and always on a booking
   * that is not cancelled. A panel that does not read it keeps its old
   * wording.
   */
  refundMinor: number | null;
  /**
   * Taken at the köşk (additive, 22 Kas 2026): a phone/counter booking or
   * closed hours written by this site's panel or by `POST
   * /api/panel/karaoke` (karaoke-desk.ts). Only such a row may be freed
   * with the POST's `cancel`.
   */
  desk: boolean;
}

/** The columns the mapper reads; a full row is accepted and narrowed. */
export type PanelSourceRow = Pick<
  KaraokeReservation,
  | "id"
  | "date"
  | "startHour"
  | "hours"
  | "guests"
  | "status"
  | "customerName"
  | "note"
  | "totalMinor"
  | "createdAt"
  | "updatedAt"
> & { paymentStatus?: string; channel?: string; refundMinor?: number | null };

/** At most `max` characters, never splitting an emoji in two. */
function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") : text;
}

/** "Ayşe Nur Yılmaz" → "Ayşe": the surname never leaves. */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return clip(first, PANEL_FIRST_NAME_MAX);
}

/**
 * The panel's copy of one booking, or `null` for a row whose day or hours
 * cannot be turned into instants (one bad row must not fail the pull).
 * Built field by field from a whitelist: a column added to the table later
 * cannot reach the panel by accident.
 */
export function toPanelReservation(
  r: PanelSourceRow,
): PanelKaraokeReservation | null {
  const startHour = Number(r.startHour);
  const hours = Number(r.hours);
  if (
    !calendarDay(String(r.date ?? "")) ||
    !Number.isInteger(startHour) ||
    !Number.isInteger(hours) ||
    hours <= 0
  ) {
    return null;
  }
  const slot = { date: r.date, startHour, hours };
  const startsAt = karaokeStartInstant(slot.date, slot.startHour);
  const endsAt = karaokeEndInstant(slot);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }
  const status = (STATUSES as readonly string[]).includes(r.status)
    ? r.status
    : "requested";
  const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(
    r.paymentStatus ?? "",
  )
    ? (r.paymentStatus as KaraokePaymentStatus)
    : "none";
  const guests = Number(r.guests);
  const totalMinor = Number(r.totalMinor);
  // Only a cancelled booking's: a live one has nothing going back.
  const refundMinor =
    status === "cancelled" &&
    typeof r.refundMinor === "number" &&
    Number.isInteger(r.refundMinor) &&
    r.refundMinor >= 0
      ? r.refundMinor
      : null;
  return {
    id: String(r.id),
    date: r.date,
    startHour,
    hours,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    guests: Number.isFinite(guests) ? guests : 0,
    status,
    paymentStatus,
    firstName: firstNameOf(r.customerName),
    note: clip((r.note ?? "").trim(), PANEL_NOTE_MAX),
    totalMinor: Number.isFinite(totalMinor) ? totalMinor : 0,
    channel: r.channel === "web" || r.channel === "app" ? r.channel : "",
    desk: r.channel === "desk",
    createdAt: r.createdAt ?? "",
    updatedAt: r.updatedAt ?? "",
    refundMinor,
  };
}

/** Earliest first: by day, then hour, then id (a stable order). */
export function sortForPanel(
  rows: PanelKaraokeReservation[],
): PanelKaraokeReservation[] {
  return [...rows].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.startHour - b.startHour ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
