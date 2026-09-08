import "server-only";

import { after } from "next/server";

import {
  countCampaignAudience,
  prefForTemplate,
  queueCampaignEmail,
  runCampaignEmail,
  type CampaignAudience,
} from "@/lib/email/campaigns";
import type { CampaignTemplateName } from "@/lib/email/send";

/**
 * The dry count quoted in the "Gönder" confirmation — the same database
 * function the enqueue reads, so the number agreed to is the number queued.
 * Null when it cannot be had: an unreachable database must not take the
 * whole page down, and the button then asks for a confirmation without a
 * number rather than showing a zero.
 */
export async function campaignAudienceCount(
  audience: CampaignAudience,
  template: CampaignTemplateName,
): Promise<number | null> {
  try {
    return await countCampaignAudience(audience, prefForTemplate(template));
  } catch (err) {
    console.error("[campaign] kitle sayılamadı", err);
    return null;
  }
}

/**
 * How long the background runner may keep sending after the panel's response
 * has gone back. The pages hosting a send action declare `maxDuration = 300`
 * (Vercel's cap on the plan in use); the runner stops claiming batches at
 * 240 s so the last batch it did claim is settled before the function ends.
 */
export const CAMPAIGN_RUN_DEADLINE_MS = 240_000;

/**
 * Queues the campaign's audience, then hands the batches to `after()`.
 *
 * The operator gets their answer as soon as the send log is built — "N adres
 * kuyruğa alındı" — and the messages go out while the function is still
 * alive, without the request waiting on a hundred Resend calls. `after()` is
 * bounded by the route's `maxDuration`, not a job queue: whatever the
 * deadline leaves over stays `sending` and the daily cron finishes it
 * (docs/EMAIL-RESEND.md §7). Throws what `queueCampaignEmail` throws — a
 * campaign that cannot be queued (missing field, wrong status) never reaches
 * the runner.
 */
export async function startCampaignSend(
  id: string,
): Promise<{ total: number }> {
  const queued = await queueCampaignEmail(id);
  after(async () => {
    try {
      await runCampaignEmail(id, { deadlineMs: CAMPAIGN_RUN_DEADLINE_MS });
    } catch (err) {
      // The runner has already written the failure onto the campaign row;
      // this only keeps the rejection out of the platform's unhandled-error
      // log, where it would read as a crash of the request that finished.
      console.error(`[campaign] ${id}: arka planda gönderim durdu`, err);
    }
  });
  return queued;
}
