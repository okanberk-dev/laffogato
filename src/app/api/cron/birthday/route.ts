import { NextResponse } from "next/server";

import { cronGate, NO_STORE } from "../_auth";
import { runBirthdayGreetings } from "../_birthday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel cron (vercel.json → crons, 06:00 UTC = 09:00 Tuzla): today's
 * birthdays - the coupon for everyone whose day it is, the celebration for
 * those who consented to commercial mail. `_birthday.ts` carries the trigger,
 * consent-class and idempotency notes.
 *
 * The guard is `cronGate` (../_auth): anyone who could reach this route could
 * otherwise make the site send commercial mail, so it answers only to
 * `Bearer <CRON_SECRET>` and an unset secret is a closed door.
 *
 * The response counts rows, never addresses.
 */

export async function GET(request: Request) {
  const denied = cronGate(request);
  if (denied) return denied;
  try {
    const result = await runBirthdayGreetings();
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron/birthday]", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500, headers: NO_STORE },
    );
  }
}
