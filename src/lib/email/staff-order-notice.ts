import "server-only";

import { createHash } from "node:crypto";

import { listEnvAdminContacts } from "@/lib/admin/auth";
import { getOrder, getSettings } from "@/lib/admin/store";
import { listAdminUsers } from "@/lib/admin/users";
import { SITE } from "@/lib/seo/site";

import {
  claimOrderNotice,
  settleOrderNotice,
  type OrderNoticeOutcome,
} from "./order-notices";
import {
  BATCH_LIMIT,
  deliverBatch,
  renderOperatorNotice,
  type BatchDeliveryResult,
  type BatchMessage,
  type SendResult,
} from "./send";
import {
  buildStaffNoticeContent,
  normalizeNotifyRoles,
  resolveStaffRecipients,
  staffNoticeIdempotencyKey,
  type StaffRecipient,
} from "./staff-order-notice-core";

/**
 * The team's "yeni sipariş" mail, sent once per order when its payment is
 * confirmed (`applyPaymentSucceeded`). Scheduled with `after()`, so it never
 * delays or fails the payment it follows.
 *
 * Once per order: one `order_notice_emails` row (kind `staff-new`) is claimed
 * before anything is sent, the same claim the customer notices use; a second
 * trigger finds it taken.
 *
 * Delivery, in this order of defence:
 *   1. every recipient in ONE provider request (`POST /emails/batch`, up to
 *      100 per request), not one request each - a list longer than Resend's
 *      per-second budget used to lose its tail to 429s;
 *   2. a 429, a 5xx or a dropped connection is retried here, twice, after a
 *      short pause (the provider's `Retry-After` when it sends one, capped),
 *      with the same `Idempotency-Key`, so a retry after a timeout that did
 *      reach the provider cannot put a second copy in any inbox;
 *   3. if every attempt failed the claim is released, and a later
 *      confirmation of the same payment (the bank's return, a replayed
 *      webhook) offers the mail again - but only while the order is fresh
 *      (`FRESH_MS` since `paidAt`). A "yeni sipariş" mail about an order
 *      paid hours ago would send the kitchen after something long served.
 *
 * So it is "once, retried briefly", not "eventually": a provider outage longer
 * than the window means the panel's order list is where the order is seen.
 *
 * Never throws.
 */

export const STAFF_NEW_ORDER_KIND = "staff-new";

/** Statuses a just-paid order can be in by the time `after()` runs. */
const PAID_STATES = new Set(["paid", "preparing", "shipped", "completed"]);

/** How long after `paidAt` the mail is still news to the kitchen. */
export const FRESH_MS = 30 * 60_000;

/** First try plus two retries; pauses short enough for an `after()` budget. */
const RETRY_DELAYS_MS = [1_000, 2_500] as const;
/** A provider asking for longer than this is not waited for here. */
const MAX_RETRY_WAIT_MS = 3_000;

export interface StaffNoticeDeps {
  /** Tests pass an instant one; the default really waits. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Worth asking again: rate-limited, the provider's own fault, or no answer. */
function retriable(r: Exclude<BatchDeliveryResult, { ok: true }>): boolean {
  if (r.status === 429 || r.status >= 500) return true;
  // Status 0 is "no request made": a network failure is worth a retry, a
  // missing key is not.
  return r.status === 0 && Boolean(process.env.RESEND_API_KEY);
}

async function sendWithRetry(
  messages: BatchMessage[],
  key: string,
  sleep: (ms: number) => Promise<void>,
): Promise<BatchDeliveryResult> {
  let result = await deliverBatch(messages, key);
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok || !retriable(result)) return result;
    const wait = Math.min(result.retryAfterMs ?? delay, MAX_RETRY_WAIT_MS);
    await sleep(Math.max(0, wait));
    result = await deliverBatch(messages, key);
  }
  return result;
}

