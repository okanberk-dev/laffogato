import { PageHeader } from "@/components/admin/forms";
import { CategoryForm } from "@/components/admin/category-form";
import { requireRole } from "@/lib/admin/auth";

import { createCategoryAction } from "../actions";

export const metadata = { title: "Admin · Yeni Kategori" };

export default async function NewCategoryPage() {
  await requireRole("categories");
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · Tassonomia"
        title="Yeni kategori"
        description="Mağaza sidebar'ında görünecek yeni bir kategori ekle."
      />
      <CategoryForm
        action={createCategoryAction}
        submitLabel="Kategoriyi kaydet"
        cancelHref="/admin/kategoriler"
      />
    </main>
  );
}
