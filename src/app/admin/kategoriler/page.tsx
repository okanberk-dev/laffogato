import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
  DataTable,
  EmptyState,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { categoryDeleteBlocker } from "@/lib/admin/category-schema";
import { listCategories, listProducts } from "@/lib/admin/store";

import { deleteCategoryAction } from "./actions";

export const metadata = { title: "Admin · Kategoriler" };
export const dynamic = "force-dynamic";

const MONO = { fontFamily: "var(--mono), monospace" } as const;

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
        eyebrow="Katalog · Kategoriler"
        title="Kategoriler"
        description="Mağaza filtre kenar çubuğundaki kategoriler ve sıralamaları. İçinde ürün olan kategori silinemez."
        action={
          <Link
            href="/admin/kategoriler/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni kategori
          </Link>
        }
      />

      <DataTable
        caption="Kategoriler"
        rows={categories}
        rowKey={(c) => c.id}
        rowHref={(c) => `/admin/kategoriler/${c.id}/duzenle`}
        empty={
          <EmptyState
            title="Henüz kategori yok."
            description="“+ Yeni kategori” ile ekle."
          />
        }
        columns={[
          {
            key: "label",
            header: "Etiket",
            cell: (c) => (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="text-lg">
                  {c.icon}
                </span>
                {c.label}
              </span>
            ),
          },
          {
            key: "slug",
            header: "Slug",
            cell: (c) => (
              <span className="text-xs" style={MONO}>
                {c.slug}
              </span>
            ),
          },
          {
            key: "products",
            header: "Ürün",
            align: "right",
            cell: (c) => (
              <span style={MONO}>{productCountBySlug[c.slug] ?? 0}</span>
            ),
          },
          {
            key: "sort",
            header: "Sıra",
            align: "right",
            cell: (c) => (
              <span style={MONO}>{String(c.sortOrder).padStart(2, "0")}</span>
            ),
          },
        ]}
        rowActions={(c) => {
          const blocker = categoryDeleteBlocker(c, categories, products);
          return (
            <ActionMenu label={`${c.label} işlemleri`}>
              <ActionMenuLink href={`/admin/kategoriler/${c.id}/duzenle`}>
                Düzenle
              </ActionMenuLink>
              <ActionMenuSeparator />
              <ConfirmButton
                action={deleteCategoryAction}
                hidden={{ id: c.id }}
                label="Sil"
                variant="menuDanger"
                title={`"${c.label}" silinsin mi?`}
                description="Kategori mağaza filtresinden kalkar. Bu işlem geri alınamaz."
                disabledReason={blocker ?? undefined}
              />
            </ActionMenu>
          );
        }}
      />
    </main>
  );
}
