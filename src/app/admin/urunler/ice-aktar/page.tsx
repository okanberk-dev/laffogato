import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import { ProductImportForm } from "@/components/admin/product-import-form";
import { BUTTON } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";

export const metadata = { title: "Admin · Ürünleri içe aktar" };
export const dynamic = "force-dynamic";
// The import writes up to 500 rows one by one (a stock change is a few
// queries); the default limit is too short for a full file. It starts no
// row after PRODUCT_IMPORT_WRITE_BUDGET_MS (90 s) and reports the rest as
// not written, so the answer and the audit row fit inside this limit.
export const maxDuration = 120;

export default async function ProductImportPage() {
  await requireRole("products");
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5">
      <PageHeader
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