export async function notifyStaffNewOrder(
  orderId: string,
  payment: { provider: string },
  deps: StaffNoticeDeps = {},
): Promise<OrderNoticeOutcome> {
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  try {
    const settings = await getSettings();
    if (!settings.orderNotifyEnabled) return "not_due";
    const order = await getOrder(orderId);
    if (!order || !PAID_STATES.has(order.status)) return "not_due";
    // A later confirmation re-offers a mail that failed; past the window it
    // is no longer news (see the header).
    const paidAt = Date.parse(order.paidAt ?? "");
    if (!Number.isFinite(paidAt) || now() - paidAt > FRESH_MS) {
      return "not_due";
    }

    let panelUsers: Awaited<ReturnType<typeof listAdminUsers>> = [];
    try {
      panelUsers = await listAdminUsers();
    } catch (err) {
      // The env accounts and the typed addresses still get it.
      console.error("[staff-order-notice] admin users unreadable", err);
    }
    const recipients = resolveStaffRecipients({
      enabled: settings.orderNotifyEnabled,
      roles: normalizeNotifyRoles(settings.orderNotifyRoles),
      extraEmails: settings.orderNotifyEmails ?? "",
      notificationEmail: settings.notificationEmail ?? "",
      panelUsers,
      envAdmins: listEnvAdminContacts(),
    });
    if (recipients.length === 0) return "not_due";

    if (!(await claimOrderNotice(order.id, STAFF_NEW_ORDER_KIND))) {
      return "duplicate";
    }

    let delivered = 0;
    let lastError = "gönderilemedi";
    try {
      const content = buildStaffNoticeContent(order, payment.provider);
      // Two variants at most: the order link, or the till for a role that
      // cannot open orders. Rendered once each, not once per inbox.
      const rendered = new Map<
        boolean,
        ReturnType<typeof renderOperatorNotice>
      >();
      const renderFor = (r: StaffRecipient) => {
        const hit = rendered.get(r.canOpenOrders);
        if (hit) return hit;
        const out = renderOperatorNotice({
          ...content,
          to: r.email,
          button: r.canOpenOrders
            ? {
                label: "Siparişi aç",
                url: `${SITE.url}/admin/siparisler/${encodeURIComponent(order.id)}`,
              }
            : { label: "Kasaya git", url: `${SITE.url}/admin/kasa` },
        });
        rendered.set(r.canOpenOrders, out);
        return out;
      };
      const messages: BatchMessage[] = recipients.map((r) => {
        const m = renderFor(r);
        return { to: r.email, subject: m.subject, html: m.html, text: m.text };
      });
      // The addresses only as a digest: the key is logged by the provider.
      const listDigest = digest(
        recipients
          .map((r) => r.email)
          .sort()
          .join("\n"),
      );
      for (let i = 0; i * BATCH_LIMIT < messages.length; i++) {
        const chunk = messages.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);
        const result = await sendWithRetry(
          chunk,
          staffNoticeIdempotencyKey(order.id, listDigest, i),
          sleep,
        );
        if (result.ok) delivered += chunk.length;
        else lastError = result.error;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(
        `[staff-order-notice] could not prepare order=${order.id}`,
        err,
      );
    }

    // One inbox reached is the notice delivered: the claim is kept, so a
    // later confirmation does not mail the ones that did get it again.
    // Nothing reached releases the claim for a later confirmation (header).
    const verdict: SendResult =
      delivered > 0 ? { ok: true } : { ok: false, error: lastError };
    try {
      await settleOrderNotice(order.id, STAFF_NEW_ORDER_KIND, verdict);
    } catch (err) {
      console.error(
        `[staff-order-notice] settle failed order=${order.id}`,
        err,
      );
    }
    if (delivered < recipients.length) {
      // Counts only: the addresses are staff PII and stay out of the log.
      console.error(
        `[staff-order-notice] ${recipients.length - delivered}/${recipients.length} not delivered order=${order.id} orderNo=${order.orderNo}`,
      );
    }
    return delivered > 0 ? "sent" : "failed";
  } catch (err) {
    console.error(`[staff-order-notice] failed order=${orderId}`, err);
    return "failed";
  }
}
