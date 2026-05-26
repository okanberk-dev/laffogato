import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { PromoForm } from "@/components/admin/promo-form";
import { getPromo } from "@/lib/admin/store";

import { updatePromoAction, type PromoActionState } from "../../actions";

export const metadata = { title: "Admin · Promosyon Düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPromoPage({ params }: PageProps) {
  const { id } = await params;
  const promo = await getPromo(id);
  if (!promo) notFound();

  const action = (prev: PromoActionState, formData: FormData) =>
    updatePromoAction(id, prev, formData);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow="Promosyon"
        title={`Kodu düzenle · ${promo.code}`}
        description={`${promo.usageCount} kez kullanıldı.`}
      />
      <PromoForm promo={promo} action={action} submitLabel="Kaydet" />
    </main>
  );
}
