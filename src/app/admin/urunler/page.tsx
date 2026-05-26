import Link from "next/link";

import {
  Card,
  DangerButton,
  PageHeader,
  formatTRY,
} from "@/components/admin/forms";
import { listCategories, listProducts } from "@/lib/admin/store";

import { deleteProductAction } from "./actions";

export const metadata = { title: "Admin · Ürünler" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ]);

  const labelByCat = Object.fromEntries(
    categories.map((c) => [c.slug, c.label] as const),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Shop · La bottega"
        title="Ürünler"
        description="Online mağazada satılan ürünler. Burada düzenlersen anında müşteri tarafında görünür."
        action={
          <Link
            href="/admin/urunler/yeni"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Yeni ürün
          </Link>
        }
      />

      <Card>
        {products.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz ürün yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">Ürün</th>
                  <th className="pr-3">Kategori</th>
                  <th className="pr-3 text-right">Fiyat</th>
                  <th className="pr-3 text-right">Stok</th>
                  <th className="pr-3">Durum</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-neutral-900">{p.name}</div>
                      <div
                        className="text-[10px] uppercase tracking-[0.2em] text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {p.tag}
                      </div>
                    </td>
                    <td className="pr-3 text-neutral-700">
                      {labelByCat[p.cat] ?? p.cat}
                    </td>
                    <td
                      className="pr-3 text-right"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatTRY(p.priceMinor)}
                    </td>
                    <td
                      className="pr-3 text-right"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      <span
                        className={
                          p.stock === 0
                            ? "text-red-600"
                            : p.stock < 5
                              ? "text-amber-700"
                              : "text-neutral-700"
                        }
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="pr-3">
                      <div className="flex flex-wrap gap-1">
                        {p.isActive ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-700">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                            Pasif
                          </span>
                        )}
                        {p.featured && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-700">
                            Öne çıkan
                          </span>
                        )}
                        {p.isNew && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-blue-700">
                            Yeni
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/urunler/${p.id}/duzenle`}
                          className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                        >
                          Düzenle
                        </Link>
                        <form action={deleteProductAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <DangerButton type="submit" className="text-xs">
                            Sil
                          </DangerButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
