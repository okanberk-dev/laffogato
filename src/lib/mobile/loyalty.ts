import "server-only";

import type { DbError } from "@/lib/db";

import {
  customerOrdersByEmail,
  orderChannel,
  orderKind,
  type AdminOrder,
} from "@/lib/admin/store";
import type { CustomerCoupon } from "@/lib/customer/coupons";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { FREE_DRINK_REWARD, grantFreeDrinkCoupon } from "./free-drink";
import { rewardInviteOnFirstPaidOrder } from "./invite";
import {
  buildLoyaltyView,
  computeStampBalance,
  STAMP_TARGET,
  type LoyaltyStamp,
  type LoyaltyView,
} from "./loyalty-core";

/**
 * Loyalty ledger (docs/API-MOBILE.md §3, §4, §5).
 *
 * Append-only `loyalty_stamps`: an `earn` row per stamp, a `redeem` row per
 * reward. Balances are always recomputed from the ledger, never stored — a
 * counter that is written from two serverless invocations at once is exactly
 * how a member gets a free drink twice or loses a stamp.
 */

export { FREE_DRINK_REWARD, grantFreeDrinkCoupon } from "./free-drink";
export {
  buildLoyaltyView,
  computeStampBalance,
  STAMP_TARGET,
  type LoyaltyStamp,
  type LoyaltyView,
} from "./loyalty-core";

function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** Every ledger row of a member, newest first. */
export async function listStamps(email: string): Promise<LoyaltyStamp[]> {
  const owner = normalizeEmail(email);
  if (!owner) return [];
  const { data, error } = await getDb()
    .from(TABLES.loyaltyStamps)
    .select("*")
    .eq("customerEmail", owner)
    .order("createdAt", { ascending: false });
  checkErr(error, "listStamps");
  return (data as LoyaltyStamp[] | null) ?? [];
}

async function newStampId(): Promise<string> {
  const seq = await nextSeq("stamp");
  return `stamp-${String(seq).padStart(6, "0")}`;
}

/** The `/me.loyalty` block for a member. */
export async function getLoyalty(email: string): Promise<LoyaltyView> {
  const owner = normalizeEmail(email);
  const [stamps, orders] = await Promise.all([
    listStamps(owner),
    customerOrdersByEmail(owner),
  ]);
  return buildLoyaltyView(stamps, orders, Date.now());
}

/**
 * Hook for the order machine: called once an order reaches `paid`
 * (`applyPaymentSucceeded`). Safe to call again for the same order.
 *
 * - An app cafe order earns one stamp. The partial unique index on `orderId`
 *   makes a duplicate webhook a 23505 that is swallowed here, so the stamp is
 *   earned exactly once.
 * - The customer's first paid order settles a pending invite: both the
 *   inviter and the invitee receive a free-drink coupon (§5).
 *
 * Never throws for a business reason; a database failure propagates so the
 * caller's own error handling sees it.
 */
export async function onOrderPaid(order: AdminOrder): Promise<void> {
  const owner = normalizeEmail(order.customerEmail);
  if (!owner || owner === "guest@laffogato.local") return;

  if (orderChannel(order) === "app" && orderKind(order) === "cafe") {
    const row: LoyaltyStamp = {
      id: await newStampId(),
      customerEmail: owner,
      kind: "earn",
      delta: 1,
      source: "order",
      orderId: order.id,
      note: `Sipariş #${order.orderNo}`,
      actor: "",
      createdAt: new Date().toISOString(),
    };
    const { error } = await getDb().from(TABLES.loyaltyStamps).insert(row);
    // 23505 on loyalty_stamps_order_key: this order already earned its stamp.
    if (error && error.code !== "23505") checkErr(error, "onOrderPaid.earn");
  }

  await rewardInviteOnFirstPaidOrder(owner, {
    kind: orderKind(order),
    totalMinor: order.totalMinor,
    discountMinor: order.discountMinor,
  });
}

