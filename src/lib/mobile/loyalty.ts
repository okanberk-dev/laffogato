import "server-only";

import type { DbError } from "@/lib/db";

import {
  customerLoyaltyOrders,
  getSettings,
  orderChannel,
  orderKind,
  type AdminOrder,
} from "@/lib/admin/store";
import {
  listCustomerCoupons,
  withdrawUnusedCoupon,
  type CustomerCoupon,
} from "@/lib/customer/coupons";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { grantFreeDrinkCoupon } from "./free-drink";
import { rewardInviteOnFirstPaidOrder } from "./invite";
import { clawBackMilestoneGifts, grantMilestoneGifts } from "./milestones";
import {
  buildLoyaltyView,
  computeStampBalance,
  freeDrinkRewardFor,
  plannedStampReversals,
  plannedWithdrawals,
  rewardReadyAt,
  stampsByOrder,
  stampsForOrder,
  stampTargetForOrder,
  unredeemId,
  type LoyaltyRules,
  type LoyaltyStamp,
  type LoyaltyView,
} from "./loyalty-core";

/**
 * Loyalty ledger (docs/API-MOBILE.md §3, §4, §5).
 *
 * Append-only `loyalty_stamps`: an `earn` row per till stamp and one per
 * paid app cafe order (its delta is the order's stamp count), a `redeem` row
 * per reward. Balances are always recomputed from the ledger, never stored - a
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

/**
 * The `/me.loyalty` block for a member.
 *
 * `rules` lets a caller that has already read the settings in this request
 * hand them over (`buildMe` does): the settings row is otherwise read twice
 * per `/me`, one more round trip on a pool of `max: 1`. Same request, same
 * row - nothing is cached across requests.
 */
export async function getLoyalty(
  email: string,
  rules?: LoyaltyRules,
): Promise<LoyaltyView> {
  const owner = normalizeEmail(email);
  // Three columns, not `select *`: the tier counts a rolling year and the
  // badges read a lifetime, so this read cannot be paged - but it does not
  // need the refund ledger, the consent evidence or the shipping address of
  // every order the member ever placed either.
  const [stamps, orders, live] = await Promise.all([
    listStamps(owner),
    customerLoyaltyOrders(owner),
    rules ?? loyaltyRules(),
  ]);
  return buildLoyaltyView(stamps, orders, Date.now(), live.stampTarget);
}

/**
 * How many stamps each of the member's orders holds - one ledger read, for the
 * whole `/orders` list. The wire field `stampsEarned` is answered from this
 * rather than from the order's status; see `stampsEarnedFor` in
 * `./order-mapper.ts`.
 */
export async function getOrderStamps(
  email: string,
): Promise<ReadonlyMap<string, number>> {
  return stampsByOrder(await listStamps(email));
}

export interface RewardStatus {
  /** Full cards waiting to be turned into a coupon. */
  rewardsReady: number;
  /** When the newest of them filled up; null when none is waiting. */
  readyAt: string | null;
}

/**
 * What the inbox needs about the member's rewards: how many are waiting and
 * since when. The instant has to be stable across calls - the app decides
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
 * - An app cafe order earns `stampsForOrder` stamps (none under ₺140 of goods,
 *   then one per started ₺320; operator, 15 Eki 2026), written as ONE `earn`
 *   row whose delta is that count. The partial unique index on `orderId`
 *   makes a duplicate webhook a 23505 that is swallowed here, so the stamps
 *   are earned exactly once. A delta above 1 can fill one card or several:
 *   the balance is read from the ledger (`computeStampBalance`), so every
 *   full card is a reward waiting for `redeemStamps` and the rest carries
 *   over, and every milestone the new lifetime count passes is given.
 * - The customer's first paid order settles a pending invite: both the
 *   inviter and the invitee receive a free-drink coupon (§5).
 *
 * Never throws for a business reason; a database failure propagates so the
 * caller's own error handling sees it.
 */
export async function onOrderPaid(order: AdminOrder): Promise<void> {
  const owner = normalizeEmail(order.customerEmail);
  if (!owner || owner === "guest@laffogato.local") return;

  const stamps =
    orderChannel(order) === "app" && orderKind(order) === "cafe"
      ? stampsForOrder(order)
      : 0;
  if (stamps > 0) {
    const row: LoyaltyStamp = {
      id: await newStampId(),
      customerEmail: owner,
      kind: "earn",
      delta: stamps,
      source: "order",
      orderId: order.id,
      note: `Sipariş #${order.orderNo}`,
      actor: "",
      createdAt: new Date().toISOString(),
    };
    const { error } = await getDb().from(TABLES.loyaltyStamps).insert(row);
    // 23505 on loyalty_stamps_order_key: this order already earned its stamps.
    if (error && error.code !== "23505") checkErr(error, "onOrderPaid.earn");
    await giveMilestones(owner);
  }

  await rewardInviteOnFirstPaidOrder(owner, {
    kind: orderKind(order),
    totalMinor: order.totalMinor,
    shippingMinor: order.shippingMinor,
    discountMinor: order.discountMinor,
  });
}

