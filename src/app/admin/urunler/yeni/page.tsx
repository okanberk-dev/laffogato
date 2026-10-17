import { PageHeader } from "@/components/admin/forms";
import { ProductWizard } from "@/components/admin/product-wizard";
import { requireRole } from "@/lib/admin/auth";
import { getSettings, listCategories } from "@/lib/admin/store";

import { createProductAction } from "../actions";

export const metadata = { title: "Admin · Yeni Ürün" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireRole("products");
  const [categories, settings] = await Promise.all([
    listCategories(),
    getSettings(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Mağaza ürünleri"
        title="Yeni ürün"
        description="5 adımda yeni bir ürün: temel bilgi → fiyat & stok → varyantlar → görsel & SEO → özet."
      />
      <ProductWizard
        categories={categories}
        action={createProductAction}
        submitLabel="Ürünü kaydet"
        mode="wizard"
        taxRates={settings.taxRates}
      />
    </main>
  );
}
