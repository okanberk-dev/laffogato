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
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-3xl">
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
