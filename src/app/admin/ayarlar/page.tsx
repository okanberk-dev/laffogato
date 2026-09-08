import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getSettings } from "@/lib/admin/store";
import { emailHealth } from "@/lib/email/health";

import { SettingsForm } from "./settings-form";

export const metadata = { title: "Admin · Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole("settings");
  const settings = await getSettings();
  const mail = await emailHealth();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Kafe yapılandırması"
        title="Ayarlar"
        description="Kafe iletişim bilgileri, çalışma saatleri ve mağaza durumu. Müşteri sitesindeki footer ve Visit sayfasını besler."
      />
      <SettingsForm settings={settings} mail={mail} />
    </main>
  );
}