export interface OrderReversalOptions {
  /**
   * The order is undone as a whole (cancelled, or refunded in full): it keeps
   * no stamp, whatever its refund entries add up to.
   */
  full?: boolean;
}

/**
 * Brings an order's stamps down to what it may still hold after a refund or
 * a cancel, and settles what that leaves the member owing. Called after
 * EVERY refund (the admin path, the provider's webhook) and on a cancel.
 *
 * - The target is `stampTargetForOrder`: `stampsFor(goods − refunded goods)`
 *   (refunds are charged to the goods first - an `AdminRefund` does not say
 *   what part was courier fee; see `stampRefundedGoodsMinor`), and 0 for a
 *   cancelled or fully refunded order or when `full` is set. A ₺700 order
 *   (3 stamps) refunded ₺100 keeps 2, then another ₺300 keeps 1, then the
 *   rest keeps none.
 * - Each stamp above the target is taken back with its own `reversal` row
 *   (delta −1) whose id is derived from the order and the stamp
 *   (`stampReversalId`). A retry finds its rows already there; two refunds
 *   settled at the same moment insert overlapping ids and the primary key
 *   keeps one row per stamp (23505, ignored), so the order ends at exactly
 *   the lower of the two targets. The ledger stays append-only: the history
 *   still shows the earn and every take-back.
 * - Stamps only ever go down here. A refund the POS refuses is released
 *   before its own path settles any stamp, but a second refund settled in
 *   that short window still counts it; a stamp taken that way stays taken,
 *   and the operator can give it back as a till stamp.
 * - Then `settleLoyaltyDebt`: when the reversed stamps had already paid for a
 *   free-drink coupon or reached a milestone gift, the unused ones are taken
 *   back. It runs on every call, even when no new row was written, so a
 *   retry also finishes a settlement that stopped half-way; it only ever
 *   takes coupons for stamps order reversals actually took back
 *   (`reversalDebt`), so a call that reversed nothing cannot take a coupon
 *   on its own.
 *
 * Pay → earn → ask for a refund (in full or in parts) was a way to collect
 * free drinks; this closes both doors.
 */
export async function onOrderReversed(
  order: AdminOrder,
  opts: OrderReversalOptions = {},
): Promise<void> {
  const owner = normalizeEmail(order.customerEmail);
  if (!owner || owner === "guest@laffogato.local") return;

  const stamps = await listStamps(owner);
  if (!stamps.some((s) => s.orderId === order.id && s.kind === "earn")) return;

  const target = stampTargetForOrder(order, opts);
  const ids = plannedStampReversals(stamps, order.id, target);
  const full = target === 0;
  const db = getDb();
  for (const id of ids) {
    const row: LoyaltyStamp = {
      id,
      customerEmail: owner,
      kind: "reversal",
      delta: -1,
      source: "order",
      orderId: order.id,
      note: full
        ? `Sipariş #${order.orderNo} iade/iptal`
        : `Sipariş #${order.orderNo} kısmi iade`,
      actor: "",
      createdAt: new Date().toISOString(),
    };
    const { error } = await db.from(TABLES.loyaltyStamps).insert(row);
    // 23505: this stamp was taken back already (a retry, or a concurrent
    // refund of the same order).
    if (error && error.code !== "23505") checkErr(error, "onOrderReversed");
  }

  await settleLoyaltyDebt(owner);
}

/**
 * What a reversal leaves the member owing, settled against what they were
 * given for it (option (c) of the 16 Eki 2026 review).
 *
 * Stamps are paid out at `paid`, so by the time an order is refunded or
 * cancelled its stamps may already have filled a card the member redeemed
 * (`redeemStamps` → a free-drink coupon) and reached a milestone gift
 * (`grantMilestoneGifts`). The reversal alone only wrote negative stamps: the
 * coupons stayed live and `available` clamped at 0 hid the hole.
 *
 * 1. Free drinks. While reversals left a debt (`reversalDebt`: the redeemed
 *    cards cost more than the stamps left, priced both at the current card
 *    and at what each card cost, and never more than order reversals took
 *    back), one `redeem` row per card the stamps no longer cover is
 *    withdrawn, newest first (`plannedWithdrawals`), and for each the newest
 *    UNUSED, unexpired `loyalty` coupon is taken back (`withdrawUnusedCoupon`). The withdrawal
 *    is an `unredeem` row with a deterministic id - written FIRST, so two
 *    settlements running together pick the same row and only one of them
 *    goes on to take a coupon. When no unused coupon is left to take (the
 *    member already drank it, or let it expire) the `unredeem` row is
 *    removed again and the debt stays on the ledger: `available` is
 *    `max(0, lifetime − target × redeemed)` with `redeemed` counting only
 *    the cards whose coupon still stands, so the stamps earned next pay the
 *    debt off before a new card fills. Used coupons stay used.
 *    A coupon held by an order that is not paid yet counts as used here
 *    (`redeemedAt` is set when the order is created). If that order is
 *    cancelled the coupon comes back unused, and `releaseOrderInventory`
 *    (admin store) calls this again so it is taken back then.
 * 2. Milestones. Every milestone above the new lifetime whose gift is still
 *    unused is clawed back (`clawBackMilestoneGifts`): coupon withdrawn,
 *    claim row dropped, so it can be earned again later.
 *
 * Coupons of any other source (welcome, birthday, invite, manual, review)
 * are never touched.
 */
