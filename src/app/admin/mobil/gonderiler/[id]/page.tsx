import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getAppPost } from "@/lib/admin/store";

import { updatePostAction } from "../actions";
import { AppPostForm } from "../post-form";

export const metadata = { title: "Admin · Gönderiyi düzenle" };
export const dynamic = "force-dynamic";

export default async function EditAppPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("mobileApp");
  const { id } = await params;
  const row = await getAppPost(id);
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Gönderiyi düzenle"
        description={row.title}
      />
      <AppPostForm
        action={updatePostAction.bind(null, row.id)}
        defaults={row}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
