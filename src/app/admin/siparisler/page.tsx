import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import { OrdersList } from "@/components/admin/orders-list";
import { requireRole } from "@/lib/admin/auth";
import { listOrders, type AdminOrderStatus } from "@/lib/admin/store";

export const metadata = { title: "Admin · Siparişler" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<[AdminOrderStatus, string]> = [
  ["pending_payment", "Ödeme bekleniyor"],
  ["paid", "Ödendi"],
  ["preparing", "Hazırlanıyor"],
  ["shipped", "Kargoda"],
  ["completed", "Tamamlandı"],
  ["cancelled", "İptal"],
  ["refunded", "İade"],
];

const STATUS_TONE: Record<AdminOrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  preparing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-rose-50 text-rose-700",
};

export default async function AdminOrdersPage() {
  await requireRole("orders");
  const orders = await listOrders();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="E-ticaret"
        title="Siparişler"
        description="Birden fazla seçerek toplu durum güncellemesi yapabilir ya da elle yeni sipariş girebilirsin."
        action={
          <Link
            href="/admin/siparisler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni sipariş
          </Link>
        }
      />

      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Henüz sipariş yok.</p>
        </Card>
      ) : (
        <OrdersList
          orders={orders}
          statusOptions={STATUS_OPTIONS}
          statusTone={STATUS_TONE}
        />
      )}
    </main>
  );
}
