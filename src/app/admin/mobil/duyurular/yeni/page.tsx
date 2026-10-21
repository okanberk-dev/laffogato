import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { BackLink } from "../../app-content-list";
import { createAnnouncementAction } from "../actions";
import { AppAnnouncementForm } from "../announcement-form";

export const metadata = { title: "Admin · Yeni duyuru" };
export const dynamic = "force-dynamic";

export default async function NewAppAnnouncementPage() {
  await requireRole("mobileApp");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href="/admin/mobil/duyurular" label="Duyurular" />
      <PageHeader
        title="Yeni duyuru"
        description="Ana sayfadaki kısa duyuru kartlarından biri."
      />
      <AppAnnouncementForm
        action={createAnnouncementAction}
        submitLabel="Duyuruyu oluştur"
      />
    </main>
  );
}
