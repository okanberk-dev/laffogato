import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { OrdersList, type OrderListRow } from "@/components/admin/orders-list";
import {
  BUTTON,
  FilterBar,
  Pagination,
  StatusTabs,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { pageCount, withParams } from "@/lib/admin/list-params";
import {
  mayExportOrders,
  orderActions,
  orderPaymentState,
} from "@/lib/admin/order-actions";
import { orderForClient } from "@/lib/admin/order-details";
import {
  OPEN_ORDER_STATUSES,
  ORDER_FILTER_FIELDS,
  ORDER_LIST_PAGE_SIZE,
  ORDER_LIST_PATH,
  ORDER_SORT_COLUMNS,
  ORDER_TABS,
  parseOrderListParams,
  withoutStatuses,
  type OrderSortKey,
} from "@/lib/admin/order-filters";
import { canAccess } from "@/lib/admin/roles";
import {
  countOrdersByStatus,
  listOrderMoney,
  listOrdersFiltered,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Siparişler" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The order list (Filament's table): status tabs with counts, a filter row,
 * sortable columns, numbered pages, a "⋯" menu per row and the bulk bar.
 * Everything is in the URL (lib/admin/order-filters.ts), so a filtered view
 * can be bookmarked and the back button works.
 *
 * WP1 still holds: one page of rows, never the table. The tab counts are
 * `head: true` counts with the other filters applied, side by side.
 */
export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const session = await requireRole("orders");
  const sp = await searchParams;
  const parsed = parseOrderListParams(sp);
  const [page, counts] = await Promise.all([
    listOrdersFiltered({
      query: parsed.query,
      sort: {
        column: ORDER_SORT_COLUMNS[parsed.sort.key as OrderSortKey],
        ascending: parsed.sort.dir === "asc",
      },
      page: parsed.page,
      pageSize: ORDER_LIST_PAGE_SIZE,
    }),
    countOrdersByStatus(withoutStatuses(parsed.query)),
  ]);
  // A page past the end (a stale link, the last order of page 3
  // cancelled away) goes to the last page: it said "Bu süzgece uyan sipariş
  // yok." while the pagination under it read "101-137 / 137" (ORD-25).
  const lastPage = pageCount(page.total, ORDER_LIST_PAGE_SIZE);
  if (parsed.page > lastPage) {
    redirect(
      withParams(
        sp,
        { sayfa: lastPage > 1 ? lastPage : null },
        ORDER_LIST_PATH,
      ),
    );
  }
  const money = await listOrderMoney(page.orders);

  const rows: OrderListRow[] = page.orders.map((order) => {
    const m = money.get(order.id) ?? {
      collected: Boolean(order.paidAt),
      collectedMinor: null,
      destination: "none" as const,
    };
    return {
      // No consent record: a client prop is in the page source (ORD-29).
      order: orderForClient(order),
      money: {
        collected: m.collected,
        collectedMinor: m.collectedMinor,
        destination: m.destination,
      },
      actions: orderActions(order, session.role, m.collected, m.collectedMinor),
      payment: orderPaymentState(order, m.collected),
      refundToken: randomUUID(),
    };
  });

  const all = Object.values(counts).reduce((s, n) => s + n, 0);
  const open = OPEN_ORDER_STATUSES.reduce((s, st) => s + counts[st], 0);
  const tabs = ORDER_TABS.map((t) => ({
    ...t,
    count:
      t.value === null
        ? all
        : t.value === "acik"
          ? open
          : counts[t.value as keyof typeof counts],
  }));

  // The way out of an empty list: the filters go (the tab stays), a tab
  // with nothing in it leads back to every order, and a shop with no
  // order yet offers the first one.
  const filtered = Object.keys(parsed.values).length > 0;
  const emptyAction = filtered
    ? {
        href: parsed.tab
          ? withParams({ durum: parsed.tab }, {}, ORDER_LIST_PATH)
          : ORDER_LIST_PATH,
        label: "Filtreleri temizle",
      }
    : parsed.narrowed
      ? { href: ORDER_LIST_PATH, label: "Tüm siparişler" }
      : { href: "/admin/siparisler/yeni", label: "+ Yeni sipariş" };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış"
        title="Siparişler"
        description="Ara, süz, sırala. Bir siparişin işlemleri satırın ⋯ menüsünde; birden fazlasını seçip toplu işlem yapabilirsin."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* A plain link: a prefetching <Link> would download the file. */}
            {mayExportOrders(session.role) ? (
              <a
                href={withParams(sp, { sayfa: null }, `${ORDER_LIST_PATH}/csv`)}
                download
                className={BUTTON.ghost}
              >
                CSV indir
              </a>
            ) : null}
            <Link
              href="/admin/siparisler/yeni"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
            >
              + Yeni sipariş
            </Link>
          </div>
        }
      />

      <StatusTabs
        tabs={tabs}
        current={parsed.tab}
        searchParams={sp}
        pathname={ORDER_LIST_PATH}
        label="Sipariş durumu"
      />

      <FilterBar
        fields={ORDER_FILTER_FIELDS}
        values={parsed.values}
        searchParams={sp}
        pathname={ORDER_LIST_PATH}
        label="Sipariş filtreleri"
      />

      {/* Keyed by the URL: a tab, filter, sort or page link starts a fresh
          selection. Next keeps a page's state across search-param changes,
          so three ticked open orders stayed selected on the "Tamamlandı"
          tab and "İptal et" cancelled orders no longer on screen (admin
          audit ORD-07). */}
      <OrdersList
        key={JSON.stringify(sp)}
        rows={rows}
        mayRefund={canAccess("refunds", session.role)}
        live={parsed.live}
        sort={parsed.sort}
        searchParams={sp}
        pathname={ORDER_LIST_PATH}
        emptyTitle={
          parsed.narrowed
            ? "Bu süzgece uyan sipariş yok."
            : "Henüz sipariş yok."
        }
        emptyAction={emptyAction}
      />

      <div className="mt-6">
        <Pagination
          page={parsed.page}
          pageSize={ORDER_LIST_PAGE_SIZE}
          total={page.total}
          searchParams={sp}
          pathname={ORDER_LIST_PATH}
          label="Sipariş sayfaları"
        />
      </div>
    </main>
  );
}
