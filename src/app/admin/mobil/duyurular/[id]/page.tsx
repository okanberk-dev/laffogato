import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getAppAnnouncement } from "@/lib/admin/store";

import { updateAnnouncementAction } from "../actions";
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
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Duyuruyu düzenle"
        description={row.title}
      />
      <AppAnnouncementForm
        action={updateAnnouncementAction.bind(null, row.id)}
        defaults={row}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
