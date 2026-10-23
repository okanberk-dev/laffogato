import { PageHeader } from "@/components/admin/forms";
import { PageShell } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { loadNeonUsage, neonLimit } from "@/lib/admin/neon-usage";
import {
  neonAlarm,
  neonUsageView,
  readNeonUsageFor,
} from "@/lib/admin/neon-usage-core";
import { getSettings } from "@/lib/admin/store";
import { loadSupabaseKeepalive } from "@/lib/admin/supabase-keepalive";
import {
  keepaliveView,
  readKeepaliveFor,
} from "@/lib/admin/supabase-keepalive-core";
import { dbHealth } from "@/lib/db";
import { emailHealth } from "@/lib/email/health";
import { panelLinkUrl } from "@/lib/panel/link-status";
import { hasServiceRole } from "@/lib/supabase/admin";

import { DatabaseSchemaStatus, NeonUsageStatus } from "./database-status";
import { IdentityKeyStatus } from "./identity-status";
import { PanelLinkStatus } from "./panel-link-status";
import { parseSettingsTab, SETTINGS_TAB_PARAM } from "./settings-core";
import { SettingsForm } from "./settings-form";
import { KeepaliveStatusRow, SystemStatus } from "./system-status";

export const metadata = { title: "Admin · Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("settings");
  const [settings, mail, params, keepalive, neon, database] = await Promise.all(
    [
      getSettings(),
      emailHealth(),
      searchParams,
      // The same gate as the dashboard's: the read is made for a role that
      // may see it, never merely hidden from one that may not.
      readKeepaliveFor(session.role, loadSupabaseKeepalive),
      // Neon's own API, never the database; off without its key.
      readNeonUsageFor(session.role, loadNeonUsage),
      // Whether the schema caught up with this deploy (/api/health's answer).
      dbHealth(),
    ],
  );
  const now = new Date();
  const hasKey = hasServiceRole();
  const ping = keepalive ? keepaliveView(keepalive, now) : null;
  const compute = neon ? neonUsageView(neon, neonLimit(), now) : null;
  const schemaFresh = database.db === "up" && database.schema === "fresh";
  // The köşk panel's address when the link is on; never the secret.
  const panelUrl = panelLinkUrl();

  return (
    <PageShell width="list">
      <PageHeader
        title="Ayarlar"
        description="Kafenin bilgileri, saatleri, KDV, kargo, karaoke ve e-posta ayarları."
        help={
          <p>
            Kafenin iletişim bilgileri, çalışma saatleri, KDV, kargo, karaoke,
            SEO ve e-posta ayarları. Her sekme kendi Kaydet düğmesiyle
            kaydedilir.
          </p>
        }
      />
      <SystemStatus
        attention={
          !hasKey ||
          !panelUrl ||
          ping?.tone === "warning" ||
          neonAlarm(compute) ||
          !schemaFresh
        }
      >
        <DatabaseSchemaStatus health={database} />
        {compute ? <NeonUsageStatus view={compute} /> : null}
        <IdentityKeyStatus hasKey={hasKey} />
        <PanelLinkStatus panelUrl={panelUrl} />
        {ping ? <KeepaliveStatusRow view={ping} /> : null}
      </SystemStatus>
      {/* ?sekme=email opens that tab: the dashboard's mail banner, the
          karaoke panel and the test mail link straight to theirs. */}
      <SettingsForm
        settings={settings}
        mail={mail}
        initialTab={parseSettingsTab(params[SETTINGS_TAB_PARAM])}
      />
    </PageShell>
  );
}
