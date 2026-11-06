// Client-safe (no server-only): the panel's new-order alert. Which orders
// (and, since 6 Kas 2026, which table calls) ring, what the counter card and
// the desktop notification say, how a
// "Gördüm" is remembered across tabs, and the ring itself as numbers. The
// route (`/admin/siparisler/uyari`) and the client (order-alerts.tsx) both
// read this one file, so the rule cannot drift between what the server
// sends and what the browser rings for.

import { formatTRYMinor } from "@/lib/utils/commerce";

import { orderActions } from "./order-actions";
import {
  ORDER_FULFILLMENT_LABELS,
  orderFulfillment,
  orderKind,
  orderTable,
} from "./order-channel";
import { canAccess, type AdminRole } from "./roles";
import {
  TABLE_CALL_LIST_MAX,
  TABLE_CALL_REASON_LABELS,
  isTableCallReason,
  tableCallRings,
  tableLabel,
  type TableCallReason,
  type TableCallRow,
} from "./table-calls-core";

/** Where the alert polls. A route handler, not a page: it answers JSON. */
export const ORDER_ALERT_PATH = "/admin/siparisler/uyari";

/**
 * How long a paid order keeps ringing if nobody touches it. Long enough for
 * a busy evening, short enough that an order forgotten yesterday does not
 * ring every time the panel opens.
 */
export const ORDER_ALERT_WINDOW_MS = 4 * 60 * 60_000;

/** At most this many alerts per answer, newest first. */
export const ORDER_ALERT_LIMIT = 20;

/** The poll. A gel-al member is at the counter in about half a minute. */
export const ORDER_ALERT_POLL_MS = 10_000;

/**
 * The poll while the köşk is closed and nothing is waiting. The database
 * (Neon, free plan) sleeps after five idle minutes and every poll wakes it:
 * a panel tab left open overnight that asked every ten seconds kept it
 * awake all night and spent the month's compute hours. An hour is safe
 * because the route answers "fast" from an hour before opening (see
 * `orderAlertPollAfterMs`), so the last slow poll always lands before the
 * doors open.
 */
export const ORDER_ALERT_IDLE_POLL_MS = 60 * 60_000;

/** Where the "is it busy now" check looks, in minutes from now. */
export const ORDER_ALERT_BUSY_OFFSETS_MIN = [-30, 0, 15, 30, 45, 60] as const;

/**
 * How long the poller waits before its next ask: fast while the köşk is
 * open (or opens within the hour, or closed less than half an hour ago) or
 * while an order is waiting; hourly otherwise.
 */
export function orderAlertPollAfterMs(opts: {
  busy: boolean;
  hasAlerts: boolean;
}): number {
  return opts.busy || opts.hasAlerts
    ? ORDER_ALERT_POLL_MS
    : ORDER_ALERT_IDLE_POLL_MS;
}

/**
 * The next delay the poller uses: the server's `pollAfterMs` when it is a
 * sane number (5 s to 2 h), else the fallback.
 */
export function nextPollDelay(json: unknown, fallbackMs: number): number {
  const v =
    json && typeof json === "object"
      ? (json as { pollAfterMs?: unknown }).pollAfterMs
      : undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) return fallbackMs;
  return Math.min(2 * 60 * 60_000, Math.max(5_000, Math.round(v)));
}

/** A "Gördüm" is remembered this long, then forgotten. */
export const ORDER_ALERT_ACK_TTL_MS = 24 * 60 * 60_000;

/** Item names shown on the card before "+n". */
export const ORDER_ALERT_ITEM_PREVIEW = 3;

/** localStorage: the acknowledged order ids, shared by every tab. */
export const ORDER_ALERT_ACK_KEY = "laffogato.admin.orderAlerts.acks.v1";

/** A paidAt this far in the future still counts (clock skew between hosts). */
const FUTURE_SKEW_MS = 5 * 60_000;

/** The order fields the rule and the card read: nothing about the customer. */
export interface OrderAlertRow {
  id: string;
  orderNo: number;
  status: string;
  kind?: string;
  source?: string;
  fulfillment?: string;
  tableCode?: string;
  tableName?: string;
  paidAt?: string;
  totalMinor: number;
  items?: ReadonlyArray<{ productName?: string; qty?: number }>;
}

