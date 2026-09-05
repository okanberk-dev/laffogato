import "server-only";

import type { DbError } from "@/lib/db";

import {
  customerOrdersByEmail,
  getSettings,
  orderChannel,
  orderKind,
  type AdminOrder,
} from "@/lib/admin/store";
import type { CustomerCoupon } from "@/lib/customer/coupons";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { grantFreeDrinkCoupon } from "./free-drink";
import { rewardInviteOnFirstPaidOrder } from "./invite";
import {
  buildLoyaltyView,
  computeStampBalance,
  freeDrinkRewardFor,
  rewardReadyAt,
  stampedOrderIds,
  type LoyaltyRules,
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
  stampedOrderIds,
  STAMP_TARGET,
  type LoyaltyStamp,
  type LoyaltyView,
} from "./loyalty-core";

function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * The operator's loyalty rules (card size, reward). Read per request, never
 * cached here: the admin page promises "the app sees it within 5 minutes"
 * and the ledger arithmetic must agree with the card the app draws.
 */
async function loyaltyRules(): Promise<LoyaltyRules> {
  const { mobileApp } = await getSettings();
  return mobileApp.loyalty;
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
  const [stamps, orders, rules] = await Promise.all([
    listStamps(owner),
    customerOrdersByEmail(owner),
    loyaltyRules(),
  ]);
  return buildLoyaltyView(stamps, orders, Date.now(), rules.stampTarget);
}

/**
 * The member's orders that hold a stamp — one ledger read, for the whole
 * `/orders` list. The wire field `stampsEarned` is answered from this rather
 * than from the order's status; see `stampsEarnedFor` in `./order-mapper.ts`.
 */
export async function getStampedOrderIds(
  email: string,
): Promise<ReadonlySet<string>> {
  return stampedOrderIds(await listStamps(email));
}

export interface RewardStatus {
  /** Full cards waiting to be turned into a coupon. */
  rewardsReady: number;
  /** When the newest of them filled up; null when none is waiting. */
  readyAt: string | null;
}

/**
 * What the inbox needs about the member's rewards: how many are waiting and
 * since when. The instant has to be stable across calls — the app decides
 * "unread" by comparing it with the moment the member last opened the inbox.
 */
export async function getRewardStatus(email: string): Promise<RewardStatus> {
  const owner = normalizeEmail(email);
  const [stamps, rules] = await Promise.all([
    listStamps(owner),
    loyaltyRules(),
  ]);
  const target = rules.stampTarget;
  return {
    rewardsReady: computeStampBalance(stamps, target).rewardsReady,
    readyAt: rewardReadyAt(stamps, target),
  };
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
 * Turns a full card of stamps into a free-drink coupon (`POST /loyalty/redeem`).
 * The card size and the coupon come from the configured rules, read once at
 * the top so the check, the ledger row and the coupon all use the same deal.
 *
 * The balance check and the ledger write are not one statement, so two
 * simultaneous redeems could both pass the check. The write is therefore
 * verified afterwards: if the ledger has gone negative, this request's redeem
 * row is withdrawn and the request fails — the coupon is only granted once
 * the redeem row is known to be covered.
 */
export async function redeemStamps(email: string): Promise<RedeemStampsResult> {
  const owner = normalizeEmail(email);
  const rules = await loyaltyRules();
  const target = rules.stampTarget;
  const reward = freeDrinkRewardFor(rules);
  const before = computeStampBalance(await listStamps(owner), target);
  if (before.available < target) {
    return { ok: false, error: "not_enough_stamps" };
  }

  const db = getDb();
  const id = await newStampId();
  const now = new Date().toISOString();
  const redeemRow: LoyaltyStamp = {
    id,
    customerEmail: owner,
    kind: "redeem",
    delta: -target,
    source: "app",
    orderId: "",
    note: reward.title,
    actor: "",
    createdAt: now,
  };
  const ins = await db.from(TABLES.loyaltyStamps).insert(redeemRow);
  checkErr(ins.error, "redeemStamps.insert");

  const after = computeStampBalance(await listStamps(owner), target);
  if (after.lifetimeStamps - target * after.redeemCount < 0) {
    // Lost the race: another redeem took the stamps first. Withdraw ours.
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.rollback");
    return { ok: false, error: "not_enough_stamps" };
  }

  let coupon: CustomerCoupon;
  try {
    coupon = await grantFreeDrinkCoupon(owner, "loyalty", reward);
  } catch (err) {
    // The stamps were spent for a coupon that never existed. Give them back
    // and let the caller fail loudly, rather than leaving the member a card
    // poorer with nothing to show for it.
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.grantRollback");
    throw err;
  }
  return { ok: true, coupon, loyalty: await getLoyalty(owner) };
}

export type ReverseCounterStampResult =
  | { ok: true; stamp: LoyaltyStamp }
  | { ok: false; error: "no_stamps" };

/**
 * Takes back a stamp given by mistake at the till (admin panel, "−1 düzeltme").
 *
 * `onOrderReversed` covers the other case — an order that was refunded or
 * cancelled — and is keyed on the order, so it cannot undo a counter stamp,
 * which has no order. Like every correction here this appends a `reversal`
 * row instead of deleting the `earn`: the ledger stays append-only, and it
 * still shows both the mistake and who fixed it.
 *
 * Refused when the member has no stamp left to take back, so a repeated click
 * cannot push the balance below zero and swallow a card the member later
 * earns honestly.
 */
export async function reverseCounterStamp(
  email: string,
  actor: string,
  note = "",
): Promise<ReverseCounterStampResult> {
  const owner = normalizeEmail(email);
  if (!owner) throw new Error("reverseCounterStamp: e-mail required");
  const rules = await loyaltyRules();
  const balance = computeStampBalance(
    await listStamps(owner),
    rules.stampTarget,
  );
  if (balance.available <= 0) return { ok: false, error: "no_stamps" };

  const row: LoyaltyStamp = {
    id: await newStampId(),
    customerEmail: owner,
    kind: "reversal",
    delta: -1,
    source: "admin",
    orderId: "",
    note: note.trim().slice(0, 120) || "Kasa damgası düzeltmesi",
    actor: normalizeEmail(actor),
    createdAt: new Date().toISOString(),
  };
  const { error } = await getDb().from(TABLES.loyaltyStamps).insert(row);
  checkErr(error, "reverseCounterStamp");
  return { ok: true, stamp: row };
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
