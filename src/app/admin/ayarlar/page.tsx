import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getSettings } from "@/lib/admin/store";
import { emailHealth } from "@/lib/email/health";
import { hasServiceRole } from "@/lib/supabase/admin";

import { IdentityKeyStatus } from "./identity-status";
import { parseSettingsTab, SETTINGS_TAB_PARAM } from "./settings-core";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Admin · Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("settings");
  const [settings, mail, params] = await Promise.all([
    getSettings(),
    emailHealth(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Kafe yapılandırması"
        title="Ayarlar"
        description="Kafenin iletişim bilgileri, çalışma saatleri, KDV, kargo, karaoke, SEO ve e-posta ayarları. Her sekme kendi Kaydet düğmesiyle kaydedilir."
      />
      <IdentityKeyStatus hasKey={hasServiceRole()} />
      {/* ?sekme=email opens that tab: the dashboard's mail banner, the
          karaoke panel and the test mail link straight to theirs. */}
      <SettingsForm
        settings={settings}
        mail={mail}
        initialTab={parseSettingsTab(params[SETTINGS_TAB_PARAM])}
      />
    </main>
  );
}
