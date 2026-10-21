import { NextResponse } from "next/server";

import { recordShownLegalVersions } from "@/lib/legal/store";
import { destructionEnabled, runRetention } from "@/lib/retention";

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
 * before anything goes. See docs/DATABASE.md, "Periyodik imha".
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
    // The report counts rows; it never names one. Nothing here may log a key,
    // an address or an IP - `auth_attempts.key` is all three at once.
    console.info(
      `[cron/retention] ${report.applied ? "destroy" : "report"} matched=${report.totalMatched} destroyed=${report.totalDestroyed}`,
    );
    return NextResponse.json(report, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron/retention]", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500, headers: NO_STORE },
    );
  }
}
