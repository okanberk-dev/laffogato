import Link from "next/link";

import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { getDashboardStats, listOrders } from "@/lib/admin/store";

export const metadata = { title: "Admin · Genel Bakış" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, orders] = await Promise.all([
    getDashboardStats(),
    listOrders(),
  ]);
  const recent = orders.slice(0, 5);

  const cards = [
    { label: "Toplam ürün", value: stats.productCount, hint: `${stats.activeProductCount} aktif` },
    { label: "Stok dışı", value: stats.outOfStockCount, hint: "Acil dolum" },
    { label: "Kategori", value: stats.categoryCount, hint: "Shop kategorileri" },
    { label: "Aktif sipariş", value: stats.pendingOrderCount, hint: `${stats.orderCount} toplam` },
    { label: "Ciro (demo)", value: formatTRY(stats.revenueMinor), hint: "Tamamlanan & hazırlanan" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Maltepe Park · 26 May"
        title="Günaydın, Eda."
        description="Bellek içi demo verisi. Supabase entegre edildikten sonra gerçek üretim verisini gösterecek."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-2">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {c.label}
            </div>
            <div
              className="text-3xl"
              style={{
                fontFamily: "var(--serif), 'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              {c.value}
            </div>
            <div className="text-xs text-neutral-500">{c.hint}</div>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="text-xl"
              style={{
                fontFamily: "var(--serif), 'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 500,
              }}
            >
              Son siparişler
            </h2>
            <Link
              href="/admin/siparisler"
              className="text-xs text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              Tümünü gör →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-500">Henüz sipariş yok.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-2">No</th>
                  <th>Müşteri</th>
                  <th>Durum</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t border-neutral-100">
                    <td
                      className="py-3 font-medium"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      #{o.orderNo}
                    </td>
                    <td>{o.customerName}</td>
                    <td>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-neutral-700">
                        {o.status}
                      </span>
                    </td>
                    <td
                      className="text-right"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatTRY(o.totalMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2
            className="mb-3 text-xl"
            style={{
              fontFamily: "var(--serif), 'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 500,
            }}
          >
            Hızlı erişim
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link
                href="/admin/urunler/yeni"
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 hover:border-neutral-900"
              >
                <span>+ Yeni ürün ekle</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/kategoriler/yeni"
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 hover:border-neutral-900"
              >
                <span>+ Yeni kategori</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/ayarlar"
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 hover:border-neutral-900"
              >
                <span>Kafe ayarları</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/siparisler"
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 hover:border-neutral-900"
              >
                <span>Siparişler</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
