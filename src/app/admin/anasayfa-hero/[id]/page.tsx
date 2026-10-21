import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getHomeHeroSlide } from "@/lib/admin/home-hero";

import { updateHomeSlideAction } from "../actions";
import { HomeSlideForm } from "../slide-form";

export const metadata = { title: "Admin · Anasayfa slaytı düzenle" };
export const dynamic = "force-dynamic";

export default async function EditHomeSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("content");
  const slide = await getHomeHeroSlide(id);
  if (!slide) notFound();

  const { id: _id, createdAt: _c, updatedAt: _u, ...defaults } = slide;
  const bound = updateHomeSlideAction.bind(null, slide.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Anasayfa slaytları"
        title={
          [slide.titleLine1, slide.titleLine2].filter(Boolean).join(" ") ||
          "Slayt düzenle"
        }
        description="Kaydettiğin değişiklik anasayfaya hemen yansır."
      />
      <HomeSlideForm
        action={bound}
        defaults={defaults}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
