import { Card, PageHeader } from "@/components/admin/forms";
import { CategoryForm } from "@/components/admin/category-form";
import { BUTTON } from "@/components/admin/ui";
import Link from "@/components/link";
import { requireRole } from "@/lib/admin/auth";
import { freeCategorySlugs } from "@/lib/admin/category-schema";
import { listCategories } from "@/lib/admin/store";

import { createCategoryAction } from "../actions";

export const metadata = { title: "Admin · Yeni kategori" };
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireRole("categories");
  // The five slugs are fixed: a new row can only take one no row has yet.
  // With all five in the list the form had nothing to offer but a twin.
  const free = freeCategorySlugs(await listCategories());
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5">
      <PageHeader
        title="Yeni kategori"
        description="Mağazanın beş sabit kategorisinden listede olmayanı panele ekle: ürün formunda ve listelerde görünecek adını ve sırasını sen verirsin."
      />
      {free.length === 0 ? (
        <Card className="grid max-w-2xl gap-4">
          <p className="text-sm text-[var(--admin-text-soft)]">
            Beş kategorinin hepsi listede; yenisi eklenemez. Bir kategorinin
            adını ya da sırasını değiştirmek için listeden onu düzenle.
          </p>
          <div>
            <Link href="/admin/kategoriler" className={BUTTON.ghost}>
              Kategorilere dön
            </Link>
          </div>
        </Card>
      ) : (
        <CategoryForm
          action={createCategoryAction}
          slugs={free}
          submitLabel="Kategoriyi kaydet"
          cancelHref="/admin/kategoriler"
        />
      )}
    </main>
  );
}
