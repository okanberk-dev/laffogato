import { BackLink } from "@/components/admin/back-link";
import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { CAFE_TABLES_PATH } from "@/lib/admin/cafe-tables-panel";

import { createCafeTableAction } from "../actions";
import { CafeTableForm } from "../table-form";

export const metadata = { title: "Admin · Yeni masa" };
export const dynamic = "force-dynamic";

export default async function NewCafeTablePage() {
  await requireRole("tables");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={CAFE_TABLES_PATH}>Masalar</BackLink>
      <PageHeader
        title="Yeni masa"
        description="Masaya bir ad ver. QR kodu sunucu üretir; kaydettikten sonra masanın sayfasından kartını yazdırabilirsin."
      />
      <CafeTableForm
        action={createCafeTableAction}
        submitLabel="Masayı ekle"
        back={CAFE_TABLES_PATH}
        saveAndNew
      />
    </main>
  );
}
