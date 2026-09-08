import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";

import { createPostAction } from "../actions";
import { AppPostForm } from "../post-form";

export const metadata = { title: "Admin · Yeni gönderi" };
export const dynamic = "force-dynamic";
// The save action may hand a campaign e-mail to `after()` (post hook); the
// runner keeps sending inside the route's max duration, stopping at 240 s.
export const maxDuration = 300;

export default async function NewAppPostPage() {
  await requireRole("mobileApp");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Yeni gönderi"
        description="Kampanya, iş birliği ya da etkinlik kartı."
      />
      <AppPostForm
        action={createPostAction}
        mode="create"
        submitLabel="Gönderiyi oluştur"
      />
    </main>
  );
}