export async function settleLoyaltyDebt(email: string): Promise<void> {
  const owner = normalizeEmail(email);
  if (!owner) return;
  const rules = await loyaltyRules();
  const target = rules.stampTarget;
  const db = getDb();

  let rows = await listStamps(owner);
  let coupons: CustomerCoupon[] | null = null;
  const withdrawals = plannedWithdrawals(rows, target);
  if (withdrawals.length > 0) {
    coupons = await listCustomerCoupons(owner);
    const nowMs = Date.now();
    // Newest first - the coupon the member received last is the one the
    // reversed stamps paid for, as far as anything can tell.
    const candidates = coupons
      .filter(
        (c) =>
          c.source === "loyalty" &&
          c.isActive &&
          !c.redeemedAt &&
          !(c.expiresAt && Date.parse(c.expiresAt) < nowMs),
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? b.id.localeCompare(a.id)
          : b.createdAt.localeCompare(a.createdAt),
      );
    for (const { redeemId, cost } of withdrawals) {
      const row: LoyaltyStamp = {
        id: unredeemId(redeemId),
        customerEmail: owner,
        kind: "unredeem",
        delta: cost,
        source: "order",
        orderId: "",
        note: "Ödül geri alındı: damgaları iade/iptal edildi",
        actor: "",
        createdAt: new Date().toISOString(),
      };
      const ins = await db.from(TABLES.loyaltyStamps).insert(row);
      // 23505: a concurrent settlement claimed this card; it takes the coupon.
      if (ins.error?.code === "23505") continue;
      checkErr(ins.error, "settleLoyaltyDebt.unredeem");

      let taken: CustomerCoupon | null = null;
      while (candidates.length > 0 && !taken) {
        const next = candidates.shift()!;
        if (await withdrawUnusedCoupon(next.id, owner, "loyalty")) taken = next;
      }
      if (!taken) {
        // Nothing unused left to take back: the card stays redeemed and the
        // debt stays on the ledger for the next stamps to pay.
        const del = await db
          .from(TABLES.loyaltyStamps)
          .delete()
          .eq("id", row.id);
        checkErr(del.error, "settleLoyaltyDebt.keep");
        break;
      }
      const upd = await db
        .from(TABLES.loyaltyStamps)
        .update({ note: `${row.note} (${taken.code})` })
        .eq("id", row.id);
      if (upd.error) {
        console.error("[loyalty] unredeem note not updated", upd.error);
      }
    }
    rows = await listStamps(owner);
  }

  const lifetime = computeStampBalance(rows, target).lifetimeStamps;
  await clawBackMilestoneGifts(owner, lifetime, coupons ?? undefined);
}

export type RedeemStampsResult =
  | { ok: true; coupon: CustomerCoupon; loyalty: LoyaltyView }
  | { ok: false; error: "not_enough_stamps"; stampTarget: number };

/**
 * Turns a full card of stamps into a free-drink coupon (`POST /loyalty/redeem`).
 * The card size and the coupon come from the configured rules, read once at
 * the top so the check, the ledger row and the coupon all use the same deal.
 *
 * The balance check and the ledger write are not one statement, so two
 * simultaneous redeems could both pass the check. The write is therefore
 * verified afterwards: if the ledger has gone negative, this request's redeem
 * row is withdrawn and the request fails - the coupon is only granted once
 * the redeem row is known to be covered.
 */
export async function redeemStamps(email: string): Promise<RedeemStampsResult> {
  const owner = normalizeEmail(email);
  const rules = await loyaltyRules();
  const target = rules.stampTarget;
  const reward = freeDrinkRewardFor(rules);
  const before = computeStampBalance(await listStamps(owner), target);
  if (before.available < target) {
    return { ok: false, error: "not_enough_stamps", stampTarget: target };
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
    return { ok: false, error: "not_enough_stamps", stampTarget: target };
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
  { ok: true; stamp: LoyaltyStamp } | { ok: false; error: "no_stamps" };

/**
 * Takes back a stamp given by mistake at the till (admin panel, "−1 düzeltme").
 *
 * `onOrderReversed` covers the other case - an order that was refunded or
 * cancelled - and is keyed on the order, so it cannot undo a counter stamp,
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
  await giveMilestones(owner);
  return row;
}

/**
 * The milestone gifts a new stamp may have reached (karar 175). Never
 * allowed to fail the stamp itself: an order is paid and a till stamp is
 * given whatever happens here, and the next stamp retries a gift that did
 * not go through (the claim row is withdrawn on failure).
 */
async function giveMilestones(owner: string): Promise<void> {
  try {
    const rules = await loyaltyRules();
    const lifetime = computeStampBalance(
      await listStamps(owner),
      rules.stampTarget,
    ).lifetimeStamps;
    await grantMilestoneGifts(owner, lifetime);
  } catch (err) {
    console.error("[milestones] grant failed", err);
  }
}
