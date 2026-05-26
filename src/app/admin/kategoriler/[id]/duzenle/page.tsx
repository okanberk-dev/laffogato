import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { CategoryForm } from "@/components/admin/category-form";
import { requireRole } from "@/lib/admin/auth";
import { getCategory } from "@/lib/admin/store";

import { updateCategoryAction } from "../../actions";

export const metadata = { title: "Admin · Kategori Düzenle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: PageProps) {
  await requireRole("categories");
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  const boundUpdate = updateCategoryAction.bind(null, category.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={`Düzenle · ${category.id}`}
        title={category.label}
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
