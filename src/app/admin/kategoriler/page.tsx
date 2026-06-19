import Link from "next/link";

import { Card, DangerButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listCategories, listProducts } from "@/lib/admin/store";

import { deleteCategoryAction } from "./actions";

export const metadata = { title: "Admin · Kategoriler" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireRole("categories");
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts(),
  ]);

  const productCountBySlug = products.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.cat] = (acc[p.cat] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · Tassonomia"
        title="Kategoriler"
        description="Mağaza filtre kenar çubuğundaki kategoriler ve sıralamaları."
        action={
          <Link
            href="/admin/kategoriler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni kategori
          </Link>
        }
      />

      <Card>
        {/* Mobile cards */}
        <ul className="flex flex-col gap-3 md:hidden">
          {categories.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--admin-border)] p-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">
                        {c.label}
                      </div>
                      <div
                        className="text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {c.slug}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-xs text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {productCountBySlug[c.slug] ?? 0} ürün · sıra{" "}
                      {String(c.sortOrder).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/admin/kategoriler/${c.id}/duzenle`}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                    >
                      Düzenle
                    </Link>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <DangerButton type="submit" className="text-xs">
                        Sil
                      </DangerButton>
                    </form>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                <th className="py-3 pr-3">Sıra</th>
                <th className="pr-3">İkon</th>
                <th className="pr-3">Etiket</th>
                <th className="pr-3">Slug</th>
                <th className="pr-3 text-right">Ürün</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td
                    className="py-3 pr-3 text-neutral-500"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {String(c.sortOrder).padStart(2, "0")}
                  </td>
                  <td className="pr-3 text-xl">{c.icon}</td>
                  <td className="pr-3 font-medium text-neutral-900">
                    {c.label}
                  </td>
                  <td
                    className="pr-3 text-xs text-neutral-500"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {c.slug}
                  </td>
                  <td
                    className="pr-3 text-right"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {productCountBySlug[c.slug] ?? 0}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/kategoriler/${c.id}/duzenle`}
                        className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                      >
                        Düzenle
                      </Link>
                      <form action={deleteCategoryAction}>
                        <input type="hidden" name="id" value={c.id} />
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
      </Card>
    </main>
  );
}
