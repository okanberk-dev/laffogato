// Client-safe (no server-only): the customer list's URL. One definition the
// page parses, the FilterBar draws and the store hands to SQL
// (admin_customer_page / admin_customer_counts), so the chips on screen and
// the query that ran can never disagree.
//
//   ?q=  filter=  izin=  eposta=  sirala=  yon=  sayfa=
//
// `filter` keeps its old name and values (members, guests) so a bookmarked
// view still opens; `inactive` is new.

import {
  parseFilters,
  parsePage,
  parseSort,
  firstParam,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import { escapeLike } from "./order-filters";
import { foldTr } from "./text-fold";

export const CUSTOMER_LIST_PATH = "/admin/musteriler";

/** Rows per page of the customer table. */
export const CUSTOMER_LIST_PAGE_SIZE = 50;

/** The tab param (StatusTabs `param`). */
export const CUSTOMER_TAB_PARAM = "filter";

export const CUSTOMER_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "Ad, e-posta ya da telefon",
    maxLength: 100,
  },
  {
    type: "select",
    name: "izin",
    label: "Ticari ileti",
    options: [
      { value: "var", label: "İzin veren üyeler" },
      { value: "yok", label: "İzin vermeyen üyeler" },
    ],
  },
  {
    type: "select",
    name: "eposta",
    label: "E-posta",
    options: [
      { value: "dogrulanmis", label: "Doğrulanmış üyeler" },
      { value: "dogrulanmamis", label: "Doğrulanmamış üyeler" },
    ],
  },
];

/** What a tab shows; also the `kind` the SQL functions take. */
export type CustomerKind = "all" | "members" | "guests" | "inactive";

/**
 * The tabs, in reading order. A new tab is a value here, a label, and the
 * same `kind` in the two SQL functions (one migration).
 */
export const CUSTOMER_TABS: ReadonlyArray<{
  value: Exclude<CustomerKind, "all"> | null;
  label: string;
}> = [
  { value: null, label: "Tümü" },
  { value: "members", label: "Üyeler" },
  { value: "guests", label: "Misafirler" },
  { value: "inactive", label: "Pasif" },
];

export const CUSTOMER_SORT_KEYS = [
  "hareket",
  "ad",
  "siparis",
  "harcama",
] as const;
export type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];

export const CUSTOMER_DEFAULT_SORT: SortState = {
  key: "hareket",
  dir: "desc",
};

/** The `p_sort` each sort key asks admin_customer_page for. */
export const CUSTOMER_SORT_COLUMNS: Record<
  CustomerSortKey,
  "activity" | "name" | "orders" | "value"
> = {
  hareket: "activity",
  ad: "name",
  siparis: "orders",
  harcama: "value",
};

/** What the store hands to SQL: validated, nothing raw from the URL. */
export interface CustomerListQuery {
  /**
   * The search box folded the Turkish way (foldTr), LIKE wildcards escaped;
   * SQL folds the columns with admin_fold_tr. "" = no search.
   */
  search: string;
  /** A phone number's digits typed in the box; "" when it is not one. */
  digits: string;
  /** Members who gave (yes) or did not give (no) commercial consent. */
  consent: "" | "yes" | "no";
  /** Members whose address is verified (yes) or not (no). */
  verified: "" | "yes" | "no";
}

export interface ParsedCustomerList {
  /** The FilterBar's values (parseFilters). */
  values: FilterValues;
  /** The tab's value; null = Tümü. */
  tab: Exclude<CustomerKind, "all"> | null;
  query: CustomerListQuery;
  sort: SortState;
  page: number;
  /** True when a tab, a filter, a sort or a page shapes the list. */
  narrowed: boolean;
}

/**
 * The digits of a phone number typed in the box, or "" when the text is not
 * one: only digits and the usual separators, four digits at least. A whole
 * number loses its trunk 0 or country 90, so "0532 123 45 67" also finds
 * "+90 532 123 45 67" (the stored number is compared by its digits).
 */
