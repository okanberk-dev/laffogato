import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { hasAppLinks } from "@/lib/mobile/app-store";

import { createCampaignMailAction } from "../actions";
import { CampaignMailForm } from "../campaign-mail-form";

export const metadata = { title: "Admin · Yeni kampanya e-postası" };
export const dynamic = "force-dynamic";

export default async function NewCampaignMailPage() {
  await requireRole("newsletter");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama · Kampanya e-postası"
        title="Yeni kampanya"
        description="Önce taslak olarak kaydedilir; önizleme, test gönderimi ve asıl gönderim taslağın kendi sayfasındadır."
      />
      <CampaignMailForm
        action={createCampaignMailAction}
        submitLabel="Taslağı oluştur"
        appLinksReady={hasAppLinks()}
      />
    </main>
  );
}
