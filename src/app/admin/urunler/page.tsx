import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ProductsList } from "@/components/admin/products-list";
import {
  ActionMenuLink,
  FilterBar,
  PageShell,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, parsePage, parseSort } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import {
  PRODUCT_DEFAULT_SORT,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORT_KEYS,
  PRODUCT_TAB_PARAM,
  PRODUCT_TABS,
  PRODUCTS_PATH,
  legacyProductsHref,
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
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    PRODUCTS_PATH,
    (await searchParams) ?? {},
  );
  // The dashboard's stock tiles and old bookmarks use the names from
  // before the kit (`?status=out_of_stock`, `?sort=stock_asc`).
  const legacy = legacyProductsHref(sp);
  if (legacy) redirect(legacy);
  const [products, categories] = await Promise.all([
    listProductsForPanel(),
    listCategories(),
  ]);
  const fields = productFilterFields(categories);
  const filters = parseFilters(view, fields);
  const tab = parseProductTab(view);
  const sort = parseSort(view, PRODUCT_SORT_KEYS, PRODUCT_DEFAULT_SORT);
  const list = productsList(products, {
    tab,
    filters,
    sort,
    page: parsePage(view),
  });
  const thumbs = await listProductThumbs(list.rows.map((p) => p.id));
  const rows = list.rows.map((p) => toProductListRow(p, thumbs[p.id]));
  const tabValue = PRODUCT_TABS.find((t) => t.tab === tab)?.value ?? null;
  const filtered = Object.keys(filters).length > 0;

  return (
    <PageShell width="list">
      <PageHeader
        title="Ürünler"
        description="Online mağazada satılan ürünler."
        help={
          <p>
            Yenisini 5 adımlı sihirbazla ekle, çok ürünü CSV ile içe aktar.
            Birden fazlasını seçince toplu işlem yaparsın.
          </p>
        }
        primary={{ href: `${PRODUCTS_PATH}/yeni`, label: "Yeni ürün" }}
        menu={
          <ActionMenuLink href={`${PRODUCTS_PATH}/ice-aktar`}>
            CSV ile içe aktar
          </ActionMenuLink>
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

      {/* Keyed by the address and the search: a new tab, filter, sort,
          page or search starts with nothing selected, so a bulk action
          never reaches rows that are no longer on screen. */}
      <ProductsList
        key={JSON.stringify(view)}
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
            ? { href: `${PRODUCTS_PATH}/yeni`, label: "Yeni ürün" }
            : filtered
              ? {
                  href: tabValue
                    ? `${PRODUCTS_PATH}?${PRODUCT_TAB_PARAM}=${tabValue}`
                    : PRODUCTS_PATH,
                  label: "Filtreyi temizle",
                  clearsSearch: true,
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
    </PageShell>
  );
}
