import "server-only";

import {
  istanbulTimeLabel,
  karaokeEndInstant,
} from "@/lib/mobile/karaoke-time";

import { dayAnchor, inIstanbulDay, istanbulToday } from "./day-close-core";
import { karaokeDetailHref } from "./karaoke-panel";
import { REFUND_DESTINATION_LABELS } from "./order-actions";
import { orderChannel } from "./order-channel";
import { ORDER_LIST_PATH } from "./order-filters";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "./order-ui";
import {
  dayCloseRows,
  headlineFrom,
  isReportableOrder,
  karaokeRevenueFrom,
  reportPeriodFilter,
  type AdminOrderStatus,
  type AnalyticsHeadline,
  type DayCloseOrder,
  type DayCloseRows,
} from "./store";

/**
 * The Gün sonu sheet (admin UI v2, UI-18): one Istanbul day of orders,
 * refunds, karaoke, till stamps and stock, on one printable page.
 *
 * The money is Raporlar's: the day's orders are the ones
 * `reportPeriodFilter("day", 1, …)` puts in that day's bar, the tiles are
 * `headlineFrom` of them, and the karaoke figure is `karaokeRevenueFrom`
 * for the same day. Nothing here counts revenue a second way, so the sheet
 * printed at closing and the report read the next morning say the same.
 */

export type DayCloseChannel = "web" | "app" | "manual";

/** The order list's own channel names and `kanal=` values. */
const CHANNELS: ReadonlyArray<{
  key: DayCloseChannel;
  label: string;
  param: string;
}> = [
  { key: "web", label: "Web", param: "web" },
  { key: "app", label: "Uygulama", param: "app" },
  { key: "manual", label: "Panelden (manuel)", param: "manuel" },
];

/** As the order list's Kanal filter splits it: a panel order is "manual" first. */
export function dayCloseChannel(
  o: Pick<DayCloseOrder, "channel" | "source">,
): DayCloseChannel {
  return o.source === "manual" ? "manual" : orderChannel(o);
}

export interface DayCloseChannelRow {
  key: DayCloseChannel;
  label: string;
  /** Placed in the day, any status. */
  placed: number;
  /** Counted as revenue (`isReportableOrder`): paid and onwards. */
  counted: number;
  /** Their totals less their refunds, as the headline's net. */
  netMinor: number;
  /** The order list on that day and channel. */
  href: string;
}

export interface DayCloseStatusRow {
  status: AdminOrderStatus;
  label: string;
  count: number;
}

export interface DayCloseRefundRow {
  key: string;
  kind: "order" | "karaoke";
  /** "#10042" or "KRK-00042": a number, never a name. */
  label: string;
  href: string;
  at: string;
  /** "21:47" in Tuzla. */
  time: string;
  amountMinor: number;
  /** Where the money went: Kart, Cüzdan, or a record only (cash). */
  destination: string;
}

export interface DayCloseKaraoke {
  /** Confirmed and over. */
  done: number;
  /** Their hours in the room. */
  doneHours: number;
  /** Confirmed and still to come (today only). */
  upcoming: number;
  /** Waiting for the köşk's confirmation. */
  requested: number;
  /**
   * Did not come: a pay-at-the-venue evening the köşk wrote off after its
   * end (karar D7: cancelled once the hour was over, without a mail).
   */
  noShow: number;
  /** Cancelled before the evening ended. */
  cancelled: number;
  /** Holds that closed unpaid (lapsed, or let go by the köşk). */
  unpaid: number;
  /** `karaokeRevenueFrom(…, "day", 1, …).periodNetMinor`: Raporlar's figure. */
  netMinor: number;
  /** The bookings behind it. */
  paidCount: number;
}

export interface DayCloseStamps {
  /** Stamps given at the till (and on a member's page), the day's sum. */
  given: number;
  /** In how many goes. */
  operations: number;
  /** Taken back with "−1 düzeltme". */
  corrected: number;
}

