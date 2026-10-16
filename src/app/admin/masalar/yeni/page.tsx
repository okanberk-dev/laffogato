import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createCafeTableAction } from "../actions";
import { CafeTableForm } from "../table-form";

export const metadata = { title: "Admin · Yeni masa" };
export const dynamic = "force-dynamic";

export default async function NewCafeTablePage() {
  await requireRole("tables");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Masalar"
        title="Yeni masa"
        description="Masaya bir ad ver. QR kodu sunucu üretir; kaydettikten sonra listeden yazdırabilirsin."
      />
      <CafeTableForm action={createCafeTableAction} submitLabel="Masayı ekle" />
    </main>
  );
}
