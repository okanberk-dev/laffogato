import { randomUUID } from "node:crypto";

import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import {
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { OrderChannelBadges } from "@/components/admin/order-badges";
import { OrderHeaderActions } from "@/components/admin/order-actions-ui";
import { InvoiceCard } from "@/components/admin/invoice-card";
import { OrderDetail } from "@/components/admin/order-detail";
import { Badge, OrderStatusBadge, PageShell } from "@/components/admin/ui";
import { listOrderAuditLogs } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  attentionText,
  orderActions,
  orderPaymentState,
  refundableMinor,
} from "@/lib/admin/order-actions";
import { orderDetailsRules, orderForClient } from "@/lib/admin/order-details";
import { orderStatusLabel } from "@/lib/admin/order-ui";
import { orderTimeline } from "@/lib/admin/order-timeline";
import { canAccess } from "@/lib/admin/roles";
import { couponSourcesForOrders } from "@/lib/customer/coupons";
import { earsivConfigStatus, parasutAppUrl } from "@/lib/invoice/config";
import { invoiceDraftLines } from "@/lib/invoice/panel-core";
import { getInvoiceForSource } from "@/lib/invoice/store";
import {
  getOrder,
  getSettings,
  listOrderNotices,
  listPaymentTransactions,
  orderEmailLedgerHeld,
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

/**
 * A history that cannot be read must not take the order page with it, and
 * must not pass for an empty one either: an empty mail list read as "no
 * mail went out" and hid every "Yeniden gönder" (admin audit ORD-20). The
 * page says which read failed.
 */
async function readOrFlag<T>(
  work: Promise<T[]>,
  what: string,
): Promise<{ rows: T[]; failed: boolean }> {
  try {
    return { rows: await work, failed: false };
  } catch (err) {
    console.error(`[admin/siparisler] ${what} okunamadı`, err);
    return { rows: [], failed: true };
  }
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await requireRole("orders");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrder(id), getSettings()]);
  if (!order) notFound();
  const [payments, auditRead, noticeRead, couponRead, invoiceRead] =
    await Promise.all([
      listPaymentTransactions(order.id),
      readOrFlag(listOrderAuditLogs(order.id), "olay kaydı"),
      readOrFlag(listOrderNotices(order.id), "e-posta kaydı"),
      // Which coupon paid: a reward coupon is a payment, not a discount, and
      // the KDV table then shows the invoice's split (ASK-COUPON).
      readOrFlag(
        couponSourcesForOrders([order]).then((m) => {
          const source = m.get(order.orderNo);
          return source ? [source] : [];
        }),
        "kupon",
      ),
      // The e-Arşiv invoice (docs/EARSIV.md); a failed read says so on the
      // card instead of taking the order page with it.
      readOrFlag(
        getInvoiceForSource("order", order.id).then((r) => (r ? [r] : [])),
        "e-Arşiv fatura",
      ),
    ]);
  const audits = auditRead.rows;
  const notices = noticeRead.rows;
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
  // Stamps or a member coupon filed under the e-mail lock it (the store
  // refuses the move either way). A read that fails draws it locked too.
  const ledgerHeld =
    orderDetailsRules(order, session.role).emailEditable &&
    (await orderEmailLedgerHeld(order).catch((err) => {
      console.error("[admin/siparisler] damga ve kupon okunamadı", err);
      return true;
    }));

  return (
    <PageShell width="detail">
      <BackLink href="/admin/siparisler" className="print:hidden">
        Tüm siparişler
      </BackLink>

      <PageHeader
        className="print:hidden"
        meta={<span>Sipariş · {formatDateTime(order.createdAt)}</span>}
        title={`#${order.orderNo} ${order.customerName}`}
        badges={
          <>
            <OrderStatusBadge order={order} className="px-3 py-1" />
            {/* As the list and the dashboard draw it: a paid order said
                "Ödendi" twice, in two colours. */}
            {payment.label !== orderStatusLabel(order) ? (
              <Badge tone={payment.tone}>{payment.label}</Badge>
            ) : null}
            <OrderChannelBadges order={order} />
            {order.source === "manual" ? <Badge>Panelden</Badge> : null}
          </>
        }
        action={
          <OrderHeaderActions
            order={orderForClient(order)}
            money={money}
            actions={actions}
            refundToken={randomUUID()}
            mayRefund={canAccess("refunds", session.role)}
          />
        }
      />

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
          {/* "Dikkat işaretini kaldır" needs the refunds role: staff saw it
              disabled under an instruction to press it (ORD-26). */}
          <p className="mt-1 text-xs">
            {actions.clear_attention?.enabled
              ? 'Çözünce ⋯ menüsünden "Dikkat işaretini kaldır".'
              : "Çözülmesi için bir yöneticiye haber ver."}
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
        historyUnread={{ audit: auditRead.failed, mail: noticeRead.failed }}
        detailsRules={orderDetailsRules(order, session.role, ledgerHeld)}
        canSeeEvidence={canAccess("customers", session.role)}
        couponSource={couponRead.rows[0] ?? null}
        couponUnread={couponRead.failed}
      />

      {order.source !== "manual" ? (
        <div className="mt-4 print:hidden">
          <InvoiceCard
            row={invoiceRead.rows[0] ?? null}
            source={{ kind: "order", id: order.id, label: `#${order.orderNo}` }}
            mode={earsivConfigStatus(process.env).mode}
            canManage={canAccess("invoices", session.role)}
            unread={invoiceRead.failed}
            draftLines={
              invoiceRead.rows[0]?.status === "draft"
                ? invoiceDraftLines(invoiceRead.rows[0], { order })
                : null
            }
            buyerName={order.customerName}
            parasutUrl={parasutAppUrl(process.env)}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
