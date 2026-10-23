import { PageHeader } from "@/components/admin/forms";
import { MenuFoodInfoStatus } from "@/components/admin/menu-food-info-status";
import { MenuList } from "@/components/admin/menu-list";
import {
  MenuQuickLook,
  QUICK_LOOK_CHANGES,
} from "@/components/admin/menu-quick-look";
import { FilterBar, PageShell, StatusTabs } from "@/components/admin/ui";
import { QuickLookOpener } from "@/components/admin/ui/quick-look";
import { listAuditLogs } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { imageVersion } from "@/lib/admin/image-bytes";
import { menuImagePath, servedImage } from "@/lib/admin/image-url";
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
  parseQuickLook,
  quickLookCloseHref,
  quickLookHref,
  withoutQuickLook,
} from "@/lib/admin/quick-look-core";
import { canAccess } from "@/lib/admin/roles";
import {
  getSettings,
  listMenuItems,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
  type AdminMenuItem,
} from "@/lib/admin/store";
import { menuItemTaxRate } from "@/lib/utils/kdv";

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
 *
 * A row opens its quick look (`?gor=<id>`, Innex's right drawer): photo,
 * the two states, allergens, the steps and, for the owner, its last
 * changes, over the list as it was.
 */
export default async function AdminMenuPage({ searchParams }: PageProps) {
  const session = await requireRole("menu");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts. The
  // drawer's `?gor=` is in neither: a tab link must not reopen it.
  const listed = await listSearchView(MENU_PATH, (await searchParams) ?? {});
  const lookId = parseQuickLook(listed.url);
  const sp = withoutQuickLook(listed.url);
  const view = withoutQuickLook(listed.view);
  const [all, settings] = await Promise.all([listMenuItems(), getSettings()]);
  const lookItem = lookId ? all.find((it) => it.id === lookId) : undefined;
  // The audit log is the owner's: a manager's drawer shows the last
  // change's time instead.
  const changes =
    lookItem && canAccess("audit", session.role)
      ? await listAuditLogs({
          entity: "menu_item",
          entityId: lookItem.id,
          limit: QUICK_LOOK_CHANGES,
        })
      : null;
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
    <PageShell width="list">
      <PageHeader
        title="Kafe menüsü"
        description="Kafede satılan içecek ve yiyecekler, fiyatları ve görünürlükleri."
        help={
          <p>
            Basılı menünün tamamı - matcha bar, espresso, buzlu kahveler,
            soğuk/sıcak içecekler, frappe, smoothie, frozen, ice tea, tatlılar
            ve atıştırmalıklar. Birden fazla seçerek toplu işlem yapabilirsin.
          </p>
        }
        primary={{ href: `${MENU_PATH}/yeni`, label: "Yeni menü kalemi" }}
      />

      <MenuFoodInfoStatus
        items={all}
        priceDate={settings.menuPricesEffectiveDate}
        pricesChangedAt={settings.menuPricesChangedAt}
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
        views={{ key: "menu", hold: lookItem !== undefined }}
      />

      {/* Keyed by the address and the search: a new tab, filter or search
          starts with nothing selected, so a bulk action never reaches
          hidden rows. */}
      <MenuList
        key={JSON.stringify(view)}
        groups={list.groups}
        searchParams={sp}
        // A category filter still shows that category whole.
        reorderable={tab === "tumu" && !filters.q}
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
            ? { href: `${MENU_PATH}/yeni`, label: "Yeni menü kalemi" }
            : filtered
              ? {
                  href: tabValue
                    ? `${MENU_PATH}?${MENU_TAB_PARAM}=${tabValue}`
                    : MENU_PATH,
                  label: "Filtreyi temizle",
                  clearsSearch: true,
                }
              : null
        }
      />

      <QuickLookOpener />
      {lookItem ? (
        <MenuQuickLook
          key={lookItem.id}
          item={lookItem}
          categoryLabel={
            MENU_CATEGORY_LABELS[lookItem.categoryKey] ?? lookItem.categoryKey
          }
          photo={menuPhoto(lookItem)}
          taxRate={menuItemTaxRate(lookItem, settings.taxRates)}
          changes={changes}
          closeHref={quickLookCloseHref(sp, MENU_PATH)}
          selfHref={quickLookHref(sp, MENU_PATH, lookItem.id)}
          now={new Date()}
        />
      ) : null}
    </PageShell>
  );
}

/** The item's photo as served (a stored upload by its path), or "". */
function menuPhoto(item: AdminMenuItem): string {
  if (!item.image) return "";
  return servedImage(
    item.image,
    menuImagePath(item.id, imageVersion(item.image)),
  );
}
