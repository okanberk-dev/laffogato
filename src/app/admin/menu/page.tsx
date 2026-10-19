import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { MenuFoodInfoStatus } from "@/components/admin/menu-food-info-status";
import { MenuList } from "@/components/admin/menu-list";
import { BUTTON, FilterBar, StatusTabs } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";
import {
  MENU_PATH,
  MENU_TAB_PARAM,
  MENU_TABS,
  menuFilterFields,
  menuList,
  parseMenuTab,
  toMenuListRow,
} from "@/lib/admin/menu-panel";
import {
  getSettings,
  listMenuItems,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Kafe Menüsü" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FIELDS = menuFilterFields(
  MENU_CATEGORY_KEYS.map((key) => ({ key, label: MENU_CATEGORY_LABELS[key] })),
);

/**
 * The printed menu, category by category in its Sıra: tabs with counts
 * (Tümü, Satışta, Tükendi), a search box and a category, a one-click
 * "Tükendi" and a ⋯ menu per row, and the bulk bar. One page, no paging:
 * the counter reads it as the menu. The rows carry no photo (the list never
 * drew it, admin audit CAT-08).
 */
export default async function AdminMenuPage({ searchParams }: PageProps) {
  await requireRole("menu");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    MENU_PATH,
    (await searchParams) ?? {},
  );
  const [all, settings] = await Promise.all([listMenuItems(), getSettings()]);
  const items = all.map(toMenuListRow);
  const filters = parseFilters(view, FIELDS);
  const tab = parseMenuTab(view);
  const list = menuList(items, {
    tab,
    filters,
    categoryKeys: MENU_CATEGORY_KEYS,
  });
  const tabValue = MENU_TABS.find((t) => t.tab === tab)?.value ?? null;
  const filtered = Object.keys(filters).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Kafe menüsü"
        title="Kafe Menüsü"
        description="Basılı menünün tamamı - matcha bar, espresso, buzlu kahveler, soğuk/sıcak içecekler, frappe, smoothie, frozen, ice tea, tatlılar ve atıştırmalıklar. Birden fazla seçerek toplu işlem yapabilirsin."
        action={
          <Link
            href={`${MENU_PATH}/yeni`}
            className={`${BUTTON.primary} w-full sm:w-auto`}
          >
            + Yeni menü kalemi
          </Link>
        }
      />

      <MenuFoodInfoStatus
        items={all}
        priceDate={settings.menuPricesEffectiveDate}
      />

      <StatusTabs
        tabs={MENU_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: list.counts[t.tab],
        }))}
        current={tabValue}
        searchParams={sp}
        pathname={MENU_PATH}
        param={MENU_TAB_PARAM}
        label="Menü sekmeleri"
      />

      <FilterBar
        fields={FIELDS}
        searchParams={sp}
        pathname={MENU_PATH}
        values={filters}
        label="Menü süzgeci"
      />

      {/* Keyed by the address and the search: a new tab, filter or search
          starts with nothing selected, so a bulk action never reaches
          hidden rows. */}
      <MenuList
        key={JSON.stringify(view)}
        groups={list.groups}
        categoryKeys={[...MENU_CATEGORY_KEYS]}
        categoryLabels={MENU_CATEGORY_LABELS}
        emptyTitle={
          items.length === 0
            ? "Henüz menü kalemi yok."
            : filtered
              ? "Bu süzgece uyan kalem yok."
              : "Bu sekmede kalem yok."
        }
        emptyAction={
          items.length === 0
            ? { href: `${MENU_PATH}/yeni`, label: "+ Yeni menü kalemi" }
            : filtered
              ? {
                  href: tabValue
                    ? `${MENU_PATH}?${MENU_TAB_PARAM}=${tabValue}`
                    : MENU_PATH,
                  label: "Filtreleri temizle",
                  clearsSearch: true,
                }
              : null
        }
      />
    </main>
  );
}
