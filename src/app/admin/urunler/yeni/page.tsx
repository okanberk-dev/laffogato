import { PageHeader } from "@/components/admin/forms";
import { ProductWizard } from "@/components/admin/product-wizard";
import { listCategories } from "@/lib/admin/store";

import { createProductAction } from "../actions";

export const metadata = { title: "Admin · Yeni Ürün" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Shop · La bottega"
        title="Yeni ürün"
        description="5 adımda yeni bir ürün: temel bilgi → fiyat & stok → varyantlar → görsel & SEO → özet."
      />
      <ProductWizard
        categories={categories}
        action={createProductAction}
        submitLabel="Ürünü kaydet"
        mode="wizard"
      />
    </main>
  );
}
