import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold">
            Laffogato Admin
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-600">
            <Link href="/admin/urunler" className="hover:text-neutral-900">
              Ürünler
            </Link>
            <Link href="/admin/kategoriler" className="hover:text-neutral-900">
              Kategoriler
            </Link>
            <Link href="/admin/siparisler" className="hover:text-neutral-900">
              Siparişler
            </Link>
            <Link href="/admin/ayarlar" className="hover:text-neutral-900">
              Ayarlar
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
