import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getShopHeroSlide } from "@/lib/admin/store";

import { deleteSlideAction, updateSlideAction } from "../actions";
import { SlideForm } from "../slide-form";

export const metadata = { title: "Admin · Vitrin slaytı düzenle" };
export const dynamic = "force-dynamic";

export default async function EditSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("shopHero");
  const slide = await getShopHeroSlide(id);
  if (!slide) notFound();

  const bound = updateSlideAction.bind(null, id);

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-4xl">
      <PageHeader
        title={slide.title || "Slayt düzenle"}
        description="Kaydettiğin değişiklik mağaza sayfasına hemen yansır."
        menuLabel="Slayt işlemleri"
        menu={
          <ConfirmButton
            action={deleteSlideAction}
            hidden={{ id: slide.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${slide.title || slide.id}`}
            variant="menuDanger"
            title={`"${slide.title || "Bu slayt"}" silinsin mi?`}
            description="Slayt mağaza sayfasının karuselinden hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için listedeki “Yayından kaldır”ı kullan."
          />
        }
      />
      <SlideForm
        defaults={{
          title: slide.title,
          subtitle: slide.subtitle,
          imageUrl: slide.imageUrl,
          ctaLabel: slide.ctaLabel,
          ctaHref: slide.ctaHref,
          textTheme: slide.textTheme,
          sortOrder: slide.sortOrder,
          isActive: slide.isActive,
        }}
        action={bound}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
