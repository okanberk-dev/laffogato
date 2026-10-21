import { NextResponse } from "next/server";

import { resumePendingCampaigns } from "@/lib/email/campaigns";
import { recordShownLegalVersions } from "@/lib/legal/store";
import { expireUnpaidReservations } from "@/lib/mobile/karaoke-payment";
import {
  destructionEnabled,
  retentionLogLine,
  runRetention,
} from "@/lib/retention";
import { keepSupabaseAwake } from "@/lib/supabase/admin";

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
 * **The Supabase ping has no route of its own.** A free-plan Supabase project
 * pauses after 7 days without database activity, and a paused project is
 * nobody signing in to the app. On Supabase Pro, drop the step.
 *
 * **Order matters.** The ping first: it is over in well under a second (5 s at
 * worst), and its whole point is that it runs at all. Campaigns next, because
 * they are the only piece with a deadline a member can notice; retention last,
 * because it is the only piece that deletes. A failure in one must not
 * swallow the others, so each is awaited inside its own try and reports its
 * own outcome - a 200 here means "the run happened", and the body says what
 * each part did.
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

  // One read on Supabase's auth schema, so the project never pauses for
  // inactivity. Never throws; `ping` says whether it got through.
  const keepalive = await step("supabase-keepalive", async () => ({
    ping: await keepSupabaseAwake(),
  }));
  // 240 s of the 300 s budget, leaving the other two room to finish.
  const campaigns = await step("campaign-emails", async () => ({
    campaigns: await resumePendingCampaigns({ deadlineMs: 180_000 }),
  }));
  const birthday = await step("birthday", () => runBirthdayGreetings());
  // Karaoke holds nobody paid: each asked about at the POS first, and only a
  // "no payment" (or a day of not being able to ask) frees the hour
  // (CLAUDE.md rule 29). Bookings run it too; this catches a quiet day.
  const karaoke = await step("karaoke-holds", async () => ({
    expired: await expireUnpaidReservations(),
  }));
  // Every legal text as shown today, stored once per hash (decision
  // D-VERSIONS-TABLE): a coded text no consent reads (KVKK, the İşlem
  // Rehberi) is kept within a day of the deploy that changed it. Before
  // retention, the one step that deletes.
  //
  // Retention keeps every text shown today whatever its age (review R1); a
  // step that could not say which those are leaves the rule removing
  // nothing. The response carries the count, not the hashes.
  const shown: { hashes?: string[] } = {};
  const legalVersions = await step("legal-versions", async () => {
    const { documents, hashes } = await recordShownLegalVersions();
    shown.hashes = hashes;
    return { documents };
  });
  // An applied run leaves its own destruction record in audit_logs
  // (runRetention); the line below is the same one /api/cron/retention logs,
  // counts only.
  const retention = await step("retention", async () => {
    const report = await runRetention({
      apply: destructionEnabled(),
      keep: shown.hashes ? { "legal-doc-versions": shown.hashes } : {},
    });
    console.info(retentionLogLine(report));
    return report;
  });

  return NextResponse.json(
    {
      ok: true,
      keepalive,
      campaigns,
      birthday,
      karaoke,
      legalVersions,
      retention,
    },
    { headers: NO_STORE },
  );
}
