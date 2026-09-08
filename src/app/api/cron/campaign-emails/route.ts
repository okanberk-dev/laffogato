import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { resumePendingCampaigns } from "@/lib/email/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel cron (vercel.json → crons, daily 06:00 UTC = 09:00 İstanbul):
 * carries on every campaign the panel's `after()` runner could not finish
 * inside its own deadline — a big audience, a provider outage, a function
 * that was cut off.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` itself once the
 * variable exists; anyone else has to know the secret. The comparison is
 * constant-time, and an unset secret is a 503 rather than an open door.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

function authorized(request: Request): boolean | "unset" {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return "unset";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (auth === "unset") {
    return NextResponse.json(
      { error: "cron_secret_unset", message: "CRON_SECRET tanımlı değil." },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!auth) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
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
