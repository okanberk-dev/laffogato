import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { ProductsList } from "@/components/admin/products-list";
import {
  BUTTON,
  FilterBar,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, parsePage, parseSort } from "@/lib/admin/list-params";
import {
  PRODUCT_DEFAULT_SORT,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORT_KEYS,
  PRODUCT_TAB_PARAM,
  PRODUCT_TABS,
  PRODUCTS_PATH,
  parseProductTab,
  productFilterFields,
  productsList,
  toProductListRow,
} from "@/lib/admin/products-panel";
import {
  listCategories,
  listProductsForPanel,
  listProductThumbs,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Ürünler" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The shop's products, Filament style: tabs with counts (Tümü, Aktif, Pasif,
 * Düşük stok, Stokta yok), a search box and a category, sortable headers, 50
 * per page, a ⋯ menu per row (Görüntüle, Düzenle, Mağazada gör, Aktif /
 * Pasif, Sil) and the bulk bar. The list's client component gets only what
 * it draws: a served thumbnail, never the stored photos, the cost or the
 * SEO fields (admin audit CAT-07, CAT-08, CAT-30).
 */
export default async function AdminProductsPage({ searchParams }: PageProps) {
  await requireRole("products");
  const sp = (await searchParams) ?? {};
  const [products, categories] = await Promise.all([
    listProductsForPanel(),
    listCategories(),
  ]);
  const fields = productFilterFields(categories);
  const filters = parseFilters(sp, fields);
  const tab = parseProductTab(sp);
  const sort = parseSort(sp, PRODUCT_SORT_KEYS, PRODUCT_DEFAULT_SORT);
  const list = productsList(products, {
    tab,
    filters,
    sort,
    page: parsePage(sp),
  });
  const thumbs = await listProductThumbs(list.rows.map((p) => p.id));
  const rows = list.rows.map((p) => toProductListRow(p, thumbs[p.id]));
  const tabValue = PRODUCT_TABS.find((t) => t.tab === tab)?.value ?? null;
  const filtered = Object.keys(filters).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Mağaza ürünleri"
        title="Ürünler"
        description="Online mağazada satılan ürünler. Yenisini 5 adımlı sihirbazla ekle, çok ürünü CSV ile içe aktar. Birden fazlasını seçince toplu işlem yaparsın."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`${PRODUCTS_PATH}/ice-aktar`}
              className={`${BUTTON.ghost} w-full sm:w-auto`}
            >
              CSV ile içe aktar
            </Link>
            <Link
              href={`${PRODUCTS_PATH}/yeni`}
              className={`${BUTTON.primary} w-full sm:w-auto`}
            >
              + Yeni ürün
            </Link>
          </div>
        }
      />

      <StatusTabs
        tabs={PRODUCT_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: list.counts[t.tab],
        }))}
        current={tabValue}
        searchParams={sp}
        pathname={PRODUCTS_PATH}
        param={PRODUCT_TAB_PARAM}
        label="Ürün sekmeleri"
      />

      <FilterBar
        fields={fields}
        searchParams={sp}
        pathname={PRODUCTS_PATH}
        values={filters}
        label="Ürün süzgeci"
      />

      {/* Keyed by the address: a new tab, filter, sort or page starts with
          nothing selected, so a bulk action never reaches rows that are no
          longer on screen. */}
      <ProductsList
        key={JSON.stringify(sp)}
        rows={rows}
        categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
        sort={sort}
        searchParams={sp}
        pathname={PRODUCTS_PATH}
        emptyTitle={
          products.length === 0
            ? "Henüz ürün yok."
            : filtered
              ? "Bu süzgece uyan ürün yok."
              : "Bu sekmede ürün yok."
        }
        emptyAction={
          products.length === 0
            ? { href: `${PRODUCTS_PATH}/yeni`, label: "+ Yeni ürün" }
            : filtered
              ? {
                  href: tabValue
                    ? `${PRODUCTS_PATH}?${PRODUCT_TAB_PARAM}=${tabValue}`
                    : PRODUCTS_PATH,
                  label: "Filtreleri temizle",
                }
              : null
        }
      />

      {list.total > PRODUCT_PAGE_SIZE ? (
        <Pagination
          page={list.page}
          pageSize={PRODUCT_PAGE_SIZE}
          total={list.total}
          searchParams={sp}
          pathname={PRODUCTS_PATH}
        />
      ) : null}
    </main>
  );
}
