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
import { emailHealth } from "@/lib/email/health";

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
  const [stats, orders, settings, mail] = await Promise.all([
    getDashboardStats(),
    listOrders(),
    getSettings(),
    emailHealth(),
  ]);
  const recent = orders.slice(0, 5);

  const userLabel = session.email.split("@")[0];

  const cards = [
    {
      label: "Toplam ürün",
      value: String(stats.productCount),
      hint: `${stats.activeProductCount} aktif`,
    },
    {
      label: "Stok dışı",
      value: String(stats.outOfStockCount),
      hint: "Acil dolum",
    },
    {
      label: "Kategori",
      value: String(stats.categoryCount),
      hint: "Shop kategorileri",
    },
    {
      label: "Aktif sipariş",
      value: String(stats.pendingOrderCount),
      hint: `${stats.orderCount} toplam`,
    },
    {
      label: "Net ciro",
      value: formatTRY(stats.revenueMinor),
      hint: "Ödenen siparişler, iadeler düşülmüş",
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={`${settings.name} · ${todayLabel()}`}
        title={`${turkishGreeting()}, ${userLabel}.`}
        description="Canlı veritabanı - tüm değişiklikler anında siteye yansır."
      />

      {sp.denied && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          O sayfa için yetkin yok. Bu paneldeki yetkinle erişebileceğin bölümler
          nav&apos;da görünüyor.
        </div>
      )}

      {/*
        An unverified sending domain is not a degraded feature, it is a closed
        till: /odeme refuses an order from a member whose address is unverified,
        and the verification link is itself an e-mail. Nothing else on any
        screen would say so - the send paths swallow failures on purpose - so
        the one place it can surface is here, before anyone thinks to ask.
      */}
      {!mail.ok && mail.message && (
        <div className="mb-6 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <strong>E-posta gönderilemiyor.</strong> {mail.message}{" "}
          {canAccess("settings", session.role) && (
            <Link href="/admin/ayarlar" className="underline">
              Ayarlar → E-posta
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-2">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
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
              className="text-xs text-neutral-600 underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            >
              Tümünü gör →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-500">Henüz sipariş yok.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="flex flex-col gap-2 sm:hidden">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/siparisler/${o.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--admin-border)] p-3 hover:border-[var(--admin-primary)]"
                    >
                      <div className="min-w-0">
                        <div
                          className="font-medium text-neutral-900"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          #{o.orderNo}
                        </div>
                        <div className="truncate text-xs text-neutral-700">
                          {o.customerName}
                        </div>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${ORDER_STATUS_TONE[o.status]}`}
                        >
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </div>
                      <div
                        className="shrink-0 text-right text-sm text-neutral-900"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(o.totalMinor)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <table className="hidden w-full text-sm sm:table">
                <thead>
                  <tr
                    className="text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
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
                          className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] uppercase ${ORDER_STATUS_TONE[o.status]}`}
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
            </>
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
                  className="flex items-center justify-between rounded-md border border-[var(--admin-border)] px-3 py-2.5 hover:border-[var(--admin-primary)]"
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