/**
 * Takes back the stamp an order earned, when that order is undone.
 *
 * Pay → earn a stamp → ask for a refund was a way to collect free drinks: the
 * ledger only ever added. A reversal row is written instead of deleting the
 * earn, so the history still shows what happened, and it is idempotent on the
 * order (one reversal per order, guarded by the same unique index shape).
 */
export async function onOrderReversed(order: AdminOrder): Promise<void> {
  const owner = normalizeEmail(order.customerEmail);
  if (!owner || owner === "guest@laffogato.local") return;

  const stamps = await listStamps(owner);
  const earned = stamps.find(
    (s) => s.orderId === order.id && s.kind === "earn",
  );
  if (!earned) return;
  if (stamps.some((s) => s.orderId === order.id && s.kind === "reversal"))
    return;

  const row: LoyaltyStamp = {
    id: await newStampId(),
    customerEmail: owner,
    kind: "reversal",
    delta: -1,
    source: "order",
    orderId: order.id,
    note: `Sipariş #${order.orderNo} iade/iptal`,
    actor: "",
    createdAt: new Date().toISOString(),
  };
  const { error } = await getDb().from(TABLES.loyaltyStamps).insert(row);
  if (error && error.code !== "23505") checkErr(error, "onOrderReversed");
}

export type RedeemStampsResult =
  | { ok: true; coupon: CustomerCoupon; loyalty: LoyaltyView }
  | { ok: false; error: "not_enough_stamps" };

/**
 * Turns six available stamps into a free-drink coupon (`POST /loyalty/redeem`).
 *
 * The balance check and the ledger write are not one statement, so two
 * simultaneous redeems could both pass the check. The write is therefore
 * verified afterwards: if the ledger has gone negative, this request's redeem
 * row is withdrawn and the request fails — the coupon is only granted once
 * the redeem row is known to be covered.
 */
export async function redeemStamps(email: string): Promise<RedeemStampsResult> {
  const owner = normalizeEmail(email);
  const before = computeStampBalance(await listStamps(owner));
  if (before.available < STAMP_TARGET) {
    return { ok: false, error: "not_enough_stamps" };
  }

  const db = getDb();
  const id = await newStampId();
  const now = new Date().toISOString();
  const redeemRow: LoyaltyStamp = {
    id,
    customerEmail: owner,
    kind: "redeem",
    delta: -STAMP_TARGET,
    source: "app",
    orderId: "",
    note: FREE_DRINK_REWARD.title,
    actor: "",
    createdAt: now,
  };
  const ins = await db.from(TABLES.loyaltyStamps).insert(redeemRow);
  checkErr(ins.error, "redeemStamps.insert");

  const after = computeStampBalance(await listStamps(owner));
  if (after.lifetimeStamps - STAMP_TARGET * after.redeemCount < 0) {
    // Lost the race: another redeem took the stamps first. Withdraw ours.
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.rollback");
    return { ok: false, error: "not_enough_stamps" };
  }

  let coupon: CustomerCoupon;
  try {
    coupon = await grantFreeDrinkCoupon(owner, "loyalty");
  } catch (err) {
    // The stamps were spent for a coupon that never existed. Give them back
    // and let the caller fail loudly, rather than leaving the member six
    // stamps poorer with nothing to show for it.
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.grantRollback");
    throw err;
  }
  return { ok: true, coupon, loyalty: await getLoyalty(owner) };
}

/**
 * A stamp handed out at the counter (admin panel). `actor` is the admin's
 * e-mail, kept on the row so the ledger says who pressed the button.
 */
export async function addCounterStamp(
  email: string,
  actor: string,
  note = "",
): Promise<LoyaltyStamp> {
  const owner = normalizeEmail(email);
  if (!owner) throw new Error("addCounterStamp: e-mail required");
  const row: LoyaltyStamp = {
    id: await newStampId(),
    customerEmail: owner,
    kind: "earn",
    delta: 1,
    source: "counter",
    orderId: "",
    note: note.trim().slice(0, 120),
    actor: normalizeEmail(actor),
    createdAt: new Date().toISOString(),
  };
  const { error } = await getDb().from(TABLES.loyaltyStamps).insert(row);
  checkErr(error, "addCounterStamp");
  return row;
}
