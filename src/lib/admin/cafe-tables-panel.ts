// Client-safe (no server-only): how the Masalar list reads its tables. The
// pages fetch (lib/admin/cafe-tables.ts); the tabs, the search, the order
// and the page are decided here, so the list and the tests agree.

import type { CafeTable } from "./cafe-tables";
import {
  firstParam,
  pageCount,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import { foldTr } from "./text-fold";

export const CAFE_TABLES_PATH = "/admin/masalar";

/** A table's view page. */
export function cafeTableHref(id: string): string {
  return `${CAFE_TABLES_PATH}/${encodeURIComponent(id)}`;
}

export function cafeTableEditHref(id: string): string {
  return `${cafeTableHref(id)}/duzenle`;
}

/** The QR as an SVG download (a route handler that checks the role itself). */
export function cafeTableQrHref(id: string): string {
  return `${cafeTableHref(id)}/qr`;
}

/** The print sheet: every active table, or one table's card alone. */
export const CAFE_TABLE_PRINT_PARAM = "masa";

export function cafeTablePrintHref(id?: string): string {
  const sheet = `${CAFE_TABLES_PATH}/yazdir`;
  return id
    ? `${sheet}?${CAFE_TABLE_PRINT_PARAM}=${encodeURIComponent(id)}`
    : sheet;
}

/**
 * Which tables the print sheet holds: the one `?masa=` names (active or
 * not, it was asked for by name), else every active one.
 */
export function tablesToPrint(
  tables: readonly CafeTable[],
  only: string | undefined,
): CafeTable[] {
  if (only) return tables.filter((t) => t.id === only);
  return tables.filter((t) => t.isActive);
}

export type CafeTableTab = "tumu" | "aktif" | "pasif";

/** The URL param of the tabs; Tümü is the tab without it. */
export const CAFE_TABLE_TAB_PARAM = "durum";

export const CAFE_TABLE_TABS: ReadonlyArray<{
  tab: CafeTableTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "aktif", value: "aktif", label: "Aktif" },
  { tab: "pasif", value: "pasif", label: "Pasif" },
];

export function parseCafeTableTab(sp: SearchParamsInput): CafeTableTab {
  const raw = firstParam(sp, CAFE_TABLE_TAB_PARAM) ?? "";
  return CAFE_TABLE_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

export const CAFE_TABLE_FILTER_FIELDS: readonly FilterField[] = [
  {
    type: "search",
    name: "q",
    label: "Ara",
    placeholder: "Masa adı ya da kod",
  },
];

/** `sira` is the panel's own order (Sıra, then name), as the print sheet. */
export const CAFE_TABLE_SORT_KEYS = ["sira", "ad"] as const;
export const CAFE_TABLE_DEFAULT_SORT: SortState = { key: "sira", dir: "asc" };

export const CAFE_TABLE_PAGE_SIZE = 50;

function inTab(t: CafeTable, tab: CafeTableTab): boolean {
  if (tab === "aktif") return t.isActive;
  if (tab === "pasif") return !t.isActive;
  return true;
}

const ASCII: Record<string, string> = {
  ç: "c",
  ş: "s",
  ğ: "g",
  ö: "o",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** foldTr, then without the Turkish marks: "bahce" and "BAHÇE" meet. */
function plain(s: string): string {
  return foldTr(s).replace(/[çşğöüâîû]/g, (c) => ASCII[c] ?? c);
}

/** The search box: the table's name (any spelling) or its code. */
export function matchesCafeTableSearch(
  t: Pick<CafeTable, "name" | "code">,
  query: string,
): boolean {
  const q = plain(query.trim());
  if (!q) return true;
  return plain(t.name).includes(q) || plain(t.code).includes(q);
}

function compare(a: CafeTable, b: CafeTable, sort: SortState): number {
  let d =
    sort.key === "ad"
      ? a.name.localeCompare(b.name, "tr")
      : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr");
  if (d === 0) d = a.id.localeCompare(b.id);
  return sort.dir === "asc" ? d : -d;
}

export interface CafeTableListResult {
  rows: CafeTable[];
  page: number;
  /** Rows in the current tab with the search applied. */
  total: number;
  counts: Record<CafeTableTab, number>;
}

/** One page of the Masalar list, and every tab's count, search applied. */
export function cafeTablesList(
  tables: readonly CafeTable[],
  opts: {
    tab: CafeTableTab;
    filters: FilterValues;
    sort: SortState;
    page: number;
    pageSize?: number;
  },
): CafeTableListResult {
  const size = opts.pageSize ?? CAFE_TABLE_PAGE_SIZE;
  const counts: Record<CafeTableTab, number> = { tumu: 0, aktif: 0, pasif: 0 };
  const shown: CafeTable[] = [];
  for (const t of tables) {
    if (opts.filters.q && !matchesCafeTableSearch(t, opts.filters.q)) continue;
    for (const { tab } of CAFE_TABLE_TABS) if (inTab(t, tab)) counts[tab] += 1;
    if (inTab(t, opts.tab)) shown.push(t);
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
