import { PageHeader } from "@/components/admin/forms";
import { ProductForm } from "@/components/admin/product-form";
import { listCategories } from "@/lib/admin/store";

import { createProductAction } from "../actions";

export const metadata = { title: "Admin · Yeni Ürün" };

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Shop · La bottega"
        title="Yeni ürün"
        description="Stokta olan veya öncesi ön sipariş alacağın yeni bir ürün ekle."
      />
      <ProductForm
        action={createProductAction}
        categories={categories}
        submitLabel="Ürünü kaydet"
        cancelHref="/admin/urunler"
      />
    </main>
  );
}
