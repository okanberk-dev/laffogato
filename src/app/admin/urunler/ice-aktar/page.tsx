import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { ProductImportForm } from "@/components/admin/product-import-form";
import { BUTTON } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";

export const metadata = { title: "Admin · Ürünleri içe aktar" };
export const dynamic = "force-dynamic";
// The import writes up to 500 rows one by one (a stock change is a few
// queries); the default limit is too short for a full file.
export const maxDuration = 120;

export default async function ProductImportPage() {
  await requireRole("products");
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Katalog · Mağaza ürünleri"
        title="CSV ile içe aktar"
        description="Ürünleri bir tablodan toplu ekle ya da güncelle. Önce önizlersin; onaylamadan hiçbir şey yazılmaz."
        action={
          <Link
            href="/admin/urunler"
            className={`${BUTTON.ghost} w-full sm:w-auto`}
          >
            Ürünlere dön
          </Link>
        }
      />
      <ProductImportForm />
    </main>
  );
}
