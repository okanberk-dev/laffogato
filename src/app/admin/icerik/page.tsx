import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getSiteContent } from "@/lib/admin/site-content";

import { ContentForm } from "./content-form";

export const metadata = { title: "Admin · Site Metinleri" };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requireRole("content");
  const content = await getSiteContent();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Site metinleri"
        title="Site Metinleri"
        description="Ana sayfa ve hikaye bölümlerindeki düzenlenebilir başlık ve açıklamalar. Kaydettiğinde anında siteye yansır."
      />
      <ContentForm content={content} />
    </main>
  );
}
