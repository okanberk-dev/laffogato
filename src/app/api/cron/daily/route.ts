import { NextResponse } from "next/server";

import { resumePendingCampaigns } from "@/lib/email/campaigns";
import { destructionEnabled, runRetention } from "@/lib/retention";

import { cronGate, NO_STORE } from "../_auth";
import { runBirthdayGreetings } from "../_birthday";

/**
 * The day's scheduled work, in one request.
 *
 * **Why one route instead of three schedules.** Vercel's Hobby plan allows
 * two cron jobs, on daily schedules only. `vercel.json` asked for three, one
 * of them hourly, and Vercel answered by failing the DEPLOY - not the cron.
 * Production stopped moving on 16 Eyl 2026 and everything merged after that
 * sat in `main` unshipped, which is a far worse outcome than a campaign going
 * out a few hours late. So the three jobs became two routes: this one, and
 * the existing `/api/cron/campaign-emails` as a second pass.
 *
 * **The three original routes are untouched and still work.** They are
 * separately reachable, separately tested, and each carries its own gate;
 * this route only calls the same three library functions in order. On a plan
 * with real cron support, put the old three-entry `crons` array back in
 * `vercel.json` and delete nothing - the routes are all still there.
 *
 * **Order matters.** Campaigns first, because they are the only piece with a
 * deadline a member can notice; retention last, because it is the only piece
 * that deletes. A failure in one must not swallow the others, so each is
 * awaited inside its own try and reports its own outcome - a 200 here means
 * "the run happened", and the body says what each part did.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function step<T>(name: string, run: () => Promise<T>) {
  try {
    return { ok: true as const, ...(await run()) };
  } catch (err) {
    // The message, never the payload: these three touch birthdays, addresses
    // and auth keys, and an error object can carry the row that caused it.
    console.error(`[cron/daily] ${name}`, err);
    return { ok: false as const, error: "internal" };
  }
}

export async function GET(request: Request) {
  const denied = cronGate(request);
  if (denied) return denied;

  // 240 s of the 300 s budget, leaving the other two room to finish.
  const campaigns = await step("campaign-emails", async () => ({
    campaigns: await resumePendingCampaigns({ deadlineMs: 180_000 }),
  }));
  const birthday = await step("birthday", () => runBirthdayGreetings());
  const retention = await step("retention", () =>
    runRetention({ apply: destructionEnabled() }),
  );

  return NextResponse.json(
    { ok: true, campaigns, birthday, retention },
    { headers: NO_STORE },
  );
}
