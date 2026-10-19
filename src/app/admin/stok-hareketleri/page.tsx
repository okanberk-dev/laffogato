import Link from "next/link";

import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";
import {
  Badge,
  BUTTON,
  DataTable,
  EmptyState,
  FilterBar,
  NUMERIC_STYLE,
  Pagination,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import {
  firstParam,
  pageCount,
  parseFilters,
  parsePage,
} from "@/lib/admin/list-params";
import {
  STOCK_MOVES_PAGE_SIZE,
  STOCK_MOVES_PATH,
  STOCK_REASON_LABEL,
  STOCK_REASON_TONE,
  stockFilterFields,
  stockMoveQuery,
  stockProductOptions,
  toStockAdjustOption,
} from "@/lib/admin/stock-moves-panel";
import {
  countStockMoves,
  listProductsForPanel,
  listStockMoves,
  type AdminStockMove,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Stok Hareketleri" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Delta({ m }: { m: AdminStockMove }) {
  return (
    <span
      className={
        m.delta < 0
          ? "text-[var(--admin-danger-ink)]"
          : "text-[var(--admin-success)]"
      }
      style={NUMERIC_STYLE}
    >
      {m.delta > 0 ? "+" : ""}
      {m.delta}
    </span>
  );
}

/** "Siparişe git": a 44 px link (it was 10 px text, 16 px tall). */
function OrderLink({ m }: { m: AdminStockMove }) {
  if (!m.orderId) return null;
  return (
    <Link
      href={`/admin/siparisler/${encodeURIComponent(m.orderId)}`}
      className={`${BUTTON.link} text-xs whitespace-nowrap`}
    >
      Siparişe git
    </Link>
  );
}

/**
 * The stock ledger: the manual correction, then every move, newest first,
 * 100 per page with the total count, filtered by product, reason and day
 * (the köşk's calendar). It used to stop at the newest 500 moves without
 * saying so, with no way to an older one but the product filter (admin
 * audit CAT-16). Every product the page reads is cut to its name and stock
 * before it reaches a client component (CAT-07).
 */
export default async function StockMovesPage({ searchParams }: PageProps) {
  await requireRole("stock");
  const sp = (await searchParams) ?? {};
  const products = await listProductsForPanel();
  const fields = stockFilterFields(
    stockProductOptions(products, firstParam(sp, "productId")),
  );
  const filters = parseFilters(sp, fields);
  const query = stockMoveQuery(filters);
  const total = await countStockMoves(query);
  const page = Math.min(parsePage(sp), pageCount(total, STOCK_MOVES_PAGE_SIZE));
  const moves = await listStockMoves({
    ...query,
    limit: STOCK_MOVES_PAGE_SIZE,
    offset: (page - 1) * STOCK_MOVES_PAGE_SIZE,
  });
  const filtered = Object.keys(filters).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Stok"
        title="Stok Hareketleri"
        description="Her satış, iade veya manuel düzeltme bir hareket olarak kaydedilir. Burada denetim izini görürsün."
      />

      <div className="mb-6">
        <StockAdjustForm products={products.map(toStockAdjustOption)} />
      </div>

      <FilterBar
        fields={fields}
        searchParams={sp}
        pathname={STOCK_MOVES_PATH}
        values={filters}
        label="Stok hareketi süzgeci"
      />

      <p
        className="mb-3 text-sm text-[var(--admin-text-soft)]"
        aria-live="polite"
      >
        {filtered
          ? `Bu süzgece uyan ${total} hareket.`
          : `Toplam ${total} hareket.`}
      </p>

      <DataTable
        caption="Stok hareketleri"
        rows={moves}
        rowKey={(m) => m.id}
        empty={
          <EmptyState
            title={
              filtered
                ? "Bu süzgece uyan hareket yok."
                : "Henüz stok hareketi yok."
            }
            description="Yeni siparişler ve manuel düzeltmeler burada belirir."
          />
        }
        // The table fits its card beside the sidebar: at 1024 px the card
        // is about 720 px wide, so "Yeni stok", "Not" and "Kim" are columns
        // from xl and ride under the change, the reason and the time below
        // that.
        columns={[
          {
            key: "zaman",
            header: "Zaman",
            cell: (m) => (
              <span className="flex flex-col text-xs text-[var(--admin-text-soft)]">
                <span className="whitespace-nowrap">
                  {formatDateTime(m.createdAt)}
                </span>
                <span className="max-w-[10rem] break-all xl:hidden">
                  {m.actor}
                </span>
              </span>
            ),
          },
          {
            key: "urun",
            header: "Ürün",
            className: "min-w-[11rem]",
            cell: (m) => m.productName || m.productId,
          },
          {
            key: "degisim",
            header: "Değişim",
            align: "right",
            className: "whitespace-nowrap",
            cell: (m) => (
              <span className="flex flex-col items-end">
                <Delta m={m} />
                <span className="text-xs text-[var(--admin-text-soft)] xl:hidden">
                  Yeni stok <span style={NUMERIC_STYLE}>{m.stockAfter}</span>
                </span>
              </span>
            ),
          },
          {
            key: "yeni",
            header: "Yeni stok",
            align: "right",
            hideBelow: "xl",
            className: "whitespace-nowrap",
            cell: (m) => <span style={NUMERIC_STYLE}>{m.stockAfter}</span>,
          },
          {
            key: "sebep",
            header: "Sebep",
            cell: (m) => (
              <span className="flex max-w-xs flex-col items-start gap-1">
                <Badge tone={STOCK_REASON_TONE[m.reason] ?? "neutral"}>
                  {STOCK_REASON_LABEL[m.reason] ?? m.reason}
                </Badge>
                <span className="flex flex-col items-start text-xs text-[var(--admin-text-soft)] xl:hidden">
                  {m.note ? <span>{m.note}</span> : null}
                  <OrderLink m={m} />
                </span>
              </span>
            ),
          },
          {
            key: "not",
            header: "Not",
            hideBelow: "xl",
            className: "min-w-[9rem]",
            cell: (m) => (
              <span className="flex max-w-md flex-col items-start text-xs text-[var(--admin-text-soft)]">
                {m.note || !m.orderId ? <span>{m.note || "-"}</span> : null}
                <OrderLink m={m} />
              </span>
            ),
          },
          {
            key: "kim",
            header: "Kim",
            hideBelow: "xl",
            cell: (m) => (
              <span className="text-xs break-all text-[var(--admin-text-soft)]">
                {m.actor}
              </span>
            ),
          },
        ]}
        mobileCard={(m) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-[var(--admin-text)]">
                  {m.productName || m.productId}
                </div>
                <div className="mt-0.5 text-xs break-all text-[var(--admin-text-soft)]">
                  {formatDateTime(m.createdAt)} · {m.actor}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base">
                  <Delta m={m} />
                </div>
                <div className="text-xs text-[var(--admin-text-soft)]">
                  Yeni stok <span style={NUMERIC_STYLE}>{m.stockAfter}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STOCK_REASON_TONE[m.reason] ?? "neutral"}>
                {STOCK_REASON_LABEL[m.reason] ?? m.reason}
              </Badge>
              <OrderLink m={m} />
            </div>
            {m.note ? (
              <p className="text-xs text-[var(--admin-text-soft)]">{m.note}</p>
            ) : null}
          </div>
        )}
      />

      {total > STOCK_MOVES_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={STOCK_MOVES_PAGE_SIZE}
          total={total}
          searchParams={sp}
          pathname={STOCK_MOVES_PATH}
        />
      ) : null}
    </main>
  );
}
