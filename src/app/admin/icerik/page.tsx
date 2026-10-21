import { PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { getSiteContent } from "@/lib/admin/site-content";

import { ContentForm } from "./content-form";

export const metadata = { title: "Admin · Site Metinleri" };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requireRole("content");
  const content = await getSiteContent();

  return (
    <PageShell width="form">
      <PageHeader
        title="Site metinleri"
        description="Ana sayfa bandının ve Hikaye ekranlarının metinleri."
        help={
          <p>
            Ana sayfadaki tanıtım bandı ile Hikaye sayfasının ve uygulamanın
            Hikâye ekranının metinleri. Kaydettiğinde site hemen güncellenir;
            uygulama kopyasını günde bir yenilediği için yeni metni bir gün
            içinde gösterir. Her alanın altında nerede göründüğü yazar.
          </p>
        }
      />
      <ContentForm content={content} />
    </PageShell>
  );
}
