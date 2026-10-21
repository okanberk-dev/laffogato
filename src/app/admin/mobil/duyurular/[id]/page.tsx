import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getAppAnnouncement } from "@/lib/admin/store";

import { BackLink, DELETE_TEXT } from "../../app-content-list";
import { deleteAnnouncementAction, updateAnnouncementAction } from "../actions";
import { AppAnnouncementForm } from "../announcement-form";

export const metadata = { title: "Admin · Duyuruyu düzenle" };
export const dynamic = "force-dynamic";

export default async function EditAppAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("mobileApp");
  const { id } = await params;
  const row = await getAppAnnouncement(id);
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href="/admin/mobil/duyurular" label="Duyurular" />
      <PageHeader
        title="Duyuruyu düzenle"
        description={row.title}
        menuLabel="Duyuru işlemleri"
        menu={
          // `then: list`: after the delete this page has nothing to show,
          // so the action answers with the list and its toast.
          <ConfirmButton
            action={deleteAnnouncementAction}
            hidden={{ id: row.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${row.title}`}
            title={`"${row.title}" silinsin mi?`}
            description={DELETE_TEXT.announcement}
            variant="menuDanger"
          />
        }
      />
      <AppAnnouncementForm
        action={updateAnnouncementAction.bind(null, row.id)}
        defaults={row}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