export interface DayCloseSoldOut {
  key: string;
  productId: string;
  /** The move's own label: "Ürün" or "Ürün · Varyant". */
  name: string;
  /** When its stock reached 0 ("14:05"). */
  time: string;
  /** Its last move of the day left it at 0. */
  stillOut: boolean;
}

export interface DayCloseSummary {
  day: string;
  /** The day is today: karaoke may still be to come, stock may move. */
  isToday: boolean;
  /** Raporlar's tiles for the day: `headlineFrom` of the day's orders. */
  headline: AnalyticsHeadline;
  /** Every order placed in the day, whatever its status. */
  placed: number;
  channels: DayCloseChannelRow[];
  /** The statuses that occurred, in the machine's order. */
  statuses: DayCloseStatusRow[];
  /** Refunds made in the day, on an order of any day, oldest first. */
  refunds: DayCloseRefundRow[];
  refundTotalMinor: number;
  karaoke: DayCloseKaraoke;
  stamps: DayCloseStamps;
  soldOut: DayCloseSoldOut[];
  /** The order list on that day. */
  ordersHref: string;
}

function ordersHref(day: string, channel?: string): string {
  const q = new URLSearchParams();
  if (channel) q.set("kanal", channel);
  q.set("bas", day);
  q.set("bit", day);
  return `${ORDER_LIST_PATH}?${q.toString()}`;
}

function refundedOf(o: Pick<DayCloseOrder, "refunds">): number {
  return (o.refunds ?? []).reduce((s, r) => s + (r.amountMinor || 0), 0);
}

/**
 * The pure half of the sheet, exported for tests: the day's rows
 * (`dayCloseRows`) read for `day`, with `now` the instant the sheet is
 * drawn (it decides which of today's karaoke hours are over).
 */
