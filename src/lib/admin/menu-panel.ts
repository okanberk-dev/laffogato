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

/** "Kopyala": the new item's form, filled from this one. */
const MENU_COPY_PARAM = "kopya";

export function menuItemCopyHref(id: string): string {
  return `${MENU_PATH}/yeni?${MENU_COPY_PARAM}=${encodeURIComponent(id)}`;
}

/** The longest name the form takes (menu-item-schema's limit). */
const MENU_NAME_MAX = 120;

/**
 * A copy's starting fields: everything the item has, under a name that says
 * it is a copy, and off the menu until the operator ticks "Menüde göster"
 * (a saved-as-is copy must not show "Latte (kopya)" to customers).
 */
export function menuItemCopy(item: AdminMenuItem): AdminMenuItem {
  return {
    ...item,
    name: `${item.name} (kopya)`.slice(0, MENU_NAME_MAX),
    isActive: false,
  };
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
   * there, empty ones too (their "Bu kategoriye ekle"); behind a tab, a
   * search or a category only those with a match.
   */
  groups: MenuGroup[];
  /** Items shown across the groups. */
  total: number;
  /** Every tab's count, with the search and the category applied. */
  counts: Record<MenuTab, number>;
}

/**
 * The order of a category's items as the list draws them: Sıra, then the
 * name, then the id. The ↑ / ↓ buttons move in this order (store.ts
 * moveMenuItem), so a tie of typed-in numbers cannot make a move a no-op.
 */
export function compareMenuRows(
  a: Pick<MenuListRow, "sortOrder" | "name" | "id">,
  b: Pick<MenuListRow, "sortOrder" | "name" | "id">,
): number {
  return (
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name, "tr") ||
    a.id.localeCompare(b.id)
  );
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
    const rows = (byKey.get(key) ?? []).sort(compareMenuRows);
    total += rows.length;
    if (rows.length > 0 || !filtered) groups.push({ key, rows });
  }
  return { groups, total, counts };
}

/** What the quick look reads from a menu item's audit row. */
export interface MenuAuditRow {
  action: string;
  payload: Record<string, unknown>;
}

/**
 * One line of a menu item's history in its quick look (the owner's only,
 * as the audit log is): what changed, in the menu's words. "Satışa açıldı",
 * "Tükendi işaretlendi", "Fiyat ₺215,00 · L ₺245,00", "Alerjenler
 * güncellendi", "Sırası değişti"; a save that changed none of those is
 * "Güncellendi". `money` formats a kuruş amount (formatTRY).
 */
export function menuAuditSummary(
  row: MenuAuditRow,
  money: (minor: number) => string,
): string {
  if (row.action === "create") return "Eklendi";
  if (row.action === "delete") return "Silindi";
  const p = row.payload ?? {};
  const parts: string[] = [];
  if (typeof p.isActive === "boolean") {
    parts.push(p.isActive ? "Satışa açıldı" : "Tükendi işaretlendi");
  }
  if (typeof p.priceMinor === "number") {
    const large =
      typeof p.priceMinorL === "number" && p.priceMinorL > 0
        ? ` · L ${money(p.priceMinorL)}`
        : "";
    parts.push(`Fiyat ${money(p.priceMinor)}${large}`);
  } else if (typeof p.priceMinorL === "number") {
    // The köşk's panel moves the L price on its own (review of #231).
    parts.push(
      p.priceMinorL > 0 ? `L fiyatı ${money(p.priceMinorL)}` : "L boyu kalktı",
    );
  }
  if ("allergens" in p) parts.push("Alerjenler güncellendi");
  if (typeof p.move === "string") parts.push("Sırası değişti");
  return parts.length > 0 ? parts.join(" · ") : "Güncellendi";
}
