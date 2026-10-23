import {
  neonAdvice,
  neonSentence,
  type NeonUsageView,
} from "@/lib/admin/neon-usage-core";
import type { DbHealth } from "@/lib/db";

import { StatusRow } from "./system-status";

/**
 * Whether the schema caught up with this deploy: the apply path swallows
 * its own failures by design (src/lib/db/index.ts `dbHealth`), so a
 * migration that did not run left nothing but a log line and /api/health's
 * 503. A row of Sistem durumu (./system-status.tsx), which opens by itself
 * when the schema is behind. The page could not have drawn without the
 * database, so "down" is said only for completeness.
 */
export function DatabaseSchemaStatus({ health }: { health: DbHealth }) {
  if (health.db === "up" && health.schema === "fresh") {
    return (
      <StatusRow tone="success" testId="database-status" state="fresh">
        <strong className="font-medium text-[var(--admin-text)]">
          Veritabanı:
        </strong>{" "}
        bağlı, şema bu sürümle güncel.
      </StatusRow>
    );
  }
  return (
    <StatusRow tone="warning" testId="database-status" state={health.schema}>
      <strong className="font-medium text-[var(--admin-text)]">
        Veritabanı:
      </strong>{" "}
      {health.db === "up"
        ? "bağlı ama şema bu sürümün gerisinde: bekleyen bir migration uygulanamadı ve yeni alanlar çalışmayabilir."
        : "şu an yanıt vermiyor."}{" "}
      Geliştiriciye ilet: <code>/api/health</code> 503 döner, Vercel loglarında{" "}
      <code>[db-bootstrap]</code> satırı nedenini söyler.
    </StatusRow>
  );
}

/**
 * This billing period's Neon compute against the plan's monthly hours
 * (src/lib/admin/neon-usage-core.ts): the Free plan stops the database
 * when they run out, and nothing else on any screen says how close that
 * is. Off without `NEON_API_KEY` and `NEON_PROJECT_ID`, and then it says
 * how to turn it on; orange when a key is set and Neon does not answer.
 * The dashboard repeats it for a warning only.
 */
export function NeonUsageStatus({ view }: { view: NeonUsageView }) {
  const label = (
    <strong className="font-medium text-[var(--admin-text)]">
      Neon işlem süresi:
    </strong>
  );
  if (view.state === "off") {
    return (
      <StatusRow tone="neutral" testId="neon-usage-status" state="off">
        {label} bağlı değil. Vercel&apos;de <code>NEON_API_KEY</code> (yalnız bu
        projeye yetkili bir anahtar) ve <code>NEON_PROJECT_ID</code>{" "}
        tanımlanınca bu dönemin CU-saati ve bu hızla nerede biteceği burada
        görünür.
      </StatusRow>
    );
  }
  const advice = neonAdvice(view);
  return (
    <StatusRow tone={view.tone} testId="neon-usage-status" state={view.state}>
      {label} {neonSentence(view)}
      {advice ? <> {advice}</> : null}
    </StatusRow>
  );
}
