import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getAppSlide } from "@/lib/admin/store";

import { updateSlideAction } from "../actions";
import { AppSlideForm } from "../slide-form";

export const metadata = { title: "Admin · Slaytı düzenle" };
export const dynamic = "force-dynamic";

export default async function EditAppSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("mobileApp");
  const { id } = await params;
  const slide = await getAppSlide(id);
  if (!slide) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Slaytı düzenle"
        description={slide.title}
      />
      <AppSlideForm
        action={updateSlideAction.bind(null, slide.id)}
        defaults={slide}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
