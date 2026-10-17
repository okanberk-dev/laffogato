import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime, formatTRY } from "@/components/admin/forms";
import { OrderChannelBadges } from "@/components/admin/order-badges";
import { OrderHeaderActions } from "@/components/admin/order-actions-ui";
import { OrderDetail } from "@/components/admin/order-detail";
import { Badge, OrderStatusBadge } from "@/components/admin/ui";
import { listOrderAuditLogs } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  attentionText,
  orderActions,
  orderPaymentState,
  refundableMinor,
} from "@/lib/admin/order-actions";
import { orderTimeline } from "@/lib/admin/order-timeline";
import { canAccess } from "@/lib/admin/roles";
import {
  getOrder,
  getSettings,
  listOrderNotices,
  listPaymentTransactions,
  orderMoneyFromRows,
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

/** A history that cannot be read must not take the order page with it. */
async function orNothing<T>(work: Promise<T[]>, what: string): Promise<T[]> {
  try {
    return await work;
  } catch (err) {
    console.error(`[admin/siparisler] ${what} okunamadı`, err);
    return [];
  }
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await requireRole("orders");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getSettings()]);
  if (!order) notFound();
  const [payments, audits, notices] = await Promise.all([
    listPaymentTransactions(order.id),
    orNothing(listOrderAuditLogs(order.id), "olay kaydı"),
    orNothing(listOrderNotices(order.id), "e-posta kaydı"),
  ]);
  // The SAME money facts the server actions decide by (orderWasCollected:
  // paidAt or a succeeded payment row): a payment that landed after the
  // sweep cancelled the order has no paidAt, and it is exactly the money
  // that must go back.
  const m = orderMoneyFromRows(order, payments);
  const money = {
    collected: m.collected,
    collectedMinor: m.collectedMinor,
    destination: m.destination,
  };
  const actions = orderActions(
    order,
    session.role,
    m.collected,
    m.collectedMinor,
  );
  const payment = orderPaymentState(order, m.collected);
  const attention = attentionText(order.attention);
  const owed =
    order.status === "cancelled"
      ? refundableMinor(order, m.collected, m.collectedMinor)
      : 0;
  const customerHref =
    canAccess("customers", session.role) && order.customerEmail.includes("@")
      ? `/admin/musteriler/${encodeURIComponent(order.customerEmail)}`
      : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 print:hidden">
        <Link
          href="/admin/siparisler"
          className="text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
        >
          ← Tüm siparişler
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div
            className="mb-2 text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Sipariş · {formatDateTime(order.createdAt)}
          </div>
          <h1 className="text-2xl font-semibold text-[var(--admin-text)] sm:text-3xl">
            #{order.orderNo}{" "}
            <span className="text-base font-normal text-[var(--admin-text-soft)]">
              {order.customerName}
            </span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <OrderStatusBadge order={order} className="px-3 py-1" />
            <Badge tone={payment.tone}>{payment.label}</Badge>
            <OrderChannelBadges order={order} />
            {order.source === "manual" ? <Badge>Panelden</Badge> : null}
          </div>
        </div>
        <OrderHeaderActions
          order={order}
          money={money}
          actions={actions}
          refundToken={randomUUID()}
          mayRefund={canAccess("refunds", session.role)}
        />
      </header>

      {attention ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-[var(--admin-danger)]/40 bg-[var(--admin-danger-soft)] px-4 py-3 text-sm text-[var(--admin-danger-ink)] sm:px-6 print:hidden"
        >
          <p className="font-semibold">{attention.title}</p>
          <p className="mt-1">{attention.body}</p>
          {owed > 0 ? (
            <p className="mt-1">İade edilecek: {formatTRY(owed)}</p>
          ) : null}
          <p className="mt-1 text-xs">
            Çözünce ⋯ menüsünden &quot;Dikkat işaretini kaldır&quot;.
          </p>
        </div>
      ) : null}

      <OrderDetail
        order={order}
        settings={settings}
        money={money}
        actions={actions}
        payments={payments}
        timeline={orderTimeline(order, audits, notices)}
        notices={notices.filter((n) => n.kind !== "staff-new")}
        customerHref={customerHref}
      />
    </main>
  );
}
