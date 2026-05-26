import { PageHeader } from "@/components/admin/forms";
import { PromoForm } from "@/components/admin/promo-form";
import { requireRole } from "@/lib/admin/auth";

import { createPromoAction } from "../actions";

export const metadata = { title: "Admin · Yeni Promosyon" };
export const dynamic = "force-dynamic";

export default async function NewPromoPage() {
  await requireRole("promos");
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow="Promosyon"
        title="Yeni kod"
        description="Sepete uygulanacak yeni bir indirim kodu oluştur."
      />
      <PromoForm action={createPromoAction} submitLabel="Kodu oluştur" />
    </main>
  );
}
