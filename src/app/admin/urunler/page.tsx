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

type Status = "all" | "active" | "inactive" | "low_stock" | "out_of_stock";
type SortKey = "recent" | "name" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    status?: Status;
    sort?: SortKey;
  }>;
}

const STATUS_LABEL: Record<Status, string> = {
  all: "Tümü",
  active: "Aktif",
  inactive: "Pasif",
  low_stock: "Düşük stok",
  out_of_stock: "Stokta yok",
};

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Son güncellenen",
  name: "Ad (A→Z)",
  price_asc: "Fiyat (artan)",
  price_desc: "Fiyat (azalan)",
  stock_asc: "Stok (azdan çoka)",
  stock_desc: "Stok (çoktan aza)",
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const cat = (sp.cat ?? "all").trim();
  const status: Status = (sp.status ?? "all") as Status;
  const sort: SortKey = (sp.sort ?? "recent") as SortKey;

  const [allProducts, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ]);

  let list = allProducts;
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q),
    );
  }
  if (cat !== "all") {
    list = list.filter((p) => p.cat === cat);
  }
  if (status === "active") list = list.filter((p) => p.isActive);
  if (status === "inactive") list = list.filter((p) => !p.isActive);
  if (status === "out_of_stock") list = list.filter((p) => p.stock === 0);
  if (status === "low_stock")
    list = list.filter(
      (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
    );

  list = [...list].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "tr");
    if (sort === "price_asc") return a.priceMinor - b.priceMinor;
    if (sort === "price_desc") return b.priceMinor - a.priceMinor;
    if (sort === "stock_asc") return a.stock - b.stock;
    if (sort === "stock_desc") return b.stock - a.stock;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const labelByCat = Object.fromEntries(
    categories.map((c) => [c.slug, c.label] as const),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Shop · La bottega"
        title="Ürünler"
        description="Online mağazada satılan ürünler. Yeni: 5 adımlı sihirbaz; düzenleme: tüm sekmeler tek formda."
        action={
          <Link
            href="/admin/urunler/yeni"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Yeni ürün
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Ürün adı, SKU, slug veya etiket ile ara…"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white"
          />
          <select
            name="cat"
            defaultValue={cat}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
          >
            <option value="all">Kategori: hepsi</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
          >
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {list.length} / {allProducts.length} ürün
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/urunler"
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              >
                Sıfırla
              </Link>
              <button
                type="submit"
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Uygula
              </button>
            </div>
          </div>
        </form>
      </Card>

      <Card>
        {list.length === 0 ? (
          <p className="text-sm text-neutral-500">Bu filtreyle ürün yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">Ürün</th>
                  <th className="pr-3">SKU</th>
                  <th className="pr-3">Kategori</th>
                  <th className="pr-3 text-right">Fiyat</th>
                  <th className="pr-3 text-right">Stok</th>
                  <th className="pr-3">Durum</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const stockTone =
                    p.stock === 0
                      ? "text-red-600"
                      : p.stock <= p.lowStockThreshold
                        ? "text-amber-700"
                        : "text-neutral-700";
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-neutral-100 last:border-b-0 align-top"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-medium text-neutral-900">{p.name}</div>
                        <div
                          className="text-[10px] uppercase tracking-[0.2em] text-neutral-500"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.tag} {p.variants.length > 0 && `· ${p.variants.length} varyant`}
                        </div>
                      </td>
                      <td
                        className="pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {p.sku}
                      </td>
                      <td className="pr-3 text-neutral-700">
                        {labelByCat[p.cat] ?? p.cat}
                      </td>
                      <td
                        className="pr-3 text-right"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(p.priceMinor)}
                        {p.compareAtPriceMinor > p.priceMinor && (
                          <div className="text-[10px] text-neutral-400 line-through">
                            {formatTRY(p.compareAtPriceMinor)}
                          </div>
                        )}
                      </td>
                      <td
                        className={`pr-3 text-right ${stockTone}`}
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {p.stock}
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
                          {p.stock === 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-red-700">
                              Stoksuz
                            </span>
                          )}
                          {p.stock > 0 && p.stock <= p.lowStockThreshold && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-700">
                              Düşük stok
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
