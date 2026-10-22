import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getAppSlide } from "@/lib/admin/store";

import { BackLink, DELETE_TEXT } from "../../app-content-list";
import { deleteSlideAction, updateSlideAction } from "../actions";
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
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <BackLink href="/admin/mobil/slaytlar" label="Slaytlar" />
      <PageHeader
        title="Slaytı düzenle"
        description={slide.title}
        menuLabel="Slayt işlemleri"
        menu={
          // `then: list`: after the delete this page has nothing to show,
          // so the action answers with the list and its toast.
          <ConfirmButton
            action={deleteSlideAction}
            hidden={{ id: slide.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${slide.title}`}
            title={`"${slide.title}" silinsin mi?`}
            description={DELETE_TEXT.slide}
            variant="menuDanger"
          />
        }
      />
      <AppSlideForm
        action={updateSlideAction.bind(null, slide.id)}
        defaults={slide}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
