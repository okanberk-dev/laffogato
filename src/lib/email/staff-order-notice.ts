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
import { sendOperatorNotice, type SendResult } from "./send";
import {
  buildStaffNoticeContent,
  normalizeNotifyRoles,
  resolveStaffRecipients,
  staffNoticeIdempotencyKey,
  type StaffRecipient,
} from "./staff-order-notice-core";

/**
 * The team's "yeni sipariş" mail, sent once per order when its payment is
 * confirmed (`applyPaymentSucceeded`, the branch where the order actually
 * moved to `paid`). Scheduled with `after()`, so it never delays or fails the
 * payment it follows.
 *
 * Once per order: one `order_notice_emails` row (kind `staff-new`) is claimed
 * before anything is sent, the same claim the customer notices use; a replayed
 * confirmation finds it taken. Inside that claim every recipient is sent their
 * own copy with their own `Idempotency-Key`, so a retry after a timeout cannot
 * put a second copy in any inbox either.
 *
 * Never throws.
 */

export const STAFF_NEW_ORDER_KIND = "staff-new";

/** Statuses a just-paid order can be in by the time `after()` runs. */
const PAID_STATES = new Set(["paid", "preparing", "shipped", "completed"]);

function digest(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

export async function notifyStaffNewOrder(
  orderId: string,
  payment: { provider: string },
): Promise<OrderNoticeOutcome> {
  try {
    const settings = await getSettings();
    if (!settings.orderNotifyEnabled) return "not_due";
    const order = await getOrder(orderId);
    if (!order || !PAID_STATES.has(order.status)) return "not_due";

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

    const content = buildStaffNoticeContent(order, payment.provider);
    const sendTo = async (r: StaffRecipient): Promise<SendResult> => {
      try {
        return await sendOperatorNotice({
          ...content,
          to: r.email,
          button: r.canOpenOrders
            ? {
                label: "SİPARİŞİ AÇ",
                url: `${SITE.url}/admin/siparisler/${encodeURIComponent(order.id)}`,
              }
            : { label: "KASAYA GİT", url: `${SITE.url}/admin/kasa` },
          idempotencyKey: staffNoticeIdempotencyKey(order.id, digest(r.email)),
        });
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };
    const results = await Promise.all(recipients.map(sendTo));
    const delivered = results.filter((r) => r.ok).length;

    // One inbox reached is the notice delivered: the claim is kept, so a
    // replayed confirmation does not mail the ones that did get it again.
    // Nothing reached hands the claim back for the next trigger.
    const verdict: SendResult =
      delivered > 0
        ? { ok: true }
        : {
            ok: false,
            error:
              results.find((r): r is { ok: false; error: string } => !r.ok)
                ?.error ?? "gönderilemedi",
          };
    try {
      await settleOrderNotice(order.id, STAFF_NEW_ORDER_KIND, verdict);
    } catch (err) {
      console.error(
        `[staff-order-notice] settle failed order=${order.id}`,
        err,
      );
    }
    if (delivered < results.length) {
      // Counts only: the addresses are staff PII and stay out of the log.
      console.error(
        `[staff-order-notice] ${results.length - delivered}/${results.length} not delivered order=${order.id} orderNo=${order.orderNo}`,
      );
    }
    return delivered > 0 ? "sent" : "failed";
  } catch (err) {
    console.error(`[staff-order-notice] failed order=${orderId}`, err);
    return "failed";
  }
}
