import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createSlideAction } from "../actions";
import { AppSlideForm } from "../slide-form";

export const metadata = { title: "Admin · Yeni slayt" };
export const dynamic = "force-dynamic";

export default async function NewAppSlidePage() {
  await requireRole("mobileApp");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Yeni slayt"
        description="Ana sayfadaki kayan kartlardan biri."
      />
      <AppSlideForm action={createSlideAction} submitLabel="Slaytı oluştur" />
    </main>
  );
}
