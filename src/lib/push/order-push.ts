import "server-only";

import { getOrder, type AdminOrderStatus } from "@/lib/admin/store";
import { getCustomerByEmail } from "@/lib/customer/store";
import { getDb, TABLES } from "@/lib/db";
import { notifyOrderReady } from "@/lib/email/order-notices";

import { deviceTokensFor, forgetTokens } from "./devices";
import { getExpoReceipts, sendExpoPush } from "./expo";
import {
  expoMessagesFor,
  maskPushToken,
  orderPushFor,
  readyMailDue,
  summariseTickets,
} from "./order-push-core";

/**
 * Tells the member's phones that their order moved (docs/API-MOBILE.md §23).
 *
 * Called after the response, from `transitionOrder` (src/lib/admin/store.ts):
 * the admin panel, the köşk panel's bar screen and the till all move orders
 * through it. Once per (order, kind), claimed in `order_push_notices`, so a
 * replayed move tells nobody twice.
 *
 * Who is told: the member whose e-mail the order carries, while their
 * "Sipariş durumu" switch (`notificationPrefs.orderUpdates`) is on, on
 * every phone they allowed. A pickup order that is ready and reached no
 * phone gets the "siparişin hazır" e-mail instead (also off with the
 * switch; a guest who has no switch gets it).
 *
 * Nothing here throws into the caller: a notification that could not be
 * sent never undoes or delays the order move.
 */

/** A 'sending' claim older than this belongs to a request that died. */
const STALE_CLAIM_MS = 15 * 60_000;

async function claim(orderId: string, kind: string, now: Date): Promise<boolean> {
  const db = getDb();
  // ON CONFLICT DO NOTHING rather than catching 23505: the row coming back
  // is the claim, no row means somebody holds it already.
  const inserted = await db
    .from(TABLES.orderPushNotices)
    .upsert(
      { orderId, kind, status: "sending", createdAt: now.toISOString() },
      { onConflict: "orderId,kind", ignoreDuplicates: true },
    )
    .select("orderId");
  if (inserted.error) throw new Error(inserted.error.message);
  if (Array.isArray(inserted.data) && inserted.data.length > 0) return true;
  // Taken already: by a send in flight, done, or a request that died while
  // holding it. Only the last may be taken over.
  const stale = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();
  const taken = await db
    .from(TABLES.orderPushNotices)
    .update({ createdAt: now.toISOString() })
    .eq("orderId", orderId)
    .eq("kind", kind)
    .eq("status", "sending")
    .lt("createdAt", stale)
    .select("orderId");
  if (taken.error) throw new Error(taken.error.message);
  return Array.isArray(taken.data) && taken.data.length > 0;
}

async function settle(
  orderId: string,
  kind: string,
  patch: {
    status: "sent" | "none" | "failed";
    tickets?: { token: string; id: string }[];
    error?: string;
  },
  now: Date,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.orderPushNotices)
    .update({
      status: patch.status,
      tickets: patch.tickets ?? [],
      error: (patch.error ?? "").slice(0, 300),
      sentAt: patch.status === "sent" ? now.toISOString() : "",
    })
    .eq("orderId", orderId)
    .eq("kind", kind);
  if (error) {
    console.error(
      `[order-push] ${kind} could not be settled order=${orderId}`,
      error.message,
    );
  }
}

export type OrderPushOutcome =
  | "not_due"
  | "duplicate"
  | "sent"
  | "none"
  | "failed";

/**
 * The move `from` → `to` just happened to `orderId`. Reads the order again
 * (the caller's copy may be a moment old) and tells the member if it is
 * still where the move put it.
 */
