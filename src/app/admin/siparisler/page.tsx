import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { listOrders, type AdminOrderStatus } from "@/lib/admin/store";

import { updateOrderStatusAction } from "./actions";

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
        description="Demo siparişler. Sanal POS entegre edildikten sonra burası gerçek webhook'larla beslenir."
      />

      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Henüz sipariş yok.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const statusLabel = STATUS_OPTIONS.find(([k]) => k === o.status)?.[1] ?? o.status;
            const tone = STATUS_TONE[o.status];
            return (
              <Card key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-lg font-medium"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        #{o.orderNo}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${tone}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-700">
                      {o.customerName}{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span className="text-neutral-500">{o.customerEmail}</span>
                    </div>
                    <div
                      className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-xl"
                      style={{
                        fontFamily: "var(--serif), 'Playfair Display', serif",
                        fontStyle: "italic",
                        fontWeight: 500,
                      }}
                    >
                      {formatTRY(o.totalMinor)}
                    </div>
                    <div
                      className="text-[10px] uppercase tracking-[0.18em] text-neutral-400"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {o.items.length} kalem
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <ul className="grid gap-1 text-sm text-neutral-700">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          {it.productName}{" "}
                          <span className="text-neutral-400">× {it.qty}</span>
                        </span>
                        <span style={{ fontFamily: "var(--mono), monospace" }}>
                          {formatTRY(it.unitPriceMinor * it.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <form
                  action={updateOrderStatusAction}
                  className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4"
                >
                  <input type="hidden" name="id" value={o.id} />
                  <label
                    className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    Durum güncelle
                  </label>
                  <select
                    name="status"
                    defaultValue={o.status}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
                  >
                    {STATUS_OPTIONS.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                  >
                    Kaydet
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
