// Client-safe (no server-only): the order list's URL. One definition the
// page parses, the FilterBar draws and the store turns into SQL, so the
// chips on screen and the query that ran can never disagree.
//
//   ?q=  durum=  kanal=  tur=  teslimat=  odeme=  bas=  bit=  dikkat=1
//   sirala=  yon=  sayfa=

import {
  parseFilters,
  parsePage,
  parseSort,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
  firstParam,
} from "./list-params";
import type { OrderFulfillment, OrderKind } from "./order-channel";
import { ORDER_STATUS_LABELS } from "./order-ui";
import type { AdminOrderStatus } from "./store";

export const ORDER_LIST_PATH = "/admin/siparisler";

/** Rows per page of the order table. */
export const ORDER_LIST_PAGE_SIZE = 50;

export const ORDER_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "Sipariş no, ad ya da e-posta",
    maxLength: 80,
  },
  {
    type: "select",
    name: "kanal",
    label: "Kanal",
    options: [
      { value: "web", label: "Web" },
      { value: "app", label: "Uygulama" },
      { value: "manuel", label: "Panelden (manuel)" },
    ],
  },
  {
    type: "select",
    name: "tur",
    label: "Tür",
    options: [
      { value: "shop", label: "Mağaza" },
      { value: "cafe", label: "Kafe" },
    ],
  },
  {
    type: "select",
    name: "teslimat",
    label: "Teslimat",
    options: [
      { value: "shipping", label: "Kargo" },
      { value: "pickup", label: "Gel-al" },
      { value: "delivery", label: "Kurye" },
      { value: "table", label: "Masaya servis" },
    ],
  },
  {
    type: "select",
    name: "odeme",
    label: "Ödeme",
    options: [
      { value: "odendi", label: "Ödendi" },
      { value: "odenmedi", label: "Ödenmedi" },
      { value: "iadeli", label: "İadeli" },
    ],
  },
  {
    type: "select",
    name: "dikkat",
    label: "Dikkat",
    options: [{ value: "1", label: "Dikkat isteyenler" }],
    allLabel: "Hepsi",
  },
  { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
];

/** The status tabs, in the order a shift reads them. */
export const ORDER_TABS: ReadonlyArray<{
  value: string | null;
  label: string;
}> = [
  { value: null, label: "Tümü" },
  { value: "acik", label: "Açık" },
  { value: "pending_payment", label: ORDER_STATUS_LABELS.pending_payment },
  { value: "paid", label: ORDER_STATUS_LABELS.paid },
  { value: "preparing", label: ORDER_STATUS_LABELS.preparing },
  { value: "shipped", label: ORDER_STATUS_LABELS.shipped },
  { value: "completed", label: ORDER_STATUS_LABELS.completed },
  { value: "cancelled", label: "İptal" },
  { value: "refunded", label: "İade" },
];

/**
 * An open order: everything not finished yet, the parcel with the carrier
 * and the coffee waiting at the counter ("Hazır") too. One set for the
 * "Açık" tab, the sidebar badge and the dashboard's "Aktif sipariş": the
 * badge counted three statuses and the tab four, so the badge said 5 and
 * the tab 8 (admin audit ORD-21).
 */
export const OPEN_ORDER_STATUSES: readonly AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
];

export const ORDER_SORT_KEYS = ["no", "tarih", "tutar", "musteri"] as const;
export type OrderSortKey = (typeof ORDER_SORT_KEYS)[number];

export const ORDER_DEFAULT_SORT: SortState = { key: "no", dir: "desc" };

/** The column each sort key orders by. */
export const ORDER_SORT_COLUMNS: Record<
  OrderSortKey,
  "orderNo" | "createdAt" | "totalMinor" | "customerName"
> = {
  no: "orderNo",
  tarih: "createdAt",
  tutar: "totalMinor",
  musteri: "customerName",
};

/** What the store filters on: already validated, nothing raw from the URL. */
export interface OrderListQuery {
  /** The search box: an order number and/or a name / e-mail pattern. */
  search: {
    /** `#10023` or `10023` typed: that order number. */
    orderNo: number | null;
    /** ILIKE pattern with `%` and `_` escaped, wrapped in `%…%`. */
    pattern: string;
  } | null;
  /** From the tab; null = every status. */
  statuses: readonly AdminOrderStatus[] | null;
  channel: "web" | "app" | "manual" | null;
  kind: OrderKind | null;
  fulfillment: OrderFulfillment | null;
  payment: "paid" | "unpaid" | "refunded" | null;
  attention: boolean;
  /** createdAt >= this instant (the first day's Istanbul midnight). */
  fromIso: string | null;
  /** createdAt < this instant (the day after the last day, Istanbul). */
  beforeIso: string | null;
}

