import { NextResponse } from "next/server";

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
 * Vercel cron (vercel.json → crons, daily 04:00 UTC = 07:00 İstanbul):
 * periodic destruction, as the published Veri Saklama ve İmha Politikası
 * undertakes. The policy names the last work week of June and December; a
 * daily sweep satisfies that without ever letting a category run past its
 * period, and the report is what gets filed for those two dates.
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
    const report = await runRetention({ apply: destructionEnabled() });
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
