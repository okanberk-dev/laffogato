import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderChannelBadges } from "@/components/admin/order-badges";
import { OrderDetail } from "@/components/admin/order-detail";
import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { orderFulfillment } from "@/lib/admin/order-channel";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/order-ui";
import { canAccess } from "@/lib/admin/roles";
import {
  availableTransitions,
  getOrder,
  getSettings,
  orderWasCollected,
} from "@/lib/admin/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return { title: "Admin · Sipariş bulunamadı" };
  return { title: `Admin · Sipariş #${order.orderNo}` };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await requireRole("orders");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getSettings()]);
  if (!order) notFound();
  // The SAME rule refundRefusal applies (paidAt or a succeeded transaction):
  // a payment that landed after the sweep cancelled the order has no paidAt,
  // and it is exactly the money that must go back.
  const collected = await orderWasCollected(order);

  const transitions = availableTransitions(order.status);
  // A pickup order is "Hazır", a kurye order "Kuryede"; only a shop parcel
  // is actually in kargo (lib/admin/order-ui.ts).
  const statusLabel = orderStatusLabel(order);
  const refundedMinor = order.refunds.reduce((s, r) => s + r.amountMinor, 0);
  const remainingRefundableMinor = Math.max(
    0,
    order.totalMinor - refundedMinor,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow={`Sipariş · ${formatDateTime(order.createdAt)}`}
        title={`#${order.orderNo}`}
        description={`${order.customerName} · ${statusLabel}`}
        action={
          <Link
            href="/admin/siparisler"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--admin-border)] px-4 py-2 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            ← Tüm siparişler
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <OrderChannelBadges order={order} />
        {order.scheduledFor ? (
          <span
            className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Planlanan · {formatDateTime(order.scheduledFor)}
          </span>
        ) : null}
        {order.deliveryNote ? (
          <span className="text-xs text-neutral-600">
            {orderFulfillment(order) === "delivery" ? "Kurye notu" : "Not"}:{" "}
            {order.deliveryNote}
          </span>
        ) : null}
      </div>

      <OrderDetail
        order={order}
        settings={settings}
        transitions={transitions}
        statusLabel={statusLabel}
        statusTone={orderStatusTone(order)}
        refundedMinor={refundedMinor}
        remainingRefundableMinor={remainingRefundableMinor}
        canRefund={canAccess("refunds", session.role)}
        collected={collected}
      />
    </main>
  );
}
