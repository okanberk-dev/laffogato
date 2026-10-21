import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  BUTTON,
  ConfirmButton,
  DataTable,
  EmptyState,
  PageShell,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { categoryDeleteBlocker } from "@/lib/admin/category-schema";
import { listCategories, listProductsForPanel } from "@/lib/admin/store";

import { deleteCategoryAction } from "./actions";

export const metadata = { title: "Admin · Kategoriler" };
export const dynamic = "force-dynamic";

const MONO = { fontFamily: "var(--mono), monospace" } as const;

export default async function AdminCategoriesPage() {
  await requireRole("categories");
  // Only what the counts need: listProducts() read every product's photos
  // (data URLs of up to 2 MB each) to count them (admin audit CAT-08).
  const [categories, products] = await Promise.all([
    listCategories(),
    listProductsForPanel(),
  ]);

  const productCountBySlug = products.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.cat] = (acc[p.cat] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <PageShell width="list">
      <PageHeader
        title="Kategoriler"
        description="Ürünlerin kategorileri, adları ve sıraları."
        help={
          <p>
            Adlar ve sıralar ürün formunda, ürün listesinde ve süzgeçlerinde
            görünür. Mağazadaki filtre çubuğu ve kategori sayfaları sabittir,
            buradaki değişiklik onları değiştirmez. İçinde ürün olan kategori
            silinemez.
          </p>
        }
        primary={{ href: "/admin/kategoriler/yeni", label: "Yeni kategori" }}
      />

      <DataTable
        caption="Kategoriler"
        rows={categories}
        rowKey={(c) => c.id}
        rowHref={(c) => `/admin/kategoriler/${c.id}/duzenle`}
        empty={
          <EmptyState
            title="Henüz kategori yok."
            action={
              <Link href="/admin/kategoriler/yeni" className={BUTTON.ghost}>
                Yeni kategori
              </Link>
            }
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
                ariaLabel={`Sil: ${c.label}`}
                variant="menuDanger"
                title={`"${c.label}" silinsin mi?`}
                description="Kategori paneldeki listelerden kalkar. Bu işlem geri alınamaz."
                disabledReason={blocker ?? undefined}
              />
            </ActionMenu>
          );
        }}
      />
    </PageShell>
  );
}
