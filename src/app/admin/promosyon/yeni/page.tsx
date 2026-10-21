import { BackLink } from "@/components/admin/back-link";
import { PageHeader } from "@/components/admin/forms";
import { PromoForm } from "@/components/admin/promo-form";
import { requireRole } from "@/lib/admin/auth";
import { PROMOS_PATH } from "@/lib/admin/promo-list";

import { createPromoAction } from "../actions";

export const metadata = { title: "Admin · Yeni Promosyon" };
export const dynamic = "force-dynamic";

export default async function NewPromoPage() {
  await requireRole("promos");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={PROMOS_PATH}>Promosyon kodları</BackLink>
      <PageHeader
        title="Yeni kod"
        description="Sepete uygulanacak yeni bir indirim kodu oluştur."
      />
      <PromoForm action={createPromoAction} submitLabel="Kodu oluştur" />
    </main>
  );
}
