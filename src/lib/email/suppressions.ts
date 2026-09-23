import "server-only";

import { getDb } from "@/lib/db";

import type { SuppressionEvent } from "./resend-webhook";

/**
 * The commercial-mail suppression list (`email_suppressions`).
 *
 * Written only by the Resend webhook (`/api/webhooks/resend`); read only in
 * SQL, by `campaign_email_audience` and `birthday_greeting_audience`, so a
 * suppressed address drops out of the campaign count, the queue, the claim
 * and the birthday greeting at once. Order, shipping and password mail never
 * consult it.
 */

/**
 * Records every recipient of one verified event. Idempotent per address: a
 * repeated delivery only moves `updatedAt`. Throws on a database error so the
 * route answers 500 and Resend retries the delivery.
 */
export async function recordSuppression(
  event: SuppressionEvent,
  providerEventId: string,
  now: Date = new Date(),
): Promise<number> {
  const at = now.toISOString();
  for (const email of event.emails) {
    const { error } = await getDb().rpc("email_suppression_record", {
      p_email: email,
      p_reason: event.reason,
      p_detail: event.detail,
      p_event_id: providerEventId,
      p_email_id: event.emailId,
      p_now: at,
    });
    if (error) throw new Error(`email_suppression_record: ${error.message}`);
  }
  return event.emails.length;
}
