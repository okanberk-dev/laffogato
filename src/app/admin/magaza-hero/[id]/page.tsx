import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getShopHeroSlide } from "@/lib/admin/store";

import { updateSlideAction } from "../actions";
import { SlideForm } from "../slide-form";

export const metadata = { title: "Slayt düzenle · Admin" };
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
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Shop · Hero slider"
        title={slide.title || "Slayt düzenle"}
        description="Mevcut slaytı güncelle. Görsel veya metni değiştirip kaydet."
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
