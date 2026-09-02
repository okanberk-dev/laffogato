import { notFound } from "next/navigation";

import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { ProductWizard } from "@/components/admin/product-wizard";
import { requireRole } from "@/lib/admin/auth";
import { getProduct, listCategories } from "@/lib/admin/store";

import { updateProductAction } from "../../actions";

export const metadata = { title: "Admin · Ürün Düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  await requireRole("products");
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={`SKU ${product.sku} · son güncelleme ${formatDateTime(product.updatedAt)}`}
        title={product.name}
        description="Tüm alanlar tek sayfada. Kaydedince /, /admin/urunler ve genel bakış tazelenir."
      />
      <ProductWizard
        product={product}
        categories={categories}
        action={boundUpdate}
        submitLabel="Değişiklikleri kaydet"
        mode="tabs"
      />
    </main>
  );
}
