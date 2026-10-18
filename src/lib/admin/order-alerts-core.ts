// Client-safe (no server-only): the panel's new-order alert. Which orders
// ring, what the counter card and the desktop notification say, how a
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
  if (table) {
    const name = table.name || table.code;
    return /^masa(?:\s|\d|$)/.test(name.toLocaleLowerCase("tr-TR"))
      ? name
      : `Masa ${name}`;
  }
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

/** The card stack's order: table orders first, each group newest first. */
export function alertDisplayOrder(alerts: readonly OrderAlert[]): OrderAlert[] {
  return [...alerts].sort(
    (a, b) =>
      Number(b.table) - Number(a.table) ||
      Date.parse(b.paidAt) - Date.parse(a.paidAt),
  );
}

/** "Yeni masa siparişi", "Yeni gel-al siparişi", "Yeni kafe siparişi". */
export function orderAlertHeading(alert: OrderAlert): string {
  if (alert.table) return "Yeni masa siparişi";
  if (alert.label === ORDER_FULFILLMENT_LABELS.pickup) {
    return "Yeni gel-al siparişi";
  }
  return "Yeni kafe siparişi";
}

/** The desktop notification's title: "Yeni masa siparişi · Masa 4". */
export function notificationTitle(alert: OrderAlert): string {
  const heading = orderAlertHeading(alert);
  return alert.label === ORDER_FULFILLMENT_LABELS.pickup
    ? heading
    : `${heading} · ${alert.label}`;
}

/** "#10234 · 3 ürün · ₺185,00". */
export function notificationBody(alert: OrderAlert): string {
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
  };
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
