import { PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
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
    <PageShell width="list">
      <PageHeader
        title="Ayarlar"
        description="Mobil uygulamanın sürüm, sipariş, sadakat ve karaoke ayarları."
        help={
          <p>
            Sürüm ve bakım, sipariş kanalları, sadakat, karaoke kuralları,
            hatırlatmalar, kampanya kartları, mutlu saatler, köşk bilgileri ve
            mağaza bağlantıları. Uygulama bunları açılışta okur.
          </p>
        }
      />
      <AppConfigForm config={mobileApp} initialTab={initialTab} />
    </PageShell>
  );
}
