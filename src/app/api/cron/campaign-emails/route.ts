import { NextResponse } from "next/server";

import { resumePendingCampaigns } from "@/lib/email/campaigns";

import { cronGate, NO_STORE } from "../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel cron (vercel.json → crons, hourly):
 *
 *   1. queues every campaign whose `scheduledAt` has come - this is what
 *      makes a special day (Anneler Günü, yılbaşı, 14 Şubat) possible without
 *      the operator standing at the panel that morning;
 *   2. carries on every campaign the panel's `after()` runner could not
 *      finish inside its own deadline - a big audience, a provider outage, a
 *      function that was cut off.
 *
 * Both live inside `resumePendingCampaigns`, so the two never race each
 * other: a campaign queued in step 1 is sent by step 2 in the same pass.
 *
 * The guard is `cronGate` (../_auth), shared with the birthday cron.
 */

export async function GET(request: Request) {
  const denied = cronGate(request);
  if (denied) return denied;
  try {
    const campaigns = await resumePendingCampaigns({ deadlineMs: 240_000 });
    return NextResponse.json({ ok: true, campaigns }, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron/campaign-emails]", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500, headers: NO_STORE },
    );
  }
}
