import { PageHeader } from "@/components/admin/forms";
import { ProductWizard } from "@/components/admin/product-wizard";
import { requireRole } from "@/lib/admin/auth";
import { getSettings, listCategories } from "@/lib/admin/store";

import { createProductAction } from "../actions";

export const metadata = { title: "Admin · Yeni ürün" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireRole("products");
  const [categories, settings] = await Promise.all([
    listCategories(),
    getSettings(),
  ]);

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5">
      <PageHeader
        title="Yeni ürün"
        description="Beş kısa adım; kaydetmeden önce özete bakarsın. Zorunlu olanlar yalnız ad, etiket, açıklama ve fiyat."
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
