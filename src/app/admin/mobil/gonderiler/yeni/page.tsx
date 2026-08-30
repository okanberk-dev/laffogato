import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createPostAction } from "../actions";
import { AppPostForm } from "../post-form";

export const metadata = { title: "Admin · Yeni gönderi" };
export const dynamic = "force-dynamic";

export default async function NewAppPostPage() {
  await requireRole("mobileApp");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Yeni gönderi"
        description="Kampanya, iş birliği ya da etkinlik kartı."
      />
      <AppPostForm action={createPostAction} submitLabel="Gönderiyi oluştur" />
    </main>
  );
}
