import { orderPaymentState } from "@/lib/admin/order-actions";
import { orderStatusLabel } from "@/lib/admin/order-ui";
import type { AdminOrder } from "@/lib/admin/store";

import { formatDateTime, formatTRY } from "../forms";
import { Badge, OrderStatusBadge } from "../ui/badge";
import { DataTable, type DataTableColumn } from "../ui/data-table";
import { EmptyState } from "../ui/detail";
import { CARD_TITLE, NUMERIC_STYLE } from "../ui/styles";
import { WidgetLink } from "./widget-card";

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
 * of refunds as the order list shows it. Innex's compact table: the title
 * and "Tümünü gör" inside the table's card. Server-safe.
 */
export function RecentOrders({ rows }: { rows: readonly RecentOrderRow[] }) {
  return (
    <section aria-label="Son siparişler" className="min-w-0">
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.order.id}
        rowHref={(r) => `/admin/siparisler/${r.order.id}`}
        caption="Son siparişler"
        heading={
          <>
            <h2 className={CARD_TITLE}>Son siparişler</h2>
            <WidgetLink href="/admin/siparisler">Tümünü gör</WidgetLink>
          </>
        }
        empty={<EmptyState title="Henüz sipariş yok." />}
      />
    </section>
  );
}
