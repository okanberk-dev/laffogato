import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ProductForm } from "@/components/admin/product-form";
import { getProduct, listCategories } from "@/lib/admin/store";

import { updateProductAction } from "../../actions";

export const metadata = { title: "Admin · Ürün Düzenle" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProduct(id),
    listCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const boundUpdate = updateProductAction.bind(null, product.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow={`Düzenle · ${product.id}`}
        title={product.name}
        description="Bu üründe yaptığın değişiklikler kaydedildiği anda Shop sayfasında görünür."
      />
      <ProductForm
        action={boundUpdate}
        product={product}
        categories={categories}
        submitLabel="Değişiklikleri kaydet"
        cancelHref="/admin/urunler"
      />
    </main>
  );
}