/** One alert as the route sends it and the counter reads it. */
export interface OrderAlert {
  id: string;
  orderNo: number;
  /** "Masa 4", "Gel-al", "Kurye". */
  label: string;
  /** A table order: it rings first and loudest. */
  table: boolean;
  /** Units, all lines together. */
  itemCount: number;
  /** The first lines, "2× Latte". */
  items: string[];
  /** Lines left out of `items`. */
  moreItems: number;
  totalMinor: number;
  paidAt: string;
  /**
   * A table call ("Garson çağır", 6 Kas 2026), not an order: `id` is the
   * call's (`tcl-...`), `paidAt` when it was made, `orderNo` 0 and no
   * items. Absent on an order.
   */
  call?: TableCallReason;
}

/**
 * Whether an order rings: a cafe order (table, gel-al, courier) that is
 * paid and not moved on yet, paid within the window. Shop parcels never
 * ring. Neither does an order typed into the panel (`source: "manual"`):
 * whoever typed it is standing at the counter already. The moment the staff
 * mail goes out (`notifyStaffNewOrder`, on `paid`) is the moment it starts.
 */
export function ringsForOrder(order: OrderAlertRow, nowMs: number): boolean {
  if (order.status !== "paid") return false;
  if (orderKind(order) !== "cafe") return false;
  if (order.source === "manual") return false;
  const paid = Date.parse(order.paidAt ?? "");
  if (!Number.isFinite(paid)) return false;
  return (
    paid >= nowMs - ORDER_ALERT_WINDOW_MS && paid <= nowMs + FUTURE_SKEW_MS
  );
}

/**
 * Who gets the alert: the roles with Siparişler (owner, manager, staff).
 * A cashier does not: the alert names what was ordered at which table and
 * opens the order, and the till role may not read the order list.
 */
export function orderAlertsFor(role: AdminRole): boolean {
  return canAccess("orders", role);
}

/**
 * Whether the card offers "Hazırlamaya başla": asked of `orderActions`, the
 * rule the order page and the action itself use, for a paid cafe order.
 */
export function alertMayStartPreparing(role: AdminRole): boolean {
  return (
    orderActions(
      { status: "paid", totalMinor: 0, refunds: [], fulfillment: "table" },
      role,
      true,
    ).start_preparing?.enabled === true
  );
}

/** The ISO instant the route reads from: `paidAt` is ISO text, so it sorts. */
export function orderAlertsSince(nowMs: number): string {
  return new Date(nowMs - ORDER_ALERT_WINDOW_MS).toISOString();
}

/**
 * Where the order goes, in the counter's words: "Masa 4" from the table
 * snapshot (a name that already says "Masa ..." is kept as it is), "Gel-al",
 * "Kurye".
 */
export function orderAlertLabel(order: OrderAlertRow): string {
  const table = orderTable(order);
  if (table) return tableLabel(table);
  return ORDER_FULFILLMENT_LABELS[orderFulfillment(order)];
}

function lineText(line: { productName?: string; qty?: number }): string {
  const qty = Math.max(1, Math.trunc(Number(line.qty) || 1));
  const name = String(line.productName ?? "").trim() || "Ürün";
  return qty > 1 ? `${qty}× ${name}` : name;
}

/** The alert for one order: label, counts and money only. */
export function toOrderAlert(order: OrderAlertRow): OrderAlert {
  const lines = order.items ?? [];
  return {
    id: order.id,
    orderNo: order.orderNo,
    label: orderAlertLabel(order),
    table: orderTable(order) !== null,
    itemCount: lines.reduce(
      (n, l) => n + Math.max(1, Math.trunc(Number(l.qty) || 1)),
      0,
    ),
    items: lines.slice(0, ORDER_ALERT_ITEM_PREVIEW).map(lineText),
    moreItems: Math.max(0, lines.length - ORDER_ALERT_ITEM_PREVIEW),
    totalMinor: order.totalMinor,
    paidAt: order.paidAt ?? "",
  };
}

/**
 * A table call as an alert: "Masa 4", rung like a table order, answered
 * with "Gördüm" (which answers the call itself, not only this browser).
 */
export function toCallAlert(call: TableCallRow): OrderAlert {
  return {
    id: call.id,
    orderNo: 0,
    label: tableLabel({ code: call.tableCode, name: call.tableName }),
    table: true,
    itemCount: 0,
    items: [],
    moreItems: 0,
    totalMinor: 0,
    paidAt: call.createdAt,
    call: call.reason,
  };
}