export interface ParsedOrderList {
  /** The FilterBar's values (parseFilters). */
  values: FilterValues;
  /** The tab's value; null = Tümü. */
  tab: string | null;
  query: OrderListQuery;
  sort: SortState;
  page: number;
  /** True when anything narrows or reorders the list (its empty state). */
  narrowed: boolean;
  /**
   * Where the new-order poll and its sound run: the plain first page
   * (`all`) and the plain "Açık" tab (`open`), where every new order lands
   * and a shift works from (admin audit ORD-09). `open` counts open orders
   * only, so an order closed since the page was drawn raises no banner the
   * tab cannot show. Off (null) behind a filter, a sort, on page 2 and on
   * the other tabs: a new order is not there, and "Listeyi yenile" would
   * not show it.
   */
  live: "all" | "open" | null;
}

/**
 * `%`, `_` and the escape character itself, made literal for ILIKE (whose
 * default escape is the backslash). A search for "50%" must not match
 * every name containing "50", nor "_" any single character.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * The UTC instant an Istanbul calendar day starts (fixed UTC+3, CLAUDE.md
 * rule 22): "2026-10-01" is 2026-09-30T21:00:00.000Z. `createdAt` is stored
 * as a UTC ISO string, so string comparison against this is chronological.
 */
export function istanbulDayStartIso(day: string, addDays = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d + addDays) - 3 * 60 * 60 * 1000,
  ).toISOString();
}

const TAB_VALUES = new Set(
  ORDER_TABS.map((t) => t.value).filter((v): v is string => v !== null),
);

/** The tab value from the URL, if it is one of the tabs. */
export function parseOrderTab(sp: SearchParamsInput): string | null {
  const raw = firstParam(sp, "durum") ?? "";
  return TAB_VALUES.has(raw) ? raw : null;
}

/** The statuses a tab shows; null for Tümü. */
export function tabStatuses(tab: string | null): AdminOrderStatus[] | null {
  if (!tab) return null;
  if (tab === "acik") return [...OPEN_ORDER_STATUSES];
  return [tab as AdminOrderStatus];
}

/** The search box as an order number and a name / e-mail pattern. */
export function parseOrderSearch(text: string): OrderListQuery["search"] {
  const value = text.trim();
  if (!value) return null;
  const digits = /^#?\s*(\d{1,9})$/.exec(value);
  return {
    orderNo: digits ? Number(digits[1]) : null,
    pattern: `%${escapeLike(value)}%`,
  };
}

/** Everything the order list page reads from its URL, validated. */
export function parseOrderListParams(sp: SearchParamsInput): ParsedOrderList {
  const values = parseFilters(sp, ORDER_FILTER_FIELDS);
  const tab = parseOrderTab(sp);
  const sort = parseSort(sp, ORDER_SORT_KEYS, ORDER_DEFAULT_SORT);
  const page = parsePage(sp);
  const kanal = values.kanal;
  const odeme = values.odeme;
  const query: OrderListQuery = {
    search: values.q ? parseOrderSearch(values.q) : null,
    statuses: tabStatuses(tab),
    channel:
      kanal === "manuel"
        ? "manual"
        : kanal === "web" || kanal === "app"
          ? kanal
          : null,
    kind: (values.tur as OrderKind | undefined) ?? null,
    fulfillment: (values.teslimat as OrderFulfillment | undefined) ?? null,
    payment:
      odeme === "odendi"
        ? "paid"
        : odeme === "odenmedi"
          ? "unpaid"
          : odeme === "iadeli"
            ? "refunded"
            : null,
    attention: values.dikkat === "1",
    fromIso: values.bas ? istanbulDayStartIso(values.bas) : null,
    beforeIso: values.bit ? istanbulDayStartIso(values.bit, 1) : null,
  };
  const reshaped =
    Object.keys(values).length > 0 ||
    sort.key !== ORDER_DEFAULT_SORT.key ||
    sort.dir !== ORDER_DEFAULT_SORT.dir ||
    page > 1;
  const narrowed = reshaped || tab !== null;
  const live = reshaped
    ? null
    : tab === null
      ? "all"
      : tab === "acik"
        ? "open"
        : null;
  return { values, tab, query, sort, page, narrowed, live };
}

/** The same query without the tab: what the tab counts are counted over. */
export function withoutStatuses(query: OrderListQuery): OrderListQuery {
  return { ...query, statuses: null };
}
