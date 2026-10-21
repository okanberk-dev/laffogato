import Link from "next/link";

import { formatDateTime, PageHeader } from "@/components/admin/forms";
import {
  ActionMenuLink,
  Badge,
  BUTTON,
  CardLink,
  DataTable,
  EmptyListActionLink,
  EmptyState,
  FilterBar,
  NUMERIC_STYLE,
  PageShell,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { listCafeTables, type CafeTable } from "@/lib/admin/cafe-tables";
import {
  CAFE_TABLE_DEFAULT_SORT,
  CAFE_TABLE_FILTER_FIELDS,
  CAFE_TABLE_PAGE_SIZE,
  CAFE_TABLE_SORT_KEYS,
  CAFE_TABLE_TAB_PARAM,
  CAFE_TABLE_TABS,
  CAFE_TABLES_PATH,
  cafeTableHref,
  cafeTableNewHref,
  cafeTablePrintHref,
  cafeTablesList,
  parseCafeTableTab,
} from "@/lib/admin/cafe-tables-panel";
import { parseFilters, parsePage, parseSort } from "@/lib/admin/list-params";
import { listSearchView } from "@/lib/admin/list-search";

import { CafeTableRowMenu } from "./table-actions";

export const metadata = { title: "Admin · Masalar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function StatusBadge({ table }: { table: CafeTable }) {
  return (
    <Badge tone={table.isActive ? "success" : "neutral"} dot>
      {table.isActive ? "Aktif" : "Pasif"}
    </Badge>
  );
}

function Code({ table }: { table: CafeTable }) {
  return (
    <span
      className="text-xs text-[var(--admin-text-soft)]"
      style={NUMERIC_STYLE}
    >
      {table.code}
    </span>
  );
}

/**
 * The köşk's tables, Filament style: tabs with counts (Tümü, Aktif, Pasif),
 * a search box, a table (cards on phones) with a ⋯ menu per row, and a
 * page per table with its QR and every action. Nothing deletes: a table
 * leaves service by being deactivated, its code by being rotated.
 */
export default async function CafeTablesPage({ searchParams }: PageProps) {
  await requireRole("tables");
  // `sp` is the address (every link below), `view` adds the remembered
  // search text (what the list shows): lib/admin/list-search-core.ts.
  const { url: sp, view } = await listSearchView(
    CAFE_TABLES_PATH,
    (await searchParams) ?? {},
  );
  const tables = await listCafeTables();
  const filters = parseFilters(view, CAFE_TABLE_FILTER_FIELDS);
  const tab = parseCafeTableTab(view);
  const sort = parseSort(view, CAFE_TABLE_SORT_KEYS, CAFE_TABLE_DEFAULT_SORT);
  const list = cafeTablesList(tables, {
    tab,
    filters,
    sort,
    page: parsePage(view),
  });
  const active = tables.filter((t) => t.isActive).length;
  const tabValue = CAFE_TABLE_TABS.find((t) => t.tab === tab)?.value ?? null;
  // The way out of an empty tab: a filtered list clears its search (the tab
  // stays); an empty Aktif or Pasif tab leads back to all of them.
  const emptyAction =
    Object.keys(filters).length > 0
      ? {
          href: tabValue
            ? `${CAFE_TABLES_PATH}?${CAFE_TABLE_TAB_PARAM}=${tabValue}`
            : CAFE_TABLES_PATH,
          label: "Filtreyi temizle",
          clearsSearch: true,
        }
      : tabValue
        ? { href: CAFE_TABLES_PATH, label: "Tüm masalar" }
        : null;

  return (
    <PageShell width="list">
      <PageHeader
        title="Masalar"
        description="Her masanın QR kartı ve kodu."
        help={
          <p>
            Her masanın QR&apos;ı menüyü açar; uygulaması olan misafir
            siparişini o masaya verir. Ödeme her zaman sipariş verilirken
            uygulamada alınır.
          </p>
        }
        primary={{ href: cafeTableNewHref(), label: "Yeni masa" }}
        menu={
          <ActionMenuLink href={cafeTablePrintHref()}>
            Kartları yazdır ({active})
          </ActionMenuLink>
        }
      />

      {tables.length === 0 ? (
        <EmptyState
          title="Henüz masa yok."
          description="İlk masayı ekle, kartını yazdır ve masaya koy."
          action={
            <Link className={BUTTON.primary} href={cafeTableNewHref()}>
              Yeni masa
            </Link>
          }
        />
      ) : (
        <>
          <StatusTabs
            tabs={CAFE_TABLE_TABS.map((t) => ({
              value: t.value,
              label: t.label,
              count: list.counts[t.tab],
            }))}
            current={tabValue}
            searchParams={sp}
            pathname={CAFE_TABLES_PATH}
            param={CAFE_TABLE_TAB_PARAM}
            label="Masa sekmeleri"
          />

          <div className="mb-4">
            <FilterBar
              fields={CAFE_TABLE_FILTER_FIELDS}
              searchParams={sp}
              pathname={CAFE_TABLES_PATH}
              values={filters}
            />
          </div>

          <DataTable<CafeTable>
            caption="Masalar"
            rows={list.rows}
            rowKey={(t) => t.id}
            rowHref={(t) => cafeTableHref(t.id)}
            sort={sort}
            searchParams={sp}
            pathname={CAFE_TABLES_PATH}
            empty={
              <EmptyState
                title="Bu sekmede masa yok."
                action={
                  emptyAction ? (
                    <EmptyListActionLink
                      action={emptyAction}
                      className={BUTTON.ghost}
                    />
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "ad",
                header: "Masa",
                sortable: true,
                cell: (t) => t.name,
              },
              {
                key: "durum",
                header: "Durum",
                cell: (t) => <StatusBadge table={t} />,
              },
              {
                key: "kod",
                header: "Kod",
                cell: (t) => <Code table={t} />,
              },
              {
                key: "sira",
                header: "Sıra",
                sortable: true,
                align: "right",
                hideBelow: "lg",
                cell: (t) => <span style={NUMERIC_STYLE}>{t.sortOrder}</span>,
              },
              {
                key: "yenileme",
                header: "Kod yenilendi",
                hideBelow: "lg",
                cell: (t) =>
                  t.rotatedAt ? (
                    <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                      {formatDateTime(t.rotatedAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--admin-text-soft)]">
                      Yenilenmedi
                    </span>
                  ),
              },
            ]}
            rowActions={(t) => <CafeTableRowMenu table={t} />}
            mobileCard={(t) => (
              <div className="flex flex-col gap-1.5">
                <CardLink
                  href={cafeTableHref(t.id)}
                  className="font-medium text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                >
                  {t.name}
                </CardLink>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge table={t} />
                  <Code table={t} />
                </span>
              </div>
            )}
          />

          {list.total > CAFE_TABLE_PAGE_SIZE ? (
            <Pagination
              page={list.page}
              pageSize={CAFE_TABLE_PAGE_SIZE}
              total={list.total}
              searchParams={sp}
              pathname={CAFE_TABLES_PATH}
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}
