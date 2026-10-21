import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { CategoryForm } from "@/components/admin/category-form";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { categoryDeleteBlocker } from "@/lib/admin/category-schema";
import {
  getCategory,
  listCategories,
  listProductsForPanel,
} from "@/lib/admin/store";

import { deleteCategoryAction, updateCategoryAction } from "../../actions";

export const metadata = { title: "Admin · Kategori düzenle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: PageProps) {
  await requireRole("categories");
  const { id } = await params;
  const [category, categories, products] = await Promise.all([
    getCategory(id),
    listCategories(),
    listProductsForPanel(),
  ]);
  if (!category) notFound();

  const boundUpdate = updateCategoryAction.bind(null, category.id);
  // The list's rule: switched off, with its reason, while products use it.
  const blocker = categoryDeleteBlocker(category, categories, products);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Kategoriler"
        title={category.label}
        menuLabel={`${category.label} işlemleri`}
        menu={
          <ConfirmButton
            action={deleteCategoryAction}
            hidden={{ id: category.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${category.label}`}
            variant="menuDanger"
            title={`"${category.label}" silinsin mi?`}
            description="Kategori paneldeki listelerden kalkar. Bu işlem geri alınamaz."
            disabledReason={blocker ?? undefined}
          />
        }
      />
      <CategoryForm
        action={boundUpdate}
        category={category}
        submitLabel="Değişiklikleri kaydet"
        cancelHref="/admin/kategoriler"
      />
    </main>
  );
}