/**
 * The table calls that ring: unanswered and under fifteen minutes old
 * (table-calls-core.ts), newest first, at most TABLE_CALL_LIST_MAX.
 */
export function buildCallAlerts(
  calls: readonly TableCallRow[],
  nowMs: number,
): OrderAlert[] {
  return calls
    .filter((c) => !c.ackedAt && tableCallRings(Date.parse(c.createdAt), nowMs))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, TABLE_CALL_LIST_MAX)
    .map(toCallAlert);
}

/** The route's answer: the orders that ring, newest first, at most the limit. */
export function buildOrderAlerts(
  rows: readonly OrderAlertRow[],
  nowMs: number,
): OrderAlert[] {
  return rows
    .filter((o) => ringsForOrder(o, nowMs))
    .sort((a, b) => Date.parse(b.paidAt ?? "") - Date.parse(a.paidAt ?? ""))
    .slice(0, ORDER_ALERT_LIMIT)
    .map(toOrderAlert);
}

// ── The cheap answer: "nothing changed" ──────────────────────────────────
//
// A poll that finds nothing new used to read the database every ten
// seconds, and the database (Neon, free plan) does not sleep while it is
// asked more often than every five minutes. The route now keeps a change
// marker in the Data Cache that every write to `orders` replaces
// (src/lib/admin/change-marker.ts, src/lib/cache/tags.ts). Each full answer
// hands the poller a cursor; the poller sends it back, and while the marker
// is still the one in the cursor the route answers `{ unchanged: true }`
// without touching the database. A moved, missing or unreadable marker
// always gets the full answer, so failures lean to asking, not to silence.
// The cursor is bound to the session it was handed to (poll-binding.ts),
// and the marker also moves when a panel account is written: "nothing
// changed" means nothing changed for this session's account either.

/** While the köşk is busy, a full answer at least this often anyway. */
export const ORDER_ALERT_FULL_REFRESH_MS = 60 * 60_000;

/**
 * A marker this young may have been stored just after a write it did not
 * see (the cache keeps the time it STORED the marker, which can be later
 * than when it was made). A full answer read this soon after the marker
 * was made does not vouch for it: the next poll is full again. That covers
 * a marker the answer's own request made (made after `fullAt`), however
 * late the cache stores it: a marker read back from the cache was stored
 * before that read, so the orders read after it saw every write the late
 * store could have hidden (tests/admin-order-alerts-slow-cache.test.ts).
 * The five seconds are for a cache that answers from memory before it has
 * stored.
 */
export const ORDER_ALERT_MARKER_SETTLE_MS = 5_000;

/** What the cursor carries. */
export interface OrderAlertCursor {
  /** The change marker the full answer was read under. */
  marker: string;
  /** When that full answer was read (server clock, ms). */
  fullAt: number;
  /** The newest alert's paidAt in that answer (ms), 0 for none. */
  newestPaidAt: number;
  /** The session it was handed to (poll-binding.ts `sessionBinding`). */
  session: string;
}

/** "<time base36>-<random base36>", as change-marker.ts makes them. */
const MARKER_RE = /^[0-9a-z]{1,12}-[0-9a-z]{1,24}$/;
/** 12 hex digits, as poll-binding.ts makes them. */
const SESSION_BINDING_RE = /^[0-9a-f]{12}$/;
const CURSOR_RE =
  /^a2\.([0-9a-z]{1,12}-[0-9a-z]{1,24})\.([0-9a-z]{1,12})\.([0-9a-z]{1,12})\.([0-9a-f]{12})$/;
/**
 * Longer than any cursor this file makes (the poller keeps none longer);
 * anything longer is junk.
 */
const MAX_CURSOR_LENGTH = 80;

export function isChangeMarker(value: unknown): value is string {
  return typeof value === "string" && MARKER_RE.test(value);
}

export function isSessionBinding(value: unknown): value is string {
  return typeof value === "string" && SESSION_BINDING_RE.test(value);
}

/** When the marker was made (ms), or null for a marker that says nothing. */
export function markerMadeAt(marker: string): number | null {
  if (!isChangeMarker(marker)) return null;
  const t = parseInt(marker.slice(0, marker.indexOf("-")), 36);
  return Number.isFinite(t) && t > 0 ? t : null;
}

