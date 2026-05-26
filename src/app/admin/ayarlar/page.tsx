import { PageHeader } from "@/components/admin/forms";
import { getSettings } from "@/lib/admin/store";

import { SettingsForm } from "./settings-form";

export const metadata = { title: "Admin · Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Kafe yapılandırması"
        title="Ayarlar"
        description="Kafe iletişim bilgileri, çalışma saatleri ve mağaza durumu. Müşteri sitesindeki footer ve Visit sayfasını besler."
      />
      <SettingsForm settings={settings} />
    </main>
  );
}
