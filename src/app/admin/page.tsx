import Link from "next/link";

import { Card, PageHeader, formatTRY } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import {
  getDashboardStats,
  getSettings,
  listOrders,
  type AdminOrderStatus,
} from "@/lib/admin/store";

export const metadata = { title: "Admin · Genel Bakış" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ denied?: string }>;
}

const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
};

const ORDER_STATUS_TONE: Record<AdminOrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  paid: "bg-blue-50 text-blue-700",
  preparing: "bg-purple-50 text-purple-700",
  shipped: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  refunded: "bg-rose-50 text-rose-700",
};

function turkishGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date());
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await requireRole("dashboard");
  const sp = await searchParams;
  const [stats, orders, settings] = await Promise.all([
    getDashboardStats(),
    listOrders(),
    getSettings(),
  ]);
  const recent = orders.slice(0, 5);

  const userLabel = session.email.split("@")[0];

  const cards = [
    {
      label: "Toplam ürün",
      value: String(stats.productCount),
      hint: `${stats.activeProductCount} aktif`,
    },
    { label: "Stok dışı", value: String(stats.outOfStockCount), hint: "Acil dolum" },
    { label: "Kategori", value: String(stats.categoryCount), hint: "Shop kategorileri" },
    {
      label: "Aktif sipariş",
      value: String(stats.pendingOrderCount),
      hint: `${stats.orderCount} toplam`,
    },
    {
      label: "Ciro (demo)",
      value: formatTRY(stats.revenueMinor),
      hint: "Tamamlanan & hazırlanan",
    },
  ];

  const quickLinks: Array<{ href: string; label: string; show: boolean }> = [
    {
      href: "/admin/urunler/yeni",
      label: "+ Yeni ürün ekle",
      show: canAccess("products", session.role),
    },
    {
      href: "/admin/kategoriler/yeni",
      label: "+ Yeni kategori",
      show: canAccess("categories", session.role),
    },
    {
      href: "/admin/promosyon/yeni",
      label: "+ Yeni promosyon kodu",
      show: canAccess("promos", session.role),
    },
    {
      href: "/admin/siparisler",
      label: "Siparişler",
      show: canAccess("orders", session.role),
    },
    {
      href: "/admin/raporlar",
      label: "Raporlar",
      show: canAccess("reports", session.role),
    },
    {
      href: "/admin/ayarlar",
      label: "Kafe ayarları",
      show: canAccess("settings", session.role),
    },
    {
      href: "/admin/2fa-kurulum",
      label: "İki adımlı doğrulama",
      show: true,
    },
  ].filter((q) => q.show);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow={`${settings.name} · ${todayLabel()}`}
        title={`${turkishGreeting()}, ${userLabel}.`}
        description="Bellek içi demo verisi. Supabase entegre edildikten sonra gerçek üretim verisini gösterecek."
      />

      {sp.denied && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          O sayfa için yetkin yok. Bu paneldeki yetkinle erişebileceğin
          bölümler nav'da görünüyor.
        </div>
      )}

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
                      <Link
                        href={`/admin/siparisler/${o.id}`}
                        className="text-neutral-900 hover:underline"
                      >
                        #{o.orderNo}
                      </Link>
                    </td>
                    <td className="text-neutral-700">{o.customerName}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${ORDER_STATUS_TONE[o.status]}`}
                      >
                        {ORDER_STATUS_LABEL[o.status]}
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
            {quickLinks.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 hover:border-neutral-900"
                >
                  <span>{q.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
