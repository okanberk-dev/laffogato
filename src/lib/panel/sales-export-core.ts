import { shiftDay } from "@/lib/admin/day-close-core";
import {
  karaokeMoneyOf,
  type KaraokeRevenueRow,
} from "@/lib/admin/karaoke-money";
import {
  MANUAL_PROVIDER_PREFIX,
  type ManualPaymentMethod,
} from "@/lib/admin/order-actions";
import { orderKind } from "@/lib/admin/order-channel";
import { branchOf, KARAOKE_BRANCH } from "@/lib/panel/branches";
import { istanbulDayStartIso } from "@/lib/admin/order-filters";
import type { InvoicePayment } from "@/lib/invoice/invoice-core";
import { MILK_IDS, SYRUP_IDS } from "@/lib/mobile/customization";
import {
  invoiceKdvBreakdown,
  invoiceRewardMinor,
  isTaxRate,
  kdvOfGross,
  orderKdvBreakdown,
} from "@/lib/utils/kdv";

/**
 * The online sales of a period for the köşk panel's P&L and till report
 * (ladmin.laffogato.net, the `lafmaliyet` project; docs/PANEL-SALES.md).
 *
 * The panel's revenue is the till's (ModPOS, pasted in monthly; LafPOS,
 * pushed day by day, once the panel switches to it), so the money this
 * site takes - app and web café orders, shop parcels, prepaid karaoke -
 * was in no figure there, and the drinks an app order used up
 * were missing from its consumption check. `GET /api/panel/sales` hands it
 * the period's totals and the café lines by menu item and size, which the
 * panel maps to its own products through the menu link (`siteMenuId` +
 * `siteMenuSlot`, docs/PANEL-MENU.md), with the milk, syrup and extra shot
 * choices made on them (`items[].options`, docs/API-MOBILE.md §3).
 *
 * The figures are Raporlar's and Gün sonu's, counted the same way:
 *
 * - an order counts when `isReportableOrder` would (paid and onwards) and
 *   was placed (`createdAt`) on one of the period's Istanbul days; its
 *   refunds come off its own net, clamped per order (`headlineFrom`);
 * - a booking counts on the day it was paid, with what `karaokeMoneyOf`
 *   says it keeps (`karaokeRevenueFrom`).
 *
 * Orders typed into this panel (`source: "manual"`) are rung on the till,
 * so they are in the panel's revenue already: they are only counted apart
 * (`manual`), never in `cafe` or `shop`. So are app and web orders whose
 * card payment failed and that were then settled at the till with "Ödendi
 * olarak işaretle" in cash or on the counter's card terminal
 * ({@link paidAtTill}): they keep their source, but their money went
 * through the till (ModPOS; LafPOS after the switch), so they are counted
 * apart too (`counter`), never in `cafe`, `shop` or the café lines.
 *
 * The KDV is the invoice's (`invoiceKdvBreakdown`: a reward coupon pays for
 * the goods, the base stays the full price), shared over what the order
 * kept after its refunds. An order without a stored split (placed before
 * lines carried their rate) adds its net to `unknownKdvNetMinor` instead of
 * a guess (CLAUDE.md "Satış anındaki oran saklanır").
 *
 * Per branch (21 Kas 2026, src/lib/panel/branches.ts): an order is its
 * table's branch's (a Marina table's QR order is Marina's money), every
 * other order Tuzla's, and the karaoke room is Tuzla's. `byBranch` splits
 * the period's café, till-settled and manual orders by branch; `?branch=`
 * narrows the whole answer to one branch (its orders; the shop and the
 * room only for Tuzla). Without it the totals are every branch's, as
 * before.
 *
 * No customer data at all: no name, no order number, no e-mail.
 *
 * Deliberately pure (no `server-only`, no database): the route and the
 * tests share it.
 */

export const PANEL_SALES_VERSION = 1;

/** A wider period is refused: the panel asks a month or a day at a time. */
export const PANEL_SALES_MAX_DAYS = 31;

/** More orders than this in one period is refused (422), never cut short. */
export const PANEL_SALES_MAX_ORDERS = 20_000;

/** The order statuses that count (`isReportableOrder`). */
export const PANEL_SALES_STATUSES = [
  "paid",
  "preparing",
  "shipped",
  "completed",
  "refunded",
] as const;

export interface PanelSalesRange {
  /** First Istanbul day, inclusive. */
  from: string;
  /** Last Istanbul day, inclusive. */
  to: string;
}

