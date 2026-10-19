// Client-safe (no server-only): how the Kafe menüsü list reads its items.
// The page fetches (store.ts listMenuItems); the tabs, the search and the
// grouping by category are decided here, so the list and the tests agree.

import type { AdminMenuItem, MenuCategoryKey } from "./store";
import {
  firstParam,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
} from "./list-params";
import { includesTr } from "./text-fold";

export const MENU_PATH = "/admin/menu";

/** A menu item's view page (read-only, with every action). */
export function menuItemHref(id: string): string {
  return `${MENU_PATH}/${encodeURIComponent(id)}`;
}

export function menuItemEditHref(id: string): string {
  return `${menuItemHref(id)}/duzenle`;
}

/**
 * The tags the app knows (`PRODUCT_TAG_VALUES`, docs/API-MOBILE.md §1), in
 * the panel's Turkish. The list showed the raw keys, upper-cased under
 * lang=tr as "SİGNATURE" (admin audit CAT-10).
 */
export const MENU_TAG_LABEL: Readonly<Record<string, string>> = {
  signature: "İmza",
  new: "Yeni",
  iced: "Buzlu",
  nuts: "Sert kabuklu yemiş",
};

/**
 * A stored tag as the list shows it. A word outside the four is shown as
 * written and marked: the app never shows it, and the next save of the
 * item drops it.
 */
export function menuTagChip(tag: string): { label: string; known: boolean } {
  const label = MENU_TAG_LABEL[tag];
  return label ? { label, known: true } : { label: tag, known: false };
}

/**
 * One row of the list as the browser receives it: no photo (the list never
 * drew it, and an upload is a data URL of up to 2 MB, admin audit CAT-08)
 * and no scene columns.
 */
export interface MenuListRow {
  id: string;
  categoryKey: MenuCategoryKey;
  name: string;
  desc: string;
  priceMinor: number;
  priceMinorL: number;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
}

export function toMenuListRow(item: AdminMenuItem): MenuListRow {
  return {
    id: item.id,
    categoryKey: item.categoryKey,
    name: item.name,
    desc: item.desc,
    priceMinor: item.priceMinor,
    priceMinorL: item.priceMinorL,
    tags: [...(item.tags ?? [])],
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  };
}

export type MenuTab = "tumu" | "satista" | "tukendi";

export const MENU_TAB_PARAM = "durum";

/** "Tükendi" is what the counter calls a hidden item (the row's one-click button). */
export const MENU_TABS: ReadonlyArray<{
  tab: MenuTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "satista", value: "satista", label: "Satışta" },
  { tab: "tukendi", value: "tukendi", label: "Tükendi" },
];

export function parseMenuTab(sp: SearchParamsInput): MenuTab {
  const raw = firstParam(sp, MENU_TAB_PARAM) ?? "";
  return MENU_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

export function menuFilterFields(
  categories: ReadonlyArray<{ key: MenuCategoryKey; label: string }>,
): FilterField[] {
  return [
    {
      type: "search",
      name: "q",
      label: "Ara",
      placeholder: "Kalem adı ya da açıklama",
    },
    {
      type: "select",
      name: "kategori",
      label: "Kategori",
      allLabel: "Tüm kategoriler",
      options: categories.map((c) => ({ value: c.key, label: c.label })),
    },
  ];
}

/** The search box: the name or the description, Turkish-folded. */
export function matchesMenuSearch(
  item: Pick<MenuListRow, "name" | "desc">,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  return includesTr(item.name, q) || includesTr(item.desc ?? "", q);
}

function inTab(item: Pick<MenuListRow, "isActive">, tab: MenuTab): boolean {
  if (tab === "satista") return item.isActive;
  if (tab === "tukendi") return !item.isActive;
  return true;
}

export interface MenuGroup {
  key: MenuCategoryKey;
  rows: MenuListRow[];
}

export interface MenuListResult {
  /**
   * The categories in menu order. With nothing filtered every category is
   * there, empty ones too (their "+ Bu kategoriye ekle"); behind a tab, a
   * search or a category only those with a match.
   */
  groups: MenuGroup[];
  /** Items shown across the groups. */
  total: number;
  /** Every tab's count, with the search and the category applied. */
  counts: Record<MenuTab, number>;
}

/** The Kafe menüsü list: items by category in their Sıra, and the tab counts. */
export function menuList(
  items: readonly MenuListRow[],
  opts: {
    tab: MenuTab;
    filters: FilterValues;
    categoryKeys: readonly MenuCategoryKey[];
  },
): MenuListResult {
  const counts: Record<MenuTab, number> = { tumu: 0, satista: 0, tukendi: 0 };
  const byKey = new Map<MenuCategoryKey, MenuListRow[]>(
    opts.categoryKeys.map((k) => [k, []]),
  );
  for (const item of items) {
    if (opts.filters.q && !matchesMenuSearch(item, opts.filters.q)) continue;
    if (opts.filters.kategori && item.categoryKey !== opts.filters.kategori) {
      continue;
    }
    for (const { tab } of MENU_TABS) if (inTab(item, tab)) counts[tab] += 1;
    if (inTab(item, opts.tab)) byKey.get(item.categoryKey)?.push(item);
  }
  const filtered =
    opts.tab !== "tumu" || Boolean(opts.filters.q || opts.filters.kategori);
  const groups: MenuGroup[] = [];
  let total = 0;
  for (const key of opts.categoryKeys) {
    const rows = (byKey.get(key) ?? []).sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "tr") ||
        a.id.localeCompare(b.id),
    );
    total += rows.length;
    if (rows.length > 0 || !filtered) groups.push({ key, rows });
  }
  return { groups, total, counts };
}
