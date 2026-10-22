import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getHomeHeroSlide } from "@/lib/admin/home-hero";

import { deleteHomeSlideAction, updateHomeSlideAction } from "../actions";
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
  const name =
    [slide.titleLine1, slide.titleLine2].filter(Boolean).join(" ") || "";

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5">
      <PageHeader
        title={name || "Slayt düzenle"}
        description="Kaydettiğin değişiklik anasayfaya hemen yansır."
        menuLabel="Slayt işlemleri"
        menu={
          <ConfirmButton
            action={deleteHomeSlideAction}
            hidden={{ id: slide.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${name || slide.id}`}
            variant="menuDanger"
            title={`"${name || "Bu slayt"}" silinsin mi?`}
            description="Slayt anasayfadan hemen kalkar ve kalıcı olarak silinir. Bir süreliğine kaldırmak için listedeki “Yayından kaldır”ı kullan."
          />
        }
      />
      <HomeSlideForm
        action={bound}
        defaults={defaults}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
