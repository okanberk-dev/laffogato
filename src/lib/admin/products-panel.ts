// Client-safe (no server-only): how the Ürünler list reads its products. The
// page fetches (store.ts listProductsForPanel); the tabs, the search, the
// order and the page are decided here, so the list and the tests agree.

import type { AdminProductVariant, ProductPanelView } from "./store";
import {
  firstParam,
  pageCount,
  type FilterField,
  type FilterValues,
  type SearchParamsInput,
  type SortState,
} from "./list-params";
import { includesTr } from "./text-fold";

export const PRODUCTS_PATH = "/admin/urunler";

/** A product's view page (read-only, with every action). */
export function productHref(id: string): string {
  return `${PRODUCTS_PATH}/${encodeURIComponent(id)}`;
}

export function productEditHref(id: string): string {
  return `${productHref(id)}/duzenle`;
}

/** The product's page in the shop (only an active product has one). */
export function productShopHref(slug: string): string {
  return `/magaza/urun/${encodeURIComponent(slug)}`;
}

/** The product's moves on the Stok page. */
export function productStockMovesHref(id: string): string {
  return `/admin/stok-hareketleri?productId=${encodeURIComponent(id)}`;
}

export type ProductStockLevel = "out" | "low" | "ok";

/** Stokta yok (0), düşük (at or under the threshold) or fine. */
export function productStockLevel(
  p: Pick<ProductPanelView, "stock" | "lowStockThreshold">,
): ProductStockLevel {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.lowStockThreshold) return "low";
  return "ok";
}

/** What the list's client component gets for a variant: its stock, no SKU or price. */
export type ProductListVariant = Pick<
  AdminProductVariant,
  "id" | "name" | "stock" | "isActive"
>;

/**
 * One row of the list as the browser receives it. No photos (a served
 * thumbnail URL instead of the stored data URL), no cost, no description,
 * no SEO: every prop of a client component is written into the page's
 * source (admin audit CAT-07, CAT-08).
 */
export interface ProductListRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  tag: string;
  cat: string;
  priceMinor: number;
  compareAtPriceMinor: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  featured: boolean;
  isNew: boolean;
  variants: ProductListVariant[];
  /** The first photo's served URL, or null: the placeholder is drawn. */
  thumb: string | null;
  updatedAt: string;
}

export function toProductListRow(
  p: ProductPanelView,
  thumb: string | null | undefined,
): ProductListRow {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    tag: p.tag,
    cat: p.cat,
    priceMinor: p.priceMinor,
    compareAtPriceMinor: p.compareAtPriceMinor,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isActive: p.isActive,
    featured: p.featured,
    isNew: p.isNew,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      stock: v.stock,
      isActive: v.isActive,
    })),
    thumb: thumb || null,
    updatedAt: p.updatedAt,
  };
}

export type ProductTab = "tumu" | "aktif" | "pasif" | "dusuk" | "tukendi";

/** The URL param of the tabs; Tümü is the tab without it. */
export const PRODUCT_TAB_PARAM = "durum";

export const PRODUCT_TABS: ReadonlyArray<{
  tab: ProductTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "aktif", value: "aktif", label: "Aktif" },
  { tab: "pasif", value: "pasif", label: "Pasif" },
  { tab: "dusuk", value: "dusuk", label: "Düşük stok" },
  { tab: "tukendi", value: "tukendi", label: "Stokta yok" },
];

export function parseProductTab(sp: SearchParamsInput): ProductTab {
  const raw = firstParam(sp, PRODUCT_TAB_PARAM) ?? "";
  return PRODUCT_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

/** The search box and the category dropdown (the categories come from the panel). */
export function productFilterFields(
  categories: ReadonlyArray<{ slug: string; label: string }>,
): FilterField[] {
  return [
    {
      type: "search",
      name: "q",
      label: "Ara",
      placeholder: "Ad, SKU, slug ya da etiket",
    },
    {
      type: "select",
      name: "kategori",
      label: "Kategori",
      allLabel: "Tüm kategoriler",
      options: categories.map((c) => ({ value: c.slug, label: c.label })),
    },
  ];
}

export const PRODUCT_SORT_KEYS = ["ad", "fiyat", "stok", "guncel"] as const;
export const PRODUCT_DEFAULT_SORT: SortState = { key: "guncel", dir: "desc" };

export const PRODUCT_PAGE_SIZE = 50;

/**
 * The search box: the name, SKU, slug or label, Turkish-folded on both
 * sides ("italyan" finds "İtalyan", "irmak" finds "IRMAK", admin audit
 * CAT-19).
 */
export function matchesProductSearch(
  p: Pick<ProductPanelView, "name" | "sku" | "slug" | "tag">,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  return [p.name, p.sku, p.slug, p.tag].some((field) =>
    includesTr(field ?? "", q),
  );
}

function inTab(p: ProductPanelView, tab: ProductTab): boolean {
  switch (tab) {
    case "aktif":
      return p.isActive;
    case "pasif":
      return !p.isActive;
    case "dusuk":
      return productStockLevel(p) === "low";
    case "tukendi":
      return productStockLevel(p) === "out";
    default:
      return true;
  }
}

function compare(
  a: ProductPanelView,
  b: ProductPanelView,
  sort: SortState,
): number {
  let d: number;
  if (sort.key === "ad") d = a.name.localeCompare(b.name, "tr");
  else if (sort.key === "fiyat") d = a.priceMinor - b.priceMinor;
  else if (sort.key === "stok") d = a.stock - b.stock;
  else d = a.updatedAt.localeCompare(b.updatedAt);
  if (d === 0) d = a.id.localeCompare(b.id);
  return sort.dir === "asc" ? d : -d;
}

export interface ProductListResult {
  rows: ProductPanelView[];
  page: number;
  /** Rows in the current tab with the filters applied. */
  total: number;
  /** Every tab's count, with the search and the category applied. */
  counts: Record<ProductTab, number>;
}

/** One page of the Ürünler list, and every tab's count. */
export function productsList(
  products: readonly ProductPanelView[],
  opts: {
    tab: ProductTab;
    filters: FilterValues;
    sort: SortState;
    page: number;
    pageSize?: number;
  },
): ProductListResult {
  const size = opts.pageSize ?? PRODUCT_PAGE_SIZE;
  const counts: Record<ProductTab, number> = {
    tumu: 0,
    aktif: 0,
    pasif: 0,
    dusuk: 0,
    tukendi: 0,
  };
  const shown: ProductPanelView[] = [];
  for (const p of products) {
    if (opts.filters.q && !matchesProductSearch(p, opts.filters.q)) continue;
    if (opts.filters.kategori && p.cat !== opts.filters.kategori) continue;
    for (const { tab } of PRODUCT_TABS) if (inTab(p, tab)) counts[tab] += 1;
    if (inTab(p, opts.tab)) shown.push(p);
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
