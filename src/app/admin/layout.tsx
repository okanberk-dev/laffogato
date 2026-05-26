import Link from "next/link";

import { getAdminSession } from "@/lib/admin/auth";

import { logoutAction } from "./actions";

const NAV: Array<[string, string]> = [
  ["/admin", "Genel bakış"],
  ["/admin/menu", "Menü"],
  ["/admin/urunler", "Ürünler"],
  ["/admin/kategoriler", "Kategoriler"],
  ["/admin/siparisler", "Siparişler"],
  ["/admin/musteriler", "Müşteriler"],
  ["/admin/promosyon", "Promosyon"],
  ["/admin/stok-hareketleri", "Stok"],
  ["/admin/raporlar", "Raporlar"],
  ["/admin/ayarlar", "Ayarlar"],
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

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
              {NAV.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-1.5 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {label}
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
                {session.email}
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
