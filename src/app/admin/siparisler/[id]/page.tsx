import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderDetail } from "@/components/admin/order-detail";
import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import {
  availableTransitions,
  getOrder,
  getSettings,
  type AdminOrderStatus,
} from "@/lib/admin/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
};

const STATUS_TONE: Record<AdminOrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  preparing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-rose-50 text-rose-700",
};

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

  const transitions = availableTransitions(order.status);
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
        description={`${order.customerName} · ${STATUS_LABEL[order.status]}`}
        action={
          <Link
            href="/admin/siparisler"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--admin-border)] px-4 py-2 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            ← Tüm siparişler
          </Link>
        }
      />

      <OrderDetail
        order={order}
        settings={settings}
        transitions={transitions}
        statusLabel={STATUS_LABEL[order.status]}
        statusTone={STATUS_TONE[order.status]}
        refundedMinor={refundedMinor}
        remainingRefundableMinor={remainingRefundableMinor}
        canRefund={canAccess("refunds", session.role)}
      />
    </main>
  );
}
