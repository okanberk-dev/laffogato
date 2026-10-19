import Link from "next/link";

import { orderPaymentState } from "@/lib/admin/order-actions";
import { orderStatusLabel } from "@/lib/admin/order-ui";
import type { AdminOrder } from "@/lib/admin/store";

import { formatDateTime, formatTRY } from "../forms";
import { Badge, OrderStatusBadge } from "../ui/badge";
import { DataTable, type DataTableColumn } from "../ui/data-table";
import { EmptyState } from "../ui/detail";
import { NUMERIC_STYLE } from "../ui/styles";

/** An order and whether money was ever taken for it (`listOrderMoney`). */
export interface RecentOrderRow {
  order: AdminOrder;
  collected: boolean;
}

const COLUMNS: DataTableColumn<RecentOrderRow>[] = [
  {
    key: "no",
    header: "No",
    className: "whitespace-nowrap",
    cell: ({ order: o }) => (
      <span className="flex flex-col items-start gap-1">
        <span style={NUMERIC_STYLE}>#{o.orderNo}</span>
        {o.attention ? <Badge tone="danger">Dikkat</Badge> : null}
      </span>
    ),
  },
  {
    key: "musteri",
    header: "Müşteri",
    cell: ({ order: o }) => (
      <span className="flex max-w-[14rem] min-w-0 flex-col">
        <span className="truncate">{o.customerName || "İsimsiz"}</span>
        <span className="text-xs text-[var(--admin-text-soft)]">
          {formatDateTime(o.createdAt)}
        </span>
      </span>
    ),
  },
  {
    key: "durum",
    header: "Durum",
    cell: ({ order: o, collected }) => {
      // As the order list reads it: a payment that landed after the sweep
      // cancelled the order has no paidAt.
      const payment = orderPaymentState(o, collected);
      return (
        <span className="flex flex-col items-start gap-1">
          <OrderStatusBadge order={o} />
          {payment.label !== orderStatusLabel(o) ? (
            <Badge tone={payment.tone}>{payment.label}</Badge>
          ) : null}
        </span>
      );
    },
  },
  {
    key: "tutar",
    header: "Tutar",
    align: "right",
    className: "whitespace-nowrap",
    cell: ({ order: o }) => {
      const refunded = o.refunds.reduce((s, r) => s + r.amountMinor, 0);
      return (
        <span className="inline-flex flex-col items-end" style={NUMERIC_STYLE}>
          <span>{formatTRY(Math.max(0, o.totalMinor - refunded))}</span>
          {refunded > 0 ? (
            <span className="text-[11px] text-[var(--admin-danger-ink)]">
              {formatTRY(refunded)} iade
            </span>
          ) : null}
        </span>
      );
    },
  },
];

/**
 * The newest orders on the kit's list table (admin audit ORD-30): cards on
 * a phone, a table from md, the payment beside the status, the amount net
 * of refunds as the order list shows it. Server-safe.
 */
export function RecentOrders({ rows }: { rows: readonly RecentOrderRow[] }) {
  return (
    <section aria-labelledby="dashboard-recent-orders" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2
          id="dashboard-recent-orders"
          className="text-lg font-semibold text-[var(--admin-text)]"
        >
          Son siparişler
        </h2>
        <Link
          href="/admin/siparisler"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
        >
          Tümünü gör <span aria-hidden="true">→</span>
        </Link>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.order.id}
        rowHref={(r) => `/admin/siparisler/${r.order.id}`}
        caption="Son siparişler"
        empty={<EmptyState title="Henüz sipariş yok." />}
      />
    </section>
  );
}
