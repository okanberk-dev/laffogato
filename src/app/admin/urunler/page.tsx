import Link from "next/link";

import { Card, PageHeader } from "@/components/admin/forms";
import { ProductsList } from "@/components/admin/products-list";
import { requireRole } from "@/lib/admin/auth";
import { listCategories, listProducts } from "@/lib/admin/store";

export const metadata = { title: "Admin · Ürünler" };
export const dynamic = "force-dynamic";

type Status = "all" | "active" | "inactive" | "low_stock" | "out_of_stock";
type SortKey =
  | "recent"
  | "name"
  | "price_asc"
  | "price_desc"
  | "stock_asc"
  | "stock_desc";

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
  await requireRole("products");
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
    list = list.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);

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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · La bottega"
        title="Ürünler"
        description="Online mağazada satılan ürünler. Yeni: 5 adımlı sihirbaz; düzenleme: tüm sekmeler tek formda. Birden fazla seç ⇒ toplu işlem."
        action={
          <Link
            href="/admin/urunler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni ürün
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Ürün adı, SKU, slug…"
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base outline-none focus:border-[var(--admin-primary)] focus:bg-white sm:col-span-2 sm:text-sm md:col-span-1"
          />
          <select
            name="cat"
            defaultValue={cat}
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
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
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
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
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base focus:border-[var(--admin-primary)] focus:bg-white focus:outline-none sm:text-sm"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 md:col-span-4">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {list.length} / {allProducts.length} ürün
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/urunler"
                className="inline-flex min-h-[40px] items-center rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
              >
                Sıfırla
              </Link>
              <button
                type="submit"
                className="inline-flex min-h-[40px] items-center rounded-xl bg-[var(--admin-primary)] px-4 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
              >
                Uygula
              </button>
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <ProductsList
          products={list}
          categories={categories}
          labelByCat={labelByCat}
        />
      </Card>
    </main>
  );
}
