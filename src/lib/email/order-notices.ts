import "server-only";

import { createHash } from "node:crypto";

import { orderFulfillment, orderKind } from "@/lib/admin/order-channel";
import type { AdminOrder, AdminRefund } from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";

import {
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
  sendOrderShippedEmail,
  type SendResult,
} from "./send";

/**
 * The three order mails the legal texts promise, each sent once.
 *
 *   shipped    Teslimat ve Kargo Politikası m.15 and the Mesafeli Satış
 *              Sözleşmesi: the tracking number goes to the buyer's address
 *              when the parcel is handed to the carrier.
 *   cancelled  the seller cancels, and the buyer is told.
 *   refund     money goes back, and the buyer is told how much.
 *
 * Every trigger for these can fire more than once. The Geliver webhook is
 * retried and replayed, a shop owner saves the tracking form twice or moves
 * the order to "Kargoda" after typing the number, a refund is booked by the
 * panel and later reported again by the provider. So a notice first CLAIMS
 * its row in `order_notice_emails` - (order, kind) is the primary key and a
 * second claim is a 23505 - and only the claimant sends. A delivery that
 * failed releases the claim so the next trigger may try again; one that went
 * out is final. The provider gets `order-<id>-<kind>` as its idempotency key
 * as well, so even a retry after a timeout that did reach Resend is answered
 * from its record instead of a second copy.
 *
 * Only shop orders are due any of this. A cafe order - gel-al, or the
 * köşk's own courier - is followed on the phone and at the counter; it has
 * no parcel, and the distance-selling texts that promise these mails are
 * about goods sent by cargo.
 *
 * Nothing here throws. Every caller is a write that has already happened
 * (a status moved, money moved), and a mail that could not be sent must
 * never undo it or turn the panel's answer into an error.
 */

export type OrderNoticeOutcome =
  /** Not a shop order, no real address, no tracking number, and so on. */
  | "not_due"
  /** Another trigger already claimed (and sent, or is sending) this one. */
  | "duplicate"
  | "sent"
  /** The claim was released; a later trigger may try again. */
  | "failed";

/** Checkout placeholders and closed accounts are not somebody's inbox. */
export function orderNoticeRecipient(
  order: Pick<AdminOrder, "customerEmail">,
): string | null {
  const to = (order.customerEmail ?? "").trim();
  if (!to || !to.includes("@")) return null;
  const lower = to.toLowerCase();
  if (lower.endsWith("@laffogato.local") || lower.endsWith("@anon.local")) {
    return null;
  }
  return to;
}

function isShopOrder(order: Pick<AdminOrder, "kind">): boolean {
  return orderKind(order) === "shop";
}

/** States in which a parcel can truthfully be said to have left. */
const SHIPPABLE: readonly AdminOrder["status"][] = [
  "paid",
  "preparing",
  "shipped",
  "completed",
];

/**
 * Is a "kargoya verildi" mail due for this order as it now stands? A shop
 * parcel, a real address, a tracking number to give, and an order that is
 * neither unpaid nor undone.
 */
export function shipmentNoticeDue(order: AdminOrder): boolean {
  return (
    isShopOrder(order) &&
    orderFulfillment(order) === "shipping" &&
    Boolean((order.trackingNumber ?? "").trim()) &&
    SHIPPABLE.includes(order.status) &&
    orderNoticeRecipient(order) !== null
  );
}

/** Is a cancellation mail due? Any shop order with a real address. */
export function cancelNoticeDue(order: AdminOrder): boolean {
  return isShopOrder(order) && orderNoticeRecipient(order) !== null;
}

/**
 * The shipment notice's key: one per tracking number, so a corrected number
 * is news the buyer should get while a replay of the same one is not. The
 * number is hashed rather than stored: it identifies a parcel, and through
 * it a person, and the order row already holds it.
 */
export function shipmentNoticeKind(trackingNumber: string): string {
  const digest = createHash("sha256")
    .update(trackingNumber.trim())
    .digest("hex")
    .slice(0, 16);
  return `shipped:${digest}`;
}

export function refundNoticeKind(refundId: string): string {
  return `refund:${refundId}`;
}

export const CANCEL_NOTICE_KIND = "cancelled";

/** A 'sending' claim older than this belongs to a request that died. */
const STALE_CLAIM_MS = 15 * 60_000;

/**
 * Takes the right to send (order, kind). True for exactly one caller.
 *
 * A claim left 'sending' by a request that was killed between the claim and
 * the settle would otherwise block the notice for good; after the stale
 * window the next trigger takes it over with a conditional UPDATE, which is
 * as race-safe as the insert.
 */
async function claim(orderId: string, kind: string): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const ins = await db.from(TABLES.orderNoticeEmails).insert({
    orderId,
    kind,
    status: "sending",
    error: "",
    createdAt: now.toISOString(),
    sentAt: "",
  });
  if (!ins.error) return true;
  if (ins.error.code !== "23505") {
    throw new Error(`order notice claim: ${ins.error.message}`);
  }
  const retaken = await db
    .from(TABLES.orderNoticeEmails)
    .update({ createdAt: now.toISOString(), error: "" })
    .eq("orderId", orderId)
    .eq("kind", kind)
    .eq("status", "sending")
    .lt("createdAt", new Date(now.getTime() - STALE_CLAIM_MS).toISOString())
    .select("orderId");
  if (retaken.error) {
    throw new Error(`order notice reclaim: ${retaken.error.message}`);
  }
  return ((retaken.data as unknown[] | null) ?? []).length > 0;
}

