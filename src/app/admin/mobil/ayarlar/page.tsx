import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getSettings } from "@/lib/admin/store";

import { APP_CONFIG_TAB_PARAM, parseAppConfigTab } from "./app-config-core";
import { AppConfigForm } from "./app-config-form";

export const metadata = { title: "Admin · Uygulama ayarları" };
export const dynamic = "force-dynamic";

/**
 * Mobile app configuration (docs/API-MOBILE.md §10). Every section here lands
 * in `settings."mobileApp"` and reaches the app through `GET /bootstrap`,
 * which is cached for five minutes - hence the "en geç 5 dakika" promise on
 * the save message. `?bolum=` opens one section (app-config-core.ts).
 */
export default async function AdminAppConfigPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("mobileApp");
  const [{ mobileApp }, sp] = await Promise.all([
    getSettings(),
    searchParams ?? Promise.resolve({}),
  ]);
  const initialTab = parseAppConfigTab(
    (sp as Record<string, unknown>)[APP_CONFIG_TAB_PARAM],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Mobil uygulama · Yapılandırma"
        title="Uygulama ayarları"
        description="Sürüm ve bakım, sipariş kanalları, sadakat, karaoke kuralları, hatırlatmalar, kampanya kartları, mutlu saatler, köşk bilgileri ve mağaza bağlantıları. Uygulama bunları açılışta okur."
      />
      <AppConfigForm config={mobileApp} initialTab={initialTab} />
    </main>
  );
}