export function customerSearchDigits(text: string): string {
  const value = text.trim();
  if (!/^[\d\s()+.-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "";
  if (digits.length >= 12 && digits.startsWith("90")) return digits.slice(2);
  if (digits.length >= 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** The search box as the SQL functions read it. */
export function customerSearch(text: string): {
  search: string;
  digits: string;
} {
  const value = text.trim();
  if (!value) return { search: "", digits: "" };
  return {
    search: escapeLike(foldTr(value)),
    digits: customerSearchDigits(value),
  };
}

const TAB_VALUES = new Set<string>(
  CUSTOMER_TABS.flatMap((t) => (t.value === null ? [] : [t.value])),
);

/** The tab value from the URL, if it is one of the tabs. */
export function parseCustomerTab(
  sp: SearchParamsInput,
): ParsedCustomerList["tab"] {
  const raw = firstParam(sp, CUSTOMER_TAB_PARAM) ?? "";
  return TAB_VALUES.has(raw) ? (raw as ParsedCustomerList["tab"]) : null;
}

/** Everything the customer list page reads from its URL, validated. */
export function parseCustomerListParams(
  sp: SearchParamsInput,
): ParsedCustomerList {
  const values = parseFilters(sp, CUSTOMER_FILTER_FIELDS);
  const tab = parseCustomerTab(sp);
  const sort = parseSort(sp, CUSTOMER_SORT_KEYS, CUSTOMER_DEFAULT_SORT);
  const page = parsePage(sp);
  const { search, digits } = customerSearch(values.q ?? "");
  const query: CustomerListQuery = {
    search,
    digits,
    consent: values.izin === "var" ? "yes" : values.izin === "yok" ? "no" : "",
    verified:
      values.eposta === "dogrulanmis"
        ? "yes"
        : values.eposta === "dogrulanmamis"
          ? "no"
          : "",
  };
  const narrowed =
    Object.keys(values).length > 0 ||
    tab !== null ||
    sort.key !== CUSTOMER_DEFAULT_SORT.key ||
    sort.dir !== CUSTOMER_DEFAULT_SORT.dir ||
    page > 1;
  return { values, tab, query, sort, page, narrowed };
}

/** One customer as the list shows it (a row of admin_customer_page). */
export interface CustomerListRow {
  email: string;
  name: string;
  phone: string;
  isMember: boolean;
  isActive: boolean;
  emailVerified: boolean;
  /** The member's sign-up instant; "" for a guest. */
  memberSince: string;
  /** Commercial e-mail consent with its date on record (members only). */
  marketingConsent: boolean;
  /** Paid orders: abandoned checkouts and cancellations do not count. */
  orderCount: number;
  lifetimeValueMinor: number;
  refundedMinor: number;
  /** The newest order of any status; "" when none. */
  lastOrderAt: string;
  /** lastOrderAt, else memberSince: what "Son hareket" sorts by. */
  lastActivity: string;
}

/** The figures of one tab under the current filters. */
export interface CustomerTabTotals {
  customers: number;
  orderCount: number;
  lifetimeValueMinor: number;
  refundedMinor: number;
}

export type CustomerCounts = Record<CustomerKind, CustomerTabTotals>;

/** node-postgres hands bigint (int8) back as a string. */
function int(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** A raw admin_customer_page row as the page's row. */
export function toCustomerListRow(
  raw: Record<string, unknown>,
): CustomerListRow {
  return {
    email: text(raw.email),
    name: text(raw.name),
    phone: text(raw.phone),
    isMember: raw.isMember === true,
    isActive: raw.isActive !== false,
    emailVerified: raw.emailVerified === true,
    memberSince: text(raw.memberSince),
    marketingConsent: raw.marketingConsent === true,
    orderCount: int(raw.orderCount),
    lifetimeValueMinor: int(raw.lifetimeValueMinor),
    refundedMinor: int(raw.refundedMinor),
    lastOrderAt: text(raw.lastOrderAt),
    lastActivity: text(raw.lastActivity),
  };
}

const EMPTY_TOTALS: CustomerTabTotals = {
  customers: 0,
  orderCount: 0,
  lifetimeValueMinor: 0,
  refundedMinor: 0,
};

/** admin_customer_counts' rows keyed by tab; a missing tab reads as zero. */
export function toCustomerCounts(
  raw: ReadonlyArray<Record<string, unknown>>,
): CustomerCounts {
  const out: CustomerCounts = {
    all: { ...EMPTY_TOTALS },
    members: { ...EMPTY_TOTALS },
    guests: { ...EMPTY_TOTALS },
    inactive: { ...EMPTY_TOTALS },
  };
  for (const row of raw) {
    const kind = row.kind;
    if (
      kind !== "all" &&
      kind !== "members" &&
      kind !== "guests" &&
      kind !== "inactive"
    ) {
      continue;
    }
    out[kind] = {
      customers: int(row.customers),
      orderCount: int(row.orderCount),
      lifetimeValueMinor: int(row.lifetimeValueMinor),
      refundedMinor: int(row.refundedMinor),
    };
  }
  return out;
}