/** The cursor, or "" (no cursor) for a marker or session it cannot carry. */
export function formatOrderAlertCursor(c: OrderAlertCursor): string {
  if (!isChangeMarker(c.marker) || !isSessionBinding(c.session)) return "";
  return [
    "a2",
    c.marker,
    Math.max(0, Math.trunc(c.fullAt)).toString(36),
    Math.max(0, Math.trunc(c.newestPaidAt)).toString(36),
    c.session,
  ].join(".");
}

/**
 * The cursor the poller sent back, or null for none, junk or an old shape
 * (an `a1` cursor from before the session binding: one full answer).
 */
export function parseOrderAlertCursor(
  raw: string | null | undefined,
): OrderAlertCursor | null {
  if (!raw || raw.length > MAX_CURSOR_LENGTH) return null;
  const m = CURSOR_RE.exec(raw);
  if (!m) return null;
  const fullAt = parseInt(m[2], 36);
  const newestPaidAt = parseInt(m[3], 36);
  if (!Number.isFinite(fullAt) || !Number.isFinite(newestPaidAt)) return null;
  return { marker: m[1], fullAt, newestPaidAt, session: m[4] };
}

/**
 * The newest paidAt among `alerts` (ms), 0 for none: what the cursor keeps
 * so a "nothing changed" answer still knows whether something rings.
 */
export function newestAlertPaidAt(alerts: readonly OrderAlert[]): number {
  let newest = 0;
  for (const a of alerts) {
    const t = Date.parse(a.paidAt);
    if (Number.isFinite(t) && t > newest) newest = t;
  }
  return newest;
}

/**
 * Whether an alert paid at `paidAtMs` still rings at `nowMs`: the window and
 * the clock skew of `ringsForOrder`.
 */
export function stillRinging(paidAtMs: number, nowMs: number): boolean {
  return (
    Number.isFinite(paidAtMs) &&
    paidAtMs > 0 &&
    paidAtMs >= nowMs - ORDER_ALERT_WINDOW_MS &&
    paidAtMs <= nowMs + FUTURE_SKEW_MS
  );
}

/**
 * Whether an alert the browser holds still rings at `nowMs`: an order for
 * the order window, a table call for its fifteen minutes. What a "nothing
 * changed" answer keeps (order-alert-controller.ts): an unanswered call
 * stops on its own when its time is up, with no write to say so.
 */
export function alertStillRinging(alert: OrderAlert, nowMs: number): boolean {
  const at = Date.parse(alert.paidAt);
  return alert.call ? tableCallRings(at, nowMs) : stillRinging(at, nowMs);
}

/**
 * May the route answer "nothing changed" without reading the orders or the
 * account? Only when the cursor was handed to this session, the marker is
 * readable and is the one the last full answer was read under (no order and
 * no panel account written since), that answer was read a settle period
 * after the marker was made, is not from the future, and, while the köşk is
 * busy, is under an hour old. Everything else gets the full answer.
 */
export function mayAnswerUnchanged(opts: {
  cursor: OrderAlertCursor | null;
  marker: string | null;
  /** This request's session (poll-binding.ts `sessionBinding`). */
  session: string;
  nowMs: number;
  busy: boolean;
}): boolean {
  const { cursor, marker, session, nowMs, busy } = opts;
  if (!cursor || marker === null || cursor.marker !== marker) return false;
  if (!isSessionBinding(session) || cursor.session !== session) return false;
  const made = markerMadeAt(marker);
  if (made === null) return false;
  if (cursor.fullAt < made + ORDER_ALERT_MARKER_SETTLE_MS) return false;
  if (cursor.fullAt > nowMs) return false;
  if (busy && nowMs - cursor.fullAt >= ORDER_ALERT_FULL_REFRESH_MS) {
    return false;
  }
  return true;
}

const CLOCK = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
});

/** When it was paid, on the köşk's clock ("21:05"); "" when unknown. */
export function orderAlertTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? CLOCK.format(new Date(t)) : "";
}

/**
 * The card stack's order: table calls first (a guest is waving), then
 * table orders, each group newest first.
 */
export function alertDisplayOrder(alerts: readonly OrderAlert[]): OrderAlert[] {
  return [...alerts].sort(
    (a, b) =>
      Number(Boolean(b.call)) - Number(Boolean(a.call)) ||
      Number(b.table) - Number(a.table) ||
      Date.parse(b.paidAt) - Date.parse(a.paidAt),
  );
}