export function dayCloseSummary(
  rows: DayCloseRows,
  day: string,
  now: Date,
): DayCloseSummary {
  const anchor = dayAnchor(day);
  const inDay = reportPeriodFilter("day", 1, anchor);
  const orders = rows.orders.filter((o) => inDay(o.createdAt));

  const channels: DayCloseChannelRow[] = CHANNELS.map((c) => ({
    key: c.key,
    label: c.label,
    placed: 0,
    counted: 0,
    netMinor: 0,
    href: ordersHref(day, c.param),
  }));
  const byStatus = new Map<AdminOrderStatus, number>();
  for (const o of orders) {
    const row = channels.find((c) => c.key === dayCloseChannel(o))!;
    row.placed += 1;
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    if (!isReportableOrder(o)) continue;
    row.counted += 1;
    row.netMinor += Math.max(0, o.totalMinor - refundedOf(o));
  }
  const statuses = ORDER_STATUSES.filter((s) => byStatus.has(s)).map(
    (status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: byStatus.get(status) ?? 0,
    }),
  );

  // The day's refunds, wherever the order was placed: what went back today
  // (the tiles' İade is the refunds ON today's orders, as in Raporlar).
  const refunds: DayCloseRefundRow[] = [];
  for (const o of rows.refunded) {
    (o.refunds ?? []).forEach((r, i) => {
      if (!inIstanbulDay(r.createdAt, day)) return;
      refunds.push({
        key: `${o.id}:${r.id || i}`,
        kind: "order",
        label: `#${o.orderNo}`,
        href: `${ORDER_LIST_PATH}/${encodeURIComponent(o.id)}`,
        at: r.createdAt,
        time: istanbulTimeLabel(r.createdAt),
        amountMinor: r.amountMinor || 0,
        destination: r.destination
          ? (REFUND_DESTINATION_LABELS[r.destination] ?? "-")
          : "-",
      });
    });
  }
  for (const b of rows.karaokeMoney) {
    if (b.paymentStatus !== "refunded" || !inIstanbulDay(b.refundedAt, day)) {
      continue;
    }
    // What went back, as karaokeRevenueFrom takes it off: a late cancel's
    // share, else the whole payment.
    const paid = Math.max(0, Math.round(Number(b.paidMinor) || 0));
    const share =
      typeof b.refundMinor === "number" && b.refundMinor >= 0
        ? Math.min(paid, Math.round(b.refundMinor))
        : paid;
    if (share <= 0) continue;
    refunds.push({
      key: b.id,
      kind: "karaoke",
      label: b.id.toUpperCase(),
      href: karaokeDetailHref(b.id),
      at: b.refundedAt ?? "",
      time: istanbulTimeLabel(b.refundedAt ?? ""),
      amountMinor: share,
      destination: REFUND_DESTINATION_LABELS.card,
    });
  }
  refunds.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const money = karaokeRevenueFrom(rows.karaokeMoney, "day", 1, anchor);
  const karaoke: DayCloseKaraoke = {
    done: 0,
    doneHours: 0,
    upcoming: 0,
    requested: 0,
    noShow: 0,
    cancelled: 0,
    unpaid: 0,
    netMinor: money.periodNetMinor,
    paidCount: money.periodCount,
  };
  for (const b of rows.bookings) {
    if (b.date !== day) continue;
    const end = karaokeEndInstant(b).getTime();
    const payment = b.paymentStatus || "none";
    if (b.status === "confirmed") {
      if (end <= now.getTime()) {
        karaoke.done += 1;
        karaoke.doneHours += b.hours;
      } else {
        karaoke.upcoming += 1;
      }
    } else if (b.status === "requested") {
      karaoke.requested += 1;
    } else if (b.status === "cancelled") {
      if (payment === "expired") karaoke.unpaid += 1;
      else if (payment === "none" && Date.parse(b.updatedAt) >= end) {
        karaoke.noShow += 1;
      } else karaoke.cancelled += 1;
    }
  }

  const stamps: DayCloseStamps = { given: 0, operations: 0, corrected: 0 };
  for (const s of rows.stamps) {
    if (!inIstanbulDay(s.createdAt, day)) continue;
    if (s.kind === "earn" && s.source === "counter") {
      stamps.given += s.delta;
      stamps.operations += 1;
    } else if (s.kind === "reversal" && s.source === "admin" && !s.orderId) {
      // reverseCounterStamp: −1, by the panel, tied to no order.
      stamps.corrected += -s.delta;
    }
  }

  // Per product line (a variant is its own line, "Ürün · Varyant"): the
  // first sale or correction that left it at 0, and where the day left it.
  const lines = new Map<
    string,
    { productId: string; name: string; outAt: string; last: number }
  >();
  const moves = rows.stockMoves
    .filter((m) => inIstanbulDay(m.createdAt, day))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const m of moves) {
    const key = `${m.productId}\u0000${m.productName}`;
    const line = lines.get(key) ?? {
      productId: m.productId,
      name: m.productName,
      outAt: "",
      last: m.stockAfter,
    };
    line.last = m.stockAfter;
    if (!line.outAt && m.delta < 0 && m.stockAfter <= 0)
      line.outAt = m.createdAt;
    lines.set(key, line);
  }
  const soldOut: DayCloseSoldOut[] = [...lines.entries()]
    .filter(([, l]) => l.outAt)
    .sort(([, a], [, b]) => Date.parse(a.outAt) - Date.parse(b.outAt))
    .map(([key, l]) => ({
      key,
      productId: l.productId,
      name: l.name,
      time: istanbulTimeLabel(l.outAt),
      stillOut: l.last <= 0,
    }));

  return {
    day,
    isToday: day === istanbulToday(now),
    headline: headlineFrom(orders),
    placed: orders.length,
    channels,
    statuses,
    refunds,
    refundTotalMinor: refunds.reduce((s, r) => s + r.amountMinor, 0),
    karaoke,
    stamps,
    soldOut,
    ordersHref: ordersHref(day),
  };
}

/** The sheet for one Istanbul day: its rows, read once, then counted. */
export async function loadDayClose(
  day: string,
  now: Date,
): Promise<DayCloseSummary> {
  return dayCloseSummary(await dayCloseRows(day), day, now);
}
