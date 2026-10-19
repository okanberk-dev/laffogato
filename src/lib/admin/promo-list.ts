// Client-safe (no server-only): how the Promosyon list reads its codes. The
// page fetches (listPromos); the tabs, the search, the order and the page
// are decided here, so the list, its counts and the tests agree.

import { parsePublishInstant } from "./publish-window";
import { isPromoExpired } from "./promo-schema";
import {
  firstParam,
  pageCount,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import type { AdminPromo } from "./store";
import { foldTr } from "./text-fold";
import type { AdminTone } from "./tone";

export const PROMOS_PATH = "/admin/promosyon";

/** A code's view page. */
export function promoHref(id: string): string {
  return `${PROMOS_PATH}/${encodeURIComponent(id)}`;
}

export function promoEditHref(id: string): string {
  return `${promoHref(id)}/duzenle`;
}

/**
 * Where a code stands at the cart, one state per code: off by hand, past
 * its date, used up, or taken. The same order of checks as applyPromoCode
 * (an inactive code is "Pasif" even when it has also expired).
 */
export type PromoState = "aktif" | "pasif" | "suresi-dolmus" | "limit-doldu";

export function promoState(
  p: Pick<AdminPromo, "isActive" | "expiresAt" | "usageLimit" | "usageCount">,
  now: number = Date.now(),
): PromoState {
  if (!p.isActive) return "pasif";
  if (isPromoExpired(p.expiresAt, now)) return "suresi-dolmus";
  if (p.usageLimit > 0 && p.usageCount >= p.usageLimit) return "limit-doldu";
  return "aktif";
}

export const PROMO_STATE_LABELS: Record<PromoState, string> = {
  aktif: "Aktif",
  pasif: "Pasif",
  "suresi-dolmus": "Süresi dolmuş",
  "limit-doldu": "Limit doldu",
};

export const PROMO_STATE_TONES: Record<PromoState, AdminTone> = {
  aktif: "success",
  pasif: "neutral",
  "suresi-dolmus": "danger",
  "limit-doldu": "warning",
};

export type PromoTab = "tumu" | PromoState;

/** The URL param of the tabs; Tümü is the tab without it. */
export const PROMO_TAB_PARAM = "durum";

export const PROMO_TABS: ReadonlyArray<{
  tab: PromoTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "aktif", value: "aktif", label: "Aktif" },
  { tab: "pasif", value: "pasif", label: "Pasif" },
  { tab: "suresi-dolmus", value: "suresi-dolmus", label: "Süresi dolmuş" },
  { tab: "limit-doldu", value: "limit-doldu", label: "Limit doldu" },
];

export function parsePromoTab(sp: SearchParamsInput): PromoTab {
  const raw = firstParam(sp, PROMO_TAB_PARAM) ?? "";
  return PROMO_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

export const PROMO_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "Kod, ör. YAZ25",
    maxLength: 40,
  },
];

export const PROMO_SORT_KEYS = [
  "kod",
  "kullanim",
  "gecerlilik",
  "eklendi",
] as const;

/** Newest first, the order the list had before it could be sorted. */
export const PROMO_DEFAULT_SORT: SortState = { key: "eklendi", dir: "desc" };

export const PROMO_PAGE_SIZE = 50;

/** The search box: part of the code, any case. */
export function matchesPromoSearch(
  p: Pick<AdminPromo, "code">,
  query: string,
): boolean {
  const q = foldTr(query.replace(/\s+/g, ""));
  if (!q) return true;
  return foldTr(p.code).includes(q);
}

/** A code with no end date sorts after every dated one (it never ends). */
function expiryValue(expiresAt: string): number {
  if (!expiresAt) return Number.POSITIVE_INFINITY;
  return parsePublishInstant(expiresAt) ?? 0;
}

function compare(a: AdminPromo, b: AdminPromo, sort: SortState): number {
  let d = 0;
  if (sort.key === "kod") d = a.code.localeCompare(b.code, "tr");
  else if (sort.key === "kullanim") d = a.usageCount - b.usageCount;
  else if (sort.key === "gecerlilik") {
    const x = expiryValue(a.expiresAt);
    const y = expiryValue(b.expiresAt);
    d = x === y ? 0 : x < y ? -1 : 1;
  } else d = a.createdAt.localeCompare(b.createdAt);
  if (d === 0) d = a.code.localeCompare(b.code, "tr");
  return sort.dir === "asc" ? d : -d;
}

export interface PromoListResult {
  rows: AdminPromo[];
  page: number;
  /** Codes in the current tab with the search applied. */
  total: number;
  /** Every tab's count, the search applied: the tabs and the pager agree. */
  counts: Record<PromoTab, number>;
}

/** One page of the Promosyon list, and every tab's count. */
export function promoList(
  promos: readonly AdminPromo[],
  opts: {
    tab: PromoTab;
    filters: FilterValues;
    sort: SortState;
    page: number;
    pageSize?: number;
    now?: number;
  },
): PromoListResult {
  const size = opts.pageSize ?? PROMO_PAGE_SIZE;
  const now = opts.now ?? Date.now();
  const counts: Record<PromoTab, number> = {
    tumu: 0,
    aktif: 0,
    pasif: 0,
    "suresi-dolmus": 0,
    "limit-doldu": 0,
  };
  const shown: AdminPromo[] = [];
  for (const p of promos) {
    if (opts.filters.q && !matchesPromoSearch(p, opts.filters.q)) continue;
    const state = promoState(p, now);
    counts.tumu += 1;
    counts[state] += 1;
    if (opts.tab === "tumu" || opts.tab === state) shown.push(p);
  }
  shown.sort((a, b) => compare(a, b, opts.sort));
  const pages = pageCount(shown.length, size);
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    rows: shown.slice((page - 1) * size, page * size),
    page,
    total: shown.length,
    counts,
  };
}