/**
 * "Yeni masa siparişi", "Yeni gel-al siparişi", "Yeni kafe siparişi"; a
 * table call says what the table wants ("Su istiyor").
 */
export function orderAlertHeading(alert: OrderAlert): string {
  if (alert.call) return TABLE_CALL_REASON_LABELS[alert.call];
  if (alert.table) return "Yeni masa siparişi";
  if (alert.label === ORDER_FULFILLMENT_LABELS.pickup) {
    return "Yeni gel-al siparişi";
  }
  return "Yeni kafe siparişi";
}

/**
 * The desktop notification's title: "Yeni masa siparişi · Masa 4"; a table
 * call "Masa 4 · Su istiyor".
 */
export function notificationTitle(alert: OrderAlert): string {
  const heading = orderAlertHeading(alert);
  if (alert.call) return `${alert.label} · ${heading}`;
  return alert.label === ORDER_FULFILLMENT_LABELS.pickup
    ? heading
    : `${heading} · ${alert.label}`;
}

/** "#10234 · 3 ürün · ₺185,00"; a table call "Masa çağrısı · 21:05". */
export function notificationBody(alert: OrderAlert): string {
  if (alert.call) {
    const time = orderAlertTime(alert.paidAt);
    return time ? `Masa çağrısı · ${time}` : "Masa çağrısı";
  }
  return `#${alert.orderNo} · ${alert.itemCount} ürün · ${formatTRYMinor(alert.totalMinor)}`;
}

/** The notification's tag: one per order, so a repeat replaces it. */
export function notificationTag(alert: { id: string }): string {
  return `laf-order-${alert.id}`;
}

const TITLE_PREFIX = /^\(\d+\) Yeni sipariş · /;

/** The tab title without the alert's prefix. */
export function stripAlertTitle(title: string): string {
  return title.replace(TITLE_PREFIX, "");
}

/** "(2) Yeni sipariş · Admin · Siparişler"; the plain title at zero. */
export function titleWithAlerts(title: string, count: number): string {
  const base = stripAlertTitle(title);
  return count > 0 ? `(${count}) Yeni sipariş · ${base}` : base;
}

// ── "Gördüm", shared by the tabs ─────────────────────────────────────────

/** Order id -> when it was acknowledged (ms). */
export type OrderAlertAcks = Record<string, number>;

/** Acknowledgements kept at most (the newest win). */
const MAX_ACKS = 300;

/** The stored acknowledgements, older than a day dropped; junk reads as none. */
export function parseAcks(raw: string | null, nowMs: number): OrderAlertAcks {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return pruneAcks(parsed as Record<string, unknown>, nowMs);
}

/** Keeps the last day's acknowledgements, the newest MAX_ACKS of them. */
export function pruneAcks(
  acks: Record<string, unknown>,
  nowMs: number,
): OrderAlertAcks {
  const kept = Object.entries(acks)
    .filter(
      (e): e is [string, number] =>
        typeof e[1] === "number" &&
        Number.isFinite(e[1]) &&
        nowMs - e[1] <= ORDER_ALERT_ACK_TTL_MS &&
        e[0].length > 0 &&
        e[0].length <= 64,
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ACKS);
  return Object.fromEntries(kept);
}

export function addAck(
  acks: OrderAlertAcks,
  id: string,
  nowMs: number,
): OrderAlertAcks {
  return pruneAcks({ ...acks, [id]: nowMs }, nowMs);
}

/** The alerts nobody has acknowledged yet. */
export function pendingAlerts(
  alerts: readonly OrderAlert[],
  acks: OrderAlertAcks,
): OrderAlert[] {
  return alerts.filter((a) => !(a.id in acks));
}

// ── The route's answer, as the browser trusts it ─────────────────────────

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function readAlert(v: unknown): OrderAlert | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (!isStr(a.id) || !a.id || !isNum(a.orderNo) || !isStr(a.label)) {
    return null;
  }
  return {
    id: a.id,
    orderNo: a.orderNo,
    label: a.label,
    table: a.table === true,
    itemCount: isNum(a.itemCount) ? a.itemCount : 0,
    items: Array.isArray(a.items) ? a.items.filter(isStr) : [],
    moreItems: isNum(a.moreItems) ? a.moreItems : 0,
    totalMinor: isNum(a.totalMinor) ? a.totalMinor : 0,
    paidAt: isStr(a.paidAt) ? a.paidAt : "",
    ...(isTableCallReason(a.call) ? { call: a.call } : {}),
  };
}