export async function notifyOrderStage(
  orderId: string,
  from: AdminOrderStatus,
  to: AdminOrderStatus,
  now: Date = new Date(),
): Promise<OrderPushOutcome> {
  try {
    const order = await getOrder(orderId);
    if (!order || order.status !== to) return "not_due";
    const push = orderPushFor(order, from, to);
    if (!push) return "not_due";

    const member = order.customerEmail
      ? await getCustomerByEmail(order.customerEmail)
      : null;
    // A member who turned "Sipariş durumu" off hears nothing, phone or mail.
    if (member && member.notificationPrefs?.orderUpdates === false) {
      return "not_due";
    }
    if (!(await claim(order.id, push.kind, now))) return "duplicate";

    const tokens =
      member && member.isActive ? await deviceTokensFor(member.email) : [];
    let accepted: { token: string; id: string }[] = [];
    let outcome: OrderPushOutcome = "none";
    if (tokens.length > 0) {
      const tickets = await sendExpoPush(
        expoMessagesFor(tokens, order.id, push),
      );
      const summary = summariseTickets(tokens, tickets);
      accepted = summary.accepted;
      if (summary.gone.length > 0) {
        await forgetTokens(summary.gone).catch((err) =>
          console.error("[order-push] stale tokens not removed", err),
        );
      }
      if (summary.errors.length > 0) {
        console.warn(
          `[order-push] ${push.kind} order=${order.id}: ${summary.errors.length} refused (${[...new Set(summary.errors)].join(", ")}); gone ${summary.gone.map(maskPushToken).join(" ")}`,
        );
      }
      outcome = accepted.length > 0 ? "sent" : "failed";
      await settle(
        order.id,
        push.kind,
        {
          status: outcome === "sent" ? "sent" : "failed",
          tickets: accepted,
          error: summary.errors.slice(0, 3).join(", "),
        },
        now,
      );
    } else {
      await settle(order.id, push.kind, { status: "none" }, now);
    }

    if (readyMailDue(push, accepted.length)) {
      await notifyOrderReady(order);
    }
    return outcome;
  } catch (err) {
    console.error(`[order-push] ${to} order=${orderId}`, err);
    return "failed";
  }
}

/**
 * Reads Expo's receipts for the pushes sent in the last day (Expo keeps
 * them for 24 hours and they are ready after about 15 minutes) and forgets
 * every token Apple or Google say reaches no device. Then drops the tokens
 * from the notice rows: past this point nothing needs them. Run by the daily
 * cron; rows older than a day are only cleared.
 */
export async function checkPushReceipts(
  now: Date = new Date(),
): Promise<{ read: number; forgotten: number; cleared: number }> {
  const db = getDb();
  const ready = new Date(now.getTime() - 15 * 60_000).toISOString();
  const expired = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const { data, error } = await db
    .from(TABLES.orderPushNotices)
    .select("orderId, kind, tickets, sentAt")
    .eq("status", "sent")
    .eq("receiptsCheckedAt", "")
    .lt("sentAt", ready)
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    orderId: string;
    kind: string;
    tickets: { token: string; id: string }[] | null;
    sentAt: string;
  }[];
  const live = rows.filter((r) => r.sentAt >= expired);
  const ids = live.flatMap((r) => (r.tickets ?? []).map((t) => t.id));
  let forgotten = 0;
  let read = 0;
  if (ids.length > 0) {
    const receipts = await getExpoReceipts(ids);
    // A failed read is tried again tomorrow while the rows are young enough.
    if (receipts === null) return { read: 0, forgotten: 0, cleared: 0 };
    read = Object.keys(receipts).length;
    const gone = live.flatMap((r) =>
      (r.tickets ?? [])
        .filter(
          (t) => receipts[t.id]?.details?.error === "DeviceNotRegistered",
        )
        .map((t) => t.token),
    );
    if (gone.length > 0) {
      await forgetTokens(gone);
      forgotten = gone.length;
    }
  }
  let cleared = 0;
  for (const r of rows) {
    const { error: updErr } = await db
      .from(TABLES.orderPushNotices)
      .update({ tickets: [], receiptsCheckedAt: now.toISOString() })
      .eq("orderId", r.orderId)
      .eq("kind", r.kind);
    if (!updErr) cleared++;
  }
  return { read, forgotten, cleared };
}