/** Sent is final; a failure hands the notice back to the next trigger. */
async function settle(
  orderId: string,
  kind: string,
  result: SendResult,
): Promise<void> {
  const db = getDb();
  if (result.ok) {
    const upd = await db
      .from(TABLES.orderNoticeEmails)
      .update({ status: "sent", sentAt: new Date().toISOString(), error: "" })
      .eq("orderId", orderId)
      .eq("kind", kind);
    if (upd.error) {
      // The mail is out; a row stuck on 'sending' only delays a retry that
      // Resend's idempotency key would answer from its record anyway.
      console.error(
        `[order-notice] ${kind} sent but not recorded order=${orderId}`,
        upd.error.message,
      );
    }
    return;
  }
  const del = await db
    .from(TABLES.orderNoticeEmails)
    .delete()
    .eq("orderId", orderId)
    .eq("kind", kind)
    .eq("status", "sending");
  if (del.error) {
    console.error(
      `[order-notice] ${kind} failed and the claim could not be released order=${orderId}`,
      del.error.message,
    );
  }
}

/** Claim, send, settle - and never throw into the write that called us. */
async function once(
  order: AdminOrder,
  kind: string,
  deliver: (idempotencyKey: string) => Promise<SendResult>,
): Promise<OrderNoticeOutcome> {
  try {
    if (!(await claim(order.id, kind))) return "duplicate";
  } catch (err) {
    // Without the claim there is no "once", so nothing is sent. The write
    // that triggered this has just succeeded against the same database, so
    // this is rare; the log says which notice to send by hand.
    console.error(
      `[order-notice] ${kind} not claimed order=${order.id} orderNo=${order.orderNo}`,
      err,
    );
    return "failed";
  }
  let result: SendResult;
  try {
    result = await deliver(`order-${order.id}-${kind}`);
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  try {
    await settle(order.id, kind, result);
  } catch (err) {
    console.error(`[order-notice] ${kind} settle failed order=${order.id}`, err);
  }
  if (!result.ok) {
    console.error(
      `[order-notice] ${kind} not delivered order=${order.id} orderNo=${order.orderNo}: ${result.error}`,
    );
    return "failed";
  }
  return "sent";
}

/**
 * "Siparişiniz kargoya verildi": the tracking number, the carrier when the
 * panel knows it, and the carrier's page when Geliver sent one. Called from
 * every place a parcel can become shipped - the tracking form, the
 * "Kargoya ver" move, the Geliver hand-over event - and sent once per
 * tracking number whichever gets there first.
 */
export async function notifyOrderShipped(
  order: AdminOrder,
): Promise<OrderNoticeOutcome> {
  if (!shipmentNoticeDue(order)) return "not_due";
  const trackingNumber = (order.trackingNumber ?? "").trim();
  return once(order, shipmentNoticeKind(trackingNumber), (key) =>
    sendOrderShippedEmail(
      {
        to: orderNoticeRecipient(order) as string,
        customerName: order.customerName ?? "",
        orderNo: order.orderNo,
        trackingNumber,
        carrier: order.carrier ?? "",
        trackingUrl: order.trackingUrl ?? "",
      },
      key,
    ),
  );
}

/**
 * "Siparişiniz iptal edildi", once per order. `collected` is whether money
 * was taken, as the store could tell; `null` when it could not, and the mail
 * then says nothing about payment either way.
 */
export async function notifyOrderCancelled(
  order: AdminOrder,
  { collected }: { collected: boolean | null },
): Promise<OrderNoticeOutcome> {
  if (!cancelNoticeDue(order)) return "not_due";
  return once(order, CANCEL_NOTICE_KIND, (key) =>
    sendOrderCancelledEmail(
      {
        to: orderNoticeRecipient(order) as string,
        customerName: order.customerName ?? "",
        orderNo: order.orderNo,
        items: (order.items ?? []).map((it) => ({
          productName: it.productName,
          qty: it.qty,
          unitPriceMinor: it.unitPriceMinor,
        })),
        subtotalMinor: order.subtotalMinor,
        shippingMinor: order.shippingMinor,
        totalMinor: order.totalMinor,
        collected,
      },
      key,
    ),
  );
}

/**
 * "İadeniz yapıldı", once per refund entry, after the money has moved.
 * `order.refunds` is expected to include `refund` already; the running total
 * in the mail is read from it.
 */
export async function notifyOrderRefunded(
  order: AdminOrder,
  refund: Pick<AdminRefund, "id" | "amountMinor">,
  { viaCard }: { viaCard: boolean },
): Promise<OrderNoticeOutcome> {
  if (!cancelNoticeDue(order) || !(refund.amountMinor > 0) || !refund.id) {
    return "not_due";
  }
  const refunds = order.refunds ?? [];
  const listed = refunds.some((r) => r.id === refund.id);
  const refundedTotalMinor =
    refunds.reduce((sum, r) => sum + r.amountMinor, 0) +
    (listed ? 0 : refund.amountMinor);
  return once(order, refundNoticeKind(refund.id), (key) =>
    sendOrderRefundedEmail(
      {
        to: orderNoticeRecipient(order) as string,
        customerName: order.customerName ?? "",
        orderNo: order.orderNo,
        refundMinor: refund.amountMinor,
        refundedTotalMinor,
        totalMinor: order.totalMinor,
        viaCard,
      },
      key,
    ),
  );
}