const DAY_RE = /^(\d{4})-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Years a period may fall in: the site's, with room to spare. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

function plausibleYear(year: string): boolean {
  const y = Number(year);
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

/** A real calendar day written `YYYY-MM-DD` (2026-02-30 is not one). */
function calendarDay(value: string | null): string | null {
  const m = value === null ? null : DAY_RE.exec(value);
  if (!m || !plausibleYear(m[1])) return null;
  return shiftDay(value as string, 0) === value ? value : null;
}

/**
 * The period asked for: `month=YYYY-MM` (that month), or `from` and `to`
 * (Istanbul days, both inclusive, `to` not before `from`, 31 days at most).
 * Null - a 400 - for anything else, both forms at once included.
 */
export function parsePanelSalesRange(
  params: URLSearchParams,
): PanelSalesRange | null {
  const month = params.get("month");
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  if (month !== null) {
    if (rawFrom !== null || rawTo !== null) return null;
    const m = MONTH_RE.exec(month);
    if (!m || !plausibleYear(m[1])) return null;
    const mm = Number(m[2]);
    if (mm < 1 || mm > 12) return null;
    const from = `${m[1]}-${m[2]}-01`;
    const next =
      mm === 12
        ? `${Number(m[1]) + 1}-01-01`
        : `${m[1]}-${String(mm + 1).padStart(2, "0")}-01`;
    return { from, to: shiftDay(next, -1) };
  }
  const from = calendarDay(rawFrom);
  const to = calendarDay(rawTo);
  if (!from || !to || to < from) return null;
  if (shiftDay(from, PANEL_SALES_MAX_DAYS - 1) < to) return null;
  return { from, to };
}

/**
 * The instants the route reads orders between: a day of margin either side
 * of the period, so a `createdAt` written with an offset is still read;
 * which day an order belongs to is decided by {@link inPanelSalesRange}.
 */
export function panelSalesReadBounds(range: PanelSalesRange): {
  since: string;
  until: string;
} {
  return {
    since: istanbulDayStartIso(range.from, -1),
    until: istanbulDayStartIso(range.to, 2),
  };
}

/** Whether an instant falls on one of the period's Istanbul days. */
export function inPanelSalesRange(
  iso: string | null | undefined,
  range: PanelSalesRange,
): boolean {
  const at = Date.parse(iso ?? "");
  if (!Number.isFinite(at)) return false;
  return (
    at >= Date.parse(istanbulDayStartIso(range.from)) &&
    at < Date.parse(istanbulDayStartIso(range.to, 1))
  );
}

/** The period is over in Tuzla: its figures move only by later refunds. */
export function panelSalesClosed(range: PanelSalesRange, now: Date): boolean {
  return now.getTime() >= Date.parse(istanbulDayStartIso(range.to, 1));
}

/**
 * The "Ödendi olarak işaretle" methods that are the till's: cash and the
 * counter's card terminal, rung on the till (ModPOS; LafPOS after the
 * switch) with its ÖKC fiş (the receipt says so, `receiptInvoiceNote`). A
 * bank transfer ("havale") never touches the till and "Diğer" names no
 * till, so both stay online money.
 */
export const PANEL_SALES_TILL_METHODS = [
  "nakit",
  "kart",
] as const satisfies readonly ManualPaymentMethod[];

const TILL_PROVIDERS: ReadonlySet<string> = new Set(
  PANEL_SALES_TILL_METHODS.map((m) => `${MANUAL_PROVIDER_PREFIX}${m}`),
);

/**
 * Whether an order was settled at the till: one of its succeeded payment
 * rows (as the e-Arşiv plan reads them, `paymentsFor`) is `manual:nakit` or
 * `manual:kart`.
 */
export function paidAtTill(payments: readonly InvoicePayment[]): boolean {
  return payments.some(
    (p) => p.status === "succeeded" && TILL_PROVIDERS.has(p.provider),
  );
}

// ─── Inputs ────────────────────────────────────────────────────────────────

/** The order columns the export reads. */
export interface PanelSalesOrderRow {
  /** Only to find its payment rows; never in the answer. */
  id: string;
  orderNo: number;
  status: string;
  kind?: string;
  source?: string;
  /** The order's branch; absent on a row from before branches: Tuzla. */
  branch?: string;
  createdAt: string;
  totalMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  shippingTaxRatePct?: number | null;
  promoCode?: string;
  refunds?: ReadonlyArray<{ amountMinor: number }> | null;
  items?: ReadonlyArray<{
    productName?: string;
    qty: number;
    unitPriceMinor: number;
    status?: string;
    menuItemId?: string;
    size?: string;
    /** The app's choices (`LineOptions`); absent on lines without any. */
    options?: Record<string, unknown> | null;
    taxRatePct?: number | null;
  }> | null;
}

/** The booking columns the export reads. */
export type PanelSalesBookingRow = KaraokeRevenueRow & {
  taxRatePct?: number | null;
};

// ─── Output ────────────────────────────────────────────────────────────────

export interface PanelSalesTotals {
  /** Orders counted. */
  orders: number;
  /** What they were placed for (KDV included), refunds not taken off. */
  grossMinor: number;
  /** Promo and coupon discounts inside `grossMinor` (already taken off). */
  discountMinor: number;
  /** Courier or shipping fees inside `grossMinor`. */
  deliveryMinor: number;
  /** Refunds on them, each order's clamped to its total. */
  refundedMinor: number;
  /** gross − refunded: what the köşk keeps, KDV included. */
  netMinor: number;
  /** The KDV owed on `netMinor`, from the orders with a stored split. */
  kdvMinor: number;
  /** Net of the orders without a stored split: their KDV is not known. */
  unknownKdvNetMinor: number;
}

export interface PanelSalesLine {
  /** The menu item (`mnu-0011`); "" for a line sold without one. */
  menuItemId: string;
  /** "L" maps to the item's large price; "M" and "single" to its first. */
  size: "M" | "L" | "single";
  /** The name it was last sold under in the period. */
  name: string;
  /** Units made: lines not cancelled, of orders not wholly refunded. */
  qty: number;
  /** Their unit price (options included) × qty: no discount, no refund. */
  listMinor: number;
  /** Units made with an extra shot (one shot each). Absent when none. */
  extraShots?: number;
  /**
   * Units made with another milk than the recipe's, by milk id
   * (`lactose-free`, `oat`, `almond`); "normal" is never counted. Absent
   * when none.
   */
  milks?: Record<string, number>;
  /** Units made with a syrup, by syrup id ("none" never). Absent when none. */
  syrups?: Record<string, number>;
}

/** The milks and syrups a line can swap in: the menu's own ids, no default. */
const SWAP_MILKS: ReadonlySet<string> = new Set(
  MILK_IDS.filter((id) => id !== "normal"),
);
const ADDED_SYRUPS: ReadonlySet<string> = new Set(
  SYRUP_IDS.filter((id) => id !== "none"),
);

function countInto(
  counts: Record<string, number> | undefined,
  id: string,
  qty: number,
): Record<string, number> {
  const out = counts ?? {};
  out[id] = (out[id] ?? 0) + qty;
  return out;
}

/**
 * Adds one order line's choices, `qty` units of them, to its export line:
 * what the panel's consumption check needs beyond the recipe (an oat milk
 * instead of the cow's, a syrup, a second shot).
 */
function addLineOptions(
  row: PanelSalesLine,
  options: Record<string, unknown> | null | undefined,
  qty: number,
): void {
  if (!options || typeof options !== "object") return;
  if (options.extraShot === true) {
    row.extraShots = (row.extraShots ?? 0) + qty;
  }
  if (typeof options.milk === "string" && SWAP_MILKS.has(options.milk)) {
    row.milks = countInto(row.milks, options.milk, qty);
  }
  if (typeof options.syrup === "string" && ADDED_SYRUPS.has(options.syrup)) {
    row.syrups = countInto(row.syrups, options.syrup, qty);
  }
}

export interface PanelSalesKaraoke {
  /** Bookings whose money the köşk keeps some of. */
  bookings: number;
  /** What the POS collected, refunds not taken off. */
  collectedMinor: number;
  refundedMinor: number;
  /** collected − refunded, KDV included. */
  netMinor: number;
  /** Owed back and not gone yet; inside `netMinor`. */
  refundPendingMinor: number;
  kdvMinor: number;
  unknownKdvNetMinor: number;
}

export interface PanelSales {
  version: typeof PANEL_SALES_VERSION;
  from: string;
  to: string;
  /** The period is over (later refunds can still lower its net). */
  closed: boolean;
  cafe: PanelSalesTotals & { lines: PanelSalesLine[] };
  shop: PanelSalesTotals;
  karaoke: PanelSalesKaraoke;
  /** Orders typed into this panel: on the till already, never in cafe/shop. */
  manual: { orders: number; grossMinor: number; netMinor: number };
  /**
   * App and web orders settled at the till ({@link paidAtTill}): on the
   * till already, never in cafe/shop or the café lines.
   */
  counter: PanelSalesTotals;
  /** The branch `?branch=` narrowed the answer to; null: every branch. */
  branch: string | null;
  /**
   * The answer's orders by branch (added 21 Kas 2026): café (online,
   * without lines), till-settled and manual. The shop and the room are
   * Tuzla's and not repeated here.
   */
  byBranch: Record<string, PanelSalesBranch>;
}

/** One branch's share of the period's orders (`byBranch`). */
export interface PanelSalesBranch {
  cafe: PanelSalesTotals;
  counter: PanelSalesTotals;
  manual: { orders: number; grossMinor: number; netMinor: number };
}

function emptyTotals(): PanelSalesTotals {
  return {
    orders: 0,
    grossMinor: 0,
    discountMinor: 0,
    deliveryMinor: 0,
    refundedMinor: 0,
    netMinor: 0,
    kdvMinor: 0,
    unknownKdvNetMinor: 0,
  };
}

function minor(value: unknown): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

function refundedOf(order: PanelSalesOrderRow, total: number): number {
  const sum = (order.refunds ?? []).reduce(
    (s, r) => s + minor(r.amountMinor),
    0,
  );
  return Math.min(total, sum);
}

/**
 * The KDV owed on what one order kept: the invoice's split (a reward
 * coupon's goods at full price), shared over the kept part of the total.
 * Null when the order has no stored split.
 */
export function orderKeptKdv(
  order: PanelSalesOrderRow,
  netMinor: number,
  couponSource: string | null,
): number | null {
  const kdvOrder = {
    items: (order.items ?? []).map((it) => ({
      qty: it.qty,
      unitPriceMinor: it.unitPriceMinor,
      taxRatePct: it.taxRatePct,
    })),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    shippingTaxRatePct: order.shippingTaxRatePct,
  };
  const reward = invoiceRewardMinor(kdvOrder, couponSource);
  const split =
    reward > 0
      ? invoiceKdvBreakdown(kdvOrder, reward)
      : orderKdvBreakdown(kdvOrder);
  if (!split) return null;
  const total = minor(order.totalMinor);
  // Paid wholly by a reward: nothing to refund, the invoice's KDV stands.
  if (total === 0) return split.taxMinor;
  return Math.round((split.taxMinor * netMinor) / total);
}

/**
 * Whether an order's lines were made: not when it was wholly refunded, or
 * refunded beyond the lines marked "İptal" up to nothing kept (the rule
 * `topProductsFrom` counts units by).
 */
function linesStand(order: PanelSalesOrderRow, refunded: number): boolean {
  if (refunded <= 0) return true;
  const total = minor(order.totalMinor);
  const cancelled = (order.items ?? []).reduce(
    (s, it) =>
      it.status === "cancelled"
        ? s + minor(it.unitPriceMinor) * minor(it.qty)
        : s,
    0,
  );
  const standing = total - Math.min(refunded, cancelled);
  return standing > 0 && total - refunded > 0;
}

function lineSize(size: string | undefined): PanelSalesLine["size"] {
  return size === "M" || size === "L" ? size : "single";
}

/**
 * The period's figures. `orders` are read with a margin and in any order
 * (newest first is what the route sends: a line's name is then the latest
 * one); `couponSourceOf` names the member coupon an order redeemed
 * (`couponSourcesForOrders`), null for none or a shared code;
 * `paymentsOf` gives an order's payment rows (`paymentsFor`), [] for none.
 */
export function buildPanelSales(input: {
  range: PanelSalesRange;
  now: Date;
  orders: readonly PanelSalesOrderRow[];
  bookings: readonly PanelSalesBookingRow[];
  couponSourceOf: (orderNo: number) => string | null;
  paymentsOf: (order: PanelSalesOrderRow) => readonly InvoicePayment[];
  /** One branch's figures only (`?branch=`); absent: every branch. */
  branch?: string | null;
}): PanelSales {
  const { range } = input;
  const only = input.branch ?? null;
  const cafe = emptyTotals();
  const shop = emptyTotals();
  const counter = emptyTotals();
  const manual = { orders: 0, grossMinor: 0, netMinor: 0 };
  const lines = new Map<string, PanelSalesLine>();
  const byBranch: Record<string, PanelSalesBranch> = {};
  const shareOf = (branch: string): PanelSalesBranch =>
    (byBranch[branch] ??= {
      cafe: emptyTotals(),
      counter: emptyTotals(),
      manual: { orders: 0, grossMinor: 0, netMinor: 0 },
    });

  for (const order of input.orders) {
    if (!(PANEL_SALES_STATUSES as readonly string[]).includes(order.status)) {
      continue;
    }
    if (!inPanelSalesRange(order.createdAt, range)) continue;
    const branch = branchOf(order);
    if (only && branch !== only) continue;
    const total = minor(order.totalMinor);
    const refunded = refundedOf(order, total);
    const net = total - refunded;
    if (order.source === "manual") {
      for (const m of [manual, shareOf(branch).manual]) {
        m.orders += 1;
        m.grossMinor += total;
        m.netMinor += net;
      }
      continue;
    }
    const atTill = paidAtTill(input.paymentsOf(order));
    const isCafe = orderKind(order) === "cafe";
    const block = atTill ? counter : isCafe ? cafe : shop;
    const share = atTill
      ? shareOf(branch).counter
      : isCafe
        ? shareOf(branch).cafe
        : null;
    const kdv = orderKeptKdv(order, net, input.couponSourceOf(order.orderNo));
    for (const b of share ? [block, share] : [block]) {
      b.orders += 1;
      b.grossMinor += total;
      b.discountMinor += minor(order.discountMinor);
      b.deliveryMinor += minor(order.shippingMinor);
      b.refundedMinor += refunded;
      b.netMinor += net;
      if (kdv === null) b.unknownKdvNetMinor += net;
      else b.kdvMinor += kdv;
    }

    if (atTill || !isCafe || !linesStand(order, refunded)) continue;
    for (const it of order.items ?? []) {
      if (it.status === "cancelled") continue;
      const qty = minor(it.qty);
      if (qty === 0) continue;
      const menuItemId = String(it.menuItemId ?? "");
      const size = lineSize(it.size);
      const name = String(it.productName ?? "").trim() || "Ürün";
      // A line sold without an item is kept apart by its name.
      const key = `${menuItemId}|${size}|${menuItemId ? "" : name}`;
      const row = lines.get(key);
      if (row) {
        row.qty += qty;
        row.listMinor += minor(it.unitPriceMinor) * qty;
      } else {
        lines.set(key, {
          menuItemId,
          size,
          name,
          qty,
          listMinor: minor(it.unitPriceMinor) * qty,
        });
      }
      addLineOptions(lines.get(key) as PanelSalesLine, it.options, qty);
    }
  }

  const karaoke: PanelSalesKaraoke = {
    bookings: 0,
    collectedMinor: 0,
    refundedMinor: 0,
    netMinor: 0,
    refundPendingMinor: 0,
    kdvMinor: 0,
    unknownKdvNetMinor: 0,
  };
  // The one room is Tuzla's: another branch's answer has no bookings.
  for (const booking of only && only !== KARAOKE_BRANCH ? [] : input.bookings) {
    const money = karaokeMoneyOf(booking);
    if (!money) continue;
    if (!inPanelSalesRange(booking.paidAt || booking.createdAt, range)) {
      continue;
    }
    karaoke.collectedMinor += money.paidMinor;
    karaoke.refundedMinor += money.paidMinor - money.keptMinor;
    karaoke.netMinor += money.keptMinor;
    karaoke.refundPendingMinor += money.refundPendingMinor;
    if (money.keptMinor > 0) karaoke.bookings += 1;
    if (isTaxRate(booking.taxRatePct)) {
      karaoke.kdvMinor += kdvOfGross(money.keptMinor, booking.taxRatePct);
    } else {
      karaoke.unknownKdvNetMinor += money.keptMinor;
    }
  }

  return {
    version: PANEL_SALES_VERSION,
    from: range.from,
    to: range.to,
    closed: panelSalesClosed(range, input.now),
    cafe: {
      ...cafe,
      lines: [...lines.values()].sort(
        (a, b) =>
          b.qty - a.qty ||
          a.name.localeCompare(b.name, "tr") ||
          a.size.localeCompare(b.size),
      ),
    },
    shop,
    karaoke,
    manual,
    counter,
    branch: only,
    byBranch,
  };
}
