import { NextResponse } from "next/server";

import { expireStalePendingOrders } from "@/lib/admin/store";
import { recordSupabaseKeepalive } from "@/lib/admin/supabase-keepalive";
import { resumePendingCampaigns } from "@/lib/email/campaigns";
import { reconcileIys } from "@/lib/iys/store";
import { runInvoices } from "@/lib/invoice/run";
import { recordShownLegalVersions } from "@/lib/legal/store";
import { chargeSettledResales } from "@/lib/mobile/karaoke";
import { expireUnpaidReservations } from "@/lib/mobile/karaoke-payment";
import { checkPushReceipts } from "@/lib/push/order-push";
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
 * **The ping's outcome is recorded** in our own Postgres
 * (`supabase_keepalive`, `recordSupabaseKeepalive`) for the owner's
 * dashboard: nobody can call this route by hand (CRON_SECRET is "sensitive"
 * on Vercel), so its response body was the only place the result lived. The
 * record is written after every job, not beside the ping: it is
 * bookkeeping, and a write waiting on a database that does not answer holds
 * the pool's one connection, which would hold up every job behind it. It is
 * bounded, never throws, and its failure leaves the run and the ping's
 * reported outcome as they were (`keepalive.recorded` says whether it
 * landed).
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
  const startedAt = Date.now();

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
  // İYS: which consents and refusals the operator still has to register in
  // İYS, and by when (src/lib/iys, /admin/iys). Sends nothing; the counts
  // only, never an address.
  const iys = await step("iys", async () => ({
    reconcile: await reconcileIys(),
  }));
  // Karaoke holds nobody paid: each asked about at the POS first, and only a
  // "no payment" (or a day of not being able to ask) frees the hour
  // (CLAUDE.md rule 29). Bookings run it too; this catches a quiet day.
  const karaoke = await step("karaoke-holds", async () => ({
    expired: await expireUnpaidReservations(),
  }));
  // An hour a late-cancelled booking left, sold again: counted for its
  // refund once the buyer's own free window has closed (a sale its buyer
  // can still take back for nothing refunds nobody, 29 Eki 2026). Before
  // the e-Arşiv step, which then waits for the refund.
  const karaokeResale = await step("karaoke-resale", () =>
    chargeSettledResales(),
  );
  // Orders nobody paid for within their window (45 minutes): the same rule
  // as the karaoke holds - each asked about at the POS first, a payment
  // found is booked, only "no payment" (or a day of not being able to ask)
  // cancels and hands the stock back (rule 29). A checkout and the member's
  // order list run it too; this catches a quiet day, so a dead checkout
  // does not sit in the app as an order in progress. Before the e-Arşiv
  // step, which then sees a payment the sweep booked.
  const orders = await step("unpaid-orders", async () => ({
    expired: await expireStalePendingOrders(),
  }));
  // Expo's delivery receipts for yesterday's order notifications: a token
  // Apple or Google say reaches no device is forgotten, and the tokens kept
  // beside the tickets are cleared (src/lib/push/order-push.ts).
  const pushReceipts = await step("push-receipts", () => checkPushReceipts());
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

  // e-Arşiv invoices through Paraşüt (docs/EARSIV.md): the sweep of the
  // last ten days' paid orders and karaoke bookings, then whatever is due,
  // within what is left of the 300 s (at most 120 s). Off (EARSIV_MODE
  // unset) it touches nothing. The hooks on payment, delivery and refund
  // do the same work for one order at a time; this catches the rest, the
  // karaoke evenings and anything a hook missed, well inside the 7 days
  // VUK m.231/5 allows.
  const invoices = await step("earsiv-invoices", async () => {
    const left = 285_000 - (Date.now() - startedAt);
    const budgetMs = Math.min(120_000, left);
    if (budgetMs < 30_000) return { skipped: "no-time" as const };
    const r = await runInvoices({ budgetMs, reason: "cron" });
    return {
      mode: r.mode,
      errors: r.errors.length,
      created: r.created,
      processed: r.processed,
      issued: r.issued,
      drafts: r.drafts,
      failed: r.failed,
      manual: r.manual,
      emailed: r.emailed,
      more: r.more,
    };
  });

  // The ping's outcome, for the owner's dashboard. A step that threw (the
  // ping itself never does) got nowhere as far as anyone can tell: failed.
  // The record never throws either; the catch only keeps that promise here.
  const recorded = await recordSupabaseKeepalive(
    keepalive.ok ? keepalive.ping : "failed",
  ).catch(() => false);

  return NextResponse.json(
    {
      ok: true,
      keepalive: { ...keepalive, recorded },
      campaigns,
      birthday,
      iys,
      karaoke,
      karaokeResale,
      orders,
      pushReceipts,
      legalVersions,
      retention,
      invoices,
    },
    { headers: NO_STORE },
  );
}
