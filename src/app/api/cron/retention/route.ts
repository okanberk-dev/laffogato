import { NextResponse } from "next/server";

import { recordShownLegalVersions } from "@/lib/legal/store";
import {
  destructionEnabled,
  retentionLogLine,
  runRetention,
} from "@/lib/retention";

import { cronGate, NO_STORE } from "../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Periodic destruction, as the published Veri Saklama ve İmha Politikası
 * undertakes. The policy names the last work week of June and December; a
 * daily sweep satisfies that without ever letting a category run past its
 * period, and the report is what gets filed for those two dates.
 *
 * The daily cron runs it, as its last step (`/api/cron/daily`, vercel.json,
 * 06:00 UTC = 09:00 İstanbul); this route is the same sweep on its own,
 * behind the same `CRON_SECRET`, for reading the report by hand.
 *
 * REPORT MODE IS THE DEFAULT. Destruction is irreversible, so it happens only
 * when `RETENTION_APPLY=destroy` is set on the deployment; until then the run
 * answers with what it WOULD remove, per rule, so the numbers can be read
 * before anything goes, and records nothing. An applied run leaves one
 * `audit_logs` row (entity `retention`, counts only). See docs/DATABASE.md,
 * "Periyodik imha".
 */

export async function GET(request: Request) {
  const denied = cronGate(request);
  if (denied) return denied;

  try {
    // The texts shown today stay whatever their age (review R1); without
    // them that rule removes nothing.
    const shown = await recordShownLegalVersions().catch((err: unknown) => {
      console.error(
        "[cron/retention] legal versions",
        err instanceof Error ? err.message.slice(0, 160) : "unknown",
      );
      return null;
    });
    const report = await runRetention({
      apply: destructionEnabled(),
      keep: shown ? { "legal-doc-versions": shown.hashes } : {},
    });
    // The report counts rows; it never names one. The same line as the daily
    // run's (`retentionLogLine`), so one search finds every run.
    console.info(retentionLogLine(report));
    return NextResponse.json(report, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron/retention]", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500, headers: NO_STORE },
    );
  }
}
