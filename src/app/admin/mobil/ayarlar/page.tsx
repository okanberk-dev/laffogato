import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getSettings } from "@/lib/admin/store";

import { AppConfigForm } from "./app-config-form";

export const metadata = { title: "Admin · Uygulama ayarları" };
export const dynamic = "force-dynamic";

/**
 * Mobile app configuration (docs/API-MOBILE.md §10). Every section here lands
 * in `settings."mobileApp"` and reaches the app through `GET /bootstrap`,
 * which is cached for five minutes — hence the "en geç 5 dakika" promise on
 * the save message.
 */
export default async function AdminAppConfigPage() {
  await requireRole("mobileApp");
  const { mobileApp } = await getSettings();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Yapılandırma"
        title="Uygulama ayarları"
        description="Sürüm kapısı, bakım modu, sipariş kanalları, sadakat ekonomisi, karaoke kuralları, hatırlatmalar, kampanya kartları, köşk bilgileri ve mağaza bağlantıları. Uygulama bunları açılışta okur."
      />
      <AppConfigForm config={mobileApp} />
    </main>
  );
}
