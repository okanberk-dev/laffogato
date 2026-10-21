import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { PageHeader } from "@/components/admin/forms";
import { PromoForm } from "@/components/admin/promo-form";
import { requireRole } from "@/lib/admin/auth";
import { promoHref } from "@/lib/admin/promo-list";
import { isPromoExpired } from "@/lib/admin/promo-schema";
import { getPromo } from "@/lib/admin/store";

import { updatePromoAction } from "../../actions";

export const metadata = { title: "Admin · Promosyon Düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPromoPage({ params }: PageProps) {
  await requireRole("promos");
  const { id } = await params;
  const promo = await getPromo(id);
  if (!promo) notFound();

  // A bound Server Action, not an arrow closure: a plain function cannot
  // cross into the client PromoForm, and the page died on every open.
  const action = updatePromoAction.bind(null, promo.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={promoHref(promo.id)}>{promo.code}</BackLink>
      <PageHeader
        title={`Kodu düzenle · ${promo.code}`}
        description={`${promo.usageCount} kez kullanıldı.`}
      />
      <PromoForm
        promo={promo}
        action={action}
        submitLabel="Kaydet"
        expired={isPromoExpired(promo.expiresAt)}
      />
    </main>
  );
}
