import { Card, PageHeader } from "@/components/admin/forms";
import { OrdersList } from "@/components/admin/orders-list";
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
  const orders = await listOrders();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="E-ticaret"
        title="Siparişler"
        description="Demo siparişler. Birden fazla seçerek toplu durum güncellemesi yapabilirsin."
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