/**
 * `{ now, unchanged: true }` from the route ("nothing changed since your
 * cursor"), or null when it is not that answer.
 */
export function parseUnchangedPayload(json: unknown): { now: string } | null {
  if (!json || typeof json !== "object") return null;
  const body = json as { now?: unknown; unchanged?: unknown };
  if (body.unchanged !== true) return null;
  return { now: isStr(body.now) ? body.now : "" };
}

/** `{ now, alerts }` from the route, or null when it is not that shape. */
export function parseOrderAlertPayload(
  json: unknown,
): { now: string; alerts: OrderAlert[] } | null {
  if (!json || typeof json !== "object") return null;
  const body = json as { now?: unknown; alerts?: unknown };
  if (!Array.isArray(body.alerts)) return null;
  const alerts = body.alerts
    .map(readAlert)
    .filter((a): a is OrderAlert => a !== null);
  return { now: isStr(body.now) ? body.now : "", alerts };
}

// ── The ring ─────────────────────────────────────────────────────────────

/** One struck bell: a fundamental plus BELL_PARTIALS above it. */
export interface BellNote {
  /** Seconds from the start of the cycle. */
  at: number;
  /** The fundamental, Hz. */
  freq: number;
  /** Peak gain of the fundamental, 0..1, before the level. */
  peak: number;
  /** Seconds to fall to silence. */
  decay: number;
}

/**
 * The overtones that make a sine sound struck rather than hummed: the
 * inharmonic ratios of a free metal bar (1 : 2.76 : 5.40), each quieter.
 */
export const BELL_PARTIALS: ReadonlyArray<{ ratio: number; gain: number }> = [
  { ratio: 1, gain: 1 },
  { ratio: 2.76, gain: 0.4 },
  { ratio: 5.4, gain: 0.16 },
];

/** C6, E6, G6: a bright rising triad, the partner-tablet "ding ding ding". */
export const RING_NOTES_HZ: readonly number[] = [1046.5, 1318.5, 1568];

/** Gap between the three notes, and between the two runs. */
export const RING_NOTE_GAP_S = 0.11;
export const RING_RUN_GAP_S = 0.5;

/** One ring every three seconds until someone answers it. */
export const RING_CYCLE_MS = 3000;

/** Table orders ring at full level, the others a little lower. */
export const RING_LEVEL_TABLE = 1;
export const RING_LEVEL_OTHER = 0.8;

/** The motif: three quick rising notes, played twice, the last one ringing on. */
export function ringMotif(): BellNote[] {
  const notes: BellNote[] = [];
  for (let run = 0; run < 2; run += 1) {
    RING_NOTES_HZ.forEach((freq, i) => {
      notes.push({
        at: Number((run * RING_RUN_GAP_S + i * RING_NOTE_GAP_S).toFixed(3)),
        freq,
        peak: 0.5,
        decay: i === RING_NOTES_HZ.length - 1 ? 0.6 : 0.32,
      });
    });
  }
  return notes;
}

/** Seconds from the first strike until the last note is silent. */
export function ringMotifLength(notes: readonly BellNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.at + n.decay), 0);
}

/** How loud the next ring is: full when any waiting order is a table's. */
export function ringLevel(alerts: readonly OrderAlert[]): number {
  return alerts.some((a) => a.table) ? RING_LEVEL_TABLE : RING_LEVEL_OTHER;
}

// ── Desktop notifications, in plain Turkish ──────────────────────────────

export type AlertPermission = "granted" | "denied" | "default" | "unsupported";

/** What the bell's menu says about the browser's notification permission. */
export function notificationPermissionText(p: AlertPermission): string {
  switch (p) {
    case "granted":
      return "Masaüstü bildirimleri açık.";
    case "denied":
      return "Chrome bildirimleri engelliyor. Adres çubuğunun solundaki site ayarları simgesinden Bildirimler'e izin ver. Mac'te Sistem Ayarları > Bildirimler > Google Chrome'dan da aç.";
    case "unsupported":
      return "Bu tarayıcı masaüstü bildirimi göstermiyor. Ses ve ekrandaki kart yine çalışır.";
    default:
      return "Masaüstü bildirimleri kapalı.";
  }
}
