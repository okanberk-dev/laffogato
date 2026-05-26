import Link from "next/link";

import { getAdminSession } from "@/lib/admin/auth";
import { canAccess, ROLE_LABELS, type AdminSection } from "@/lib/admin/roles";

import { logoutAction } from "./actions";

const NAV: Array<{ href: string; label: string; section: AdminSection }> = [
  { href: "/admin", label: "Genel bakış", section: "dashboard" },
  { href: "/admin/menu", label: "Menü", section: "menu" },
  { href: "/admin/urunler", label: "Ürünler", section: "products" },
  { href: "/admin/kategoriler", label: "Kategoriler", section: "categories" },
  { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
  { href: "/admin/musteriler", label: "Müşteriler", section: "customers" },
  { href: "/admin/promosyon", label: "Promosyon", section: "promos" },
  { href: "/admin/stok-hareketleri", label: "Stok", section: "stock" },
  { href: "/admin/raporlar", label: "Raporlar", section: "reports" },
  { href: "/admin/olay-kaydi", label: "Olay kaydı", section: "audit" },
  { href: "/admin/ayarlar", label: "Ayarlar", section: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  const visibleNav = session
    ? NAV.filter((n) => canAccess(n.section, session.role))
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span
              className="text-xl"
              style={{
                fontFamily: "var(--serif), 'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              L’Affogato
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Admin
            </span>
          </Link>

          {session && (
            <nav className="flex flex-wrap items-center gap-1 text-sm text-neutral-600">
              {visibleNav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-full px-3 py-1.5 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}

          {session ? (
            <div className="flex items-center gap-3">
              <span
                className="hidden text-[10px] uppercase tracking-[0.22em] text-neutral-500 sm:inline"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                {session.email} · {ROLE_LABELS[session.role]}
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                >
                  Çıkış
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/admin/giris"
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
            >
              Giriş
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-neutral-200 bg-white px-6 py-4">
        <div
          className="mx-auto flex max-w-7xl items-center justify-between text-[10px] uppercase tracking-[0.22em] text-neutral-400"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          <span>Maltepe Park · Yönetim Paneli</span>
          <span>Bellek-içi demo · Supabase entegrasyonu sonrası kalıcı olur</span>
        </div>
      </footer>
    </div>
  );
}
