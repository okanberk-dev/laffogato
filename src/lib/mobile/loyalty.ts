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
  freeDrinkCouponId,
  freeDrinkRewardFor,
  nextFreeDrinkWithdrawal,
  plannedStampReversals,
  rewardReadyAt,
  stampCoverage,
  staleFreeDrinkClaims,
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
 * - The target is `stampTargetForOrder`: `stampsFor(goods − refunded goods)`,
 *   where a refund is counted against the courier fee first and only the
 *   rest against the goods (an `AdminRefund` cannot be split; see
 *   `stampRefundedGoodsMinor`), and 0 for a cancelled or fully refunded
 *   order or when `full` is set. A ₺700 order (3 stamps) refunded ₺100 keeps
 *   2, then another ₺300 keeps 1, then the rest keeps none.
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
 * - Then `settleLoyaltyDebt`, but only for an order that has had stamps
 *   taken back (by this call, or by an earlier one whose settlement a retry
 *   now finishes). A refund that reverses nothing on an order that never
 *   gave a stamp back - a ₺1 goodwill refund - settles nothing.
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

  const reversedBefore = stamps.some(
    (s) => s.orderId === order.id && s.kind === "reversal",
  );
  if (ids.length > 0 || reversedBefore) await settleLoyaltyDebt(owner);
}

/** Upper bound on settlement rounds; each round withdraws or yields. */
const MAX_SETTLE_ROUNDS = 64;

/**
 * Whether the member has spent the coupon (or an unpaid order is holding it):
 * read afresh, because the decision it feeds drops a ledger row.
 */
async function couponIsSpent(
  owner: string,
  couponId: string,
): Promise<boolean> {
  const coupon = (await listCustomerCoupons(owner)).find(
    (c) => c.id === couponId,
  );
  return Boolean(coupon?.redeemedAt);
}

/**
 * Takes back unused free drinks the stamps no longer cover, one per round,
 * and finishes the withdrawals an earlier settlement left half done:
 *
 * 1. Read the coupons, then the ledger (in that order: a coupon is minted
 *    after its `redeem` row is written, so a coupon read first always finds
 *    its row in the ledger read after it). First drop the stale claims
 *    (`staleFreeDrinkClaims`); otherwise `nextFreeDrinkWithdrawal` names the
 *    coupon to take - an orphan, a half-done withdrawal (its card already
 *    unredeemed), or while `stampCoverage < 0` the newest unused, unexpired
 *    free drink - or nothing.
 * 2. Claim the card, unless it is claimed already: an `unredeem` row with the
 *    idempotent id `unredeemId(card)` carrying the card's cost. A concurrent
 *    settlement that claimed it first wins (23505) and this one reads again.
 * 3. Take the coupon (`withdrawUnusedCoupon`, guarded on unused + active).
 *    Failing that, read the coupon again. If the member spent it at the
 *    checkout a moment earlier the claim is dropped and the next round looks
 *    afresh - re-reading the coupons after the drop is what keeps a redeem
 *    landing in that moment from slipping through. If it is merely inactive
 *    or gone, a concurrent settlement took it and its claim is that
 *    settlement's: it stays.
 *
 * Two writes make a withdrawal (claim, coupon), so one can land without the
 * other. A claim without its coupon taken is picked up by the next run
 * (step 1 sees an unused coupon on an unredeemed card, whatever the coverage
 * is by then); a claim on a coupon spent since is dropped by it. Whichever
 * trigger runs next - a retried cancel, a refund webhook, a redeem, a
 * released coupon, a till correction - therefore finishes the job.
 *
 * Stops when nothing is left to take; what is still owed then is paid by the
 * next stamps (the balance shows 0 meanwhile). Used coupons are never
 * touched. Returns the ids of the coupons it took back.
 */
async function settleFreeDrinks(owner: string): Promise<string[]> {
  const db = getDb();
  const taken: string[] = [];
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    const coupons = await listCustomerCoupons(owner);
    const rows = await listStamps(owner);

    const stale = staleFreeDrinkClaims(rows, coupons);
    if (stale.length > 0) {
      for (const claim of stale) {
        if (!(await couponIsSpent(owner, claim.couponId))) continue;
        const del = await db
          .from(TABLES.loyaltyStamps)
          .delete()
          .eq("id", unredeemId(claim.redeemId));
        checkErr(del.error, "settleFreeDrinks.staleClaim");
      }
      continue;
    }

    const next = nextFreeDrinkWithdrawal(rows, coupons, Date.now());
    if (!next) return taken;

    const claimId = unredeemId(next.redeemId);
    if (next.redeemId && !next.claimed) {
      const claim: LoyaltyStamp = {
        id: claimId,
        customerEmail: owner,
        kind: "unredeem",
        delta: next.cost,
        source: "order",
        orderId: "",
        note: "Ödül geri alındı: damgaları iade/iptal edildi",
        actor: "",
        createdAt: new Date().toISOString(),
      };
      const ins = await db.from(TABLES.loyaltyStamps).insert(claim);
      // 23505: a concurrent settlement claimed this card; it takes the coupon.
      if (ins.error?.code === "23505") continue;
      checkErr(ins.error, "settleFreeDrinks.unredeem");
    }

    if (await withdrawUnusedCoupon(next.couponId, owner, "loyalty")) {
      taken.push(next.couponId);
      continue;
    }
    // Not taken by us. Spent in the meantime: the card stands, so the claim
    // goes. Anything else (taken by a concurrent settlement, revoked by an
    // admin): the coupon is gone and the claim stays with it.
    if (next.redeemId && (await couponIsSpent(owner, next.couponId))) {
      const del = await db
        .from(TABLES.loyaltyStamps)
        .delete()
        .eq("id", claimId);
      checkErr(del.error, "settleFreeDrinks.release");
    }
  }
  console.error(
    `[loyalty] settlement stopped after ${MAX_SETTLE_ROUNDS} rounds`,
  );
  return taken;
}

/**
 * Settles what reversed stamps leave the member owing against what they
 * were given for them. Runs whenever stamps are reversed
 * (`onOrderReversed`, `reverseCounterStamp`) and whenever a held coupon is
 * handed back (`releaseOrderInventory` in the admin store, after an unpaid
 * order lets go of it); `redeemStamps` runs the free-drink half after minting
 * a coupon. Every run also finishes what an earlier one left half done (see
 * `settleFreeDrinks`), whether or not anything is owed now.
 *
 * 1. Free drinks (`settleFreeDrinks`): while
 *    `covered = lifetime − Σ cost of the standing cards` is negative, the
 *    newest unused, unexpired free drink is taken back and its card marked
 *    unredeemed. A card's cost is what its own `redeem` row consumed, never
 *    the current `stampTarget`, so changing the card size can never make a
 *    member owe anything. A coupon held by an unpaid order counts as used
 *    (`redeemedAt` is set when the order is created); if that order is
 *    cancelled the coupon comes back unused and the release runs this again.
 * 2. Milestones. Every milestone above the new lifetime whose gift is still
 *    unused is clawed back (`clawBackMilestoneGifts`): coupon withdrawn,
 *    claim row dropped, so it can be earned again later. A used gift keeps
 *    its claim.
 *
 * Coupons of any other source (welcome, birthday, invite, manual, review)
 * are never touched. Safe to run any number of times: with nothing owed it
 * takes nothing.
 */
export async function settleLoyaltyDebt(email: string): Promise<void> {
  const owner = normalizeEmail(email);
  if (!owner) return;
  await settleFreeDrinks(owner);
  const lifetime = computeStampBalance(await listStamps(owner)).lifetimeStamps;
  await clawBackMilestoneGifts(owner, lifetime);
}

/** Deletes a `redeem` row nobody owns a coupon for; never throws. */
async function dropRedeemRowBestEffort(id: string): Promise<void> {
  try {
    const del = await getDb().from(TABLES.loyaltyStamps).delete().eq("id", id);
    if (del.error) console.error("[loyalty] redeem rollback", del.error);
  } catch (err) {
    console.error("[loyalty] redeem rollback", err);
  }
}

export type RedeemStampsResult =
  | { ok: true; coupon: CustomerCoupon; loyalty: LoyaltyView }
  | { ok: false; error: "not_enough_stamps"; stampTarget: number };

/**
 * Turns a full card of stamps into a free-drink coupon (`POST /loyalty/redeem`).
 * The card size and the coupon come from the configured rules, read once at
 * the top so the check, the ledger row and the coupon all use the same deal.
 *
 * The check, the ledger row and the coupon are not one statement, so the
 * result is verified twice:
 *
 * - After the `redeem` row: if the stamps no longer cover the standing cards
 *   (`stampCoverage < 0`: a concurrent redeem, or a reversal), the row is
 *   removed again and the request fails before any coupon exists.
 * - After the coupon: a reversal can still land between the row and the
 *   coupon, and its settlement finds no unused coupon to take back yet. So
 *   the free-drink settlement runs here too, under the same rule; if it
 *   takes this coupon back, the request fails with `not_enough_stamps`.
 *
 * A request that dies between the row and the coupon gives the stamps back:
 * the row is deleted, and the coupon too if its insert had committed with
 * the answer lost (withdrawn by its id; should that fail as well, the next
 * settlement takes it, see `nextFreeDrinkWithdrawal`). So does a row whose
 * own insert got no answer.
 *
 * The coupon's id is `freeDrinkCouponId(redeem row)`, which is how a
 * settlement finds what each card cost.
 */
export async function redeemStamps(email: string): Promise<RedeemStampsResult> {
  const owner = normalizeEmail(email);
  const rules = await loyaltyRules();
  const target = rules.stampTarget;
  const reward = freeDrinkRewardFor(rules);
  const refused = {
    ok: false as const,
    error: "not_enough_stamps" as const,
    stampTarget: target,
  };
  const before = computeStampBalance(await listStamps(owner), target);
  if (before.available < target) return refused;

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
  if (ins.error?.code === "") {
    // The request never got an answer: the row may or may not have landed.
    // It is ours alone (a sequence id) and no coupon exists for it yet.
    await dropRedeemRowBestEffort(id);
  }
  checkErr(ins.error, "redeemStamps.insert");

  let coverage: number;
  try {
    coverage = stampCoverage(await listStamps(owner));
  } catch (err) {
    await dropRedeemRowBestEffort(id);
    throw err;
  }
  if (coverage < 0) {
    // Lost a race: the stamps went elsewhere first. Withdraw our row.
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.rollback");
    return refused;
  }

  const couponId = freeDrinkCouponId(id);
  let coupon: CustomerCoupon;
  try {
    coupon = await grantFreeDrinkCoupon(owner, "loyalty", reward, couponId);
  } catch (err) {
    // The stamps were spent for a coupon that never existed - or did: the
    // insert may have committed with its answer lost. Take that coupon back
    // by its id first (best effort), or it would outlive the row about to be
    // deleted and be a free drink for nothing. Then give the stamps back and
    // let the caller fail loudly, rather than leaving the member a card
    // poorer with nothing to show for it. Should the withdrawal fail too, the
    // next settlement takes the orphan (`nextFreeDrinkWithdrawal`).
    try {
      await withdrawUnusedCoupon(couponId, owner, "loyalty");
    } catch (withdrawErr) {
      console.error(
        "[loyalty] redeem rollback: coupon withdrawal",
        withdrawErr,
      );
    }
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", id);
    checkErr(del.error, "redeemStamps.grantRollback");
    throw err;
  }

  const taken = await settleFreeDrinks(owner);
  const mine = (await listCustomerCoupons(owner)).find(
    (c) => c.id === coupon.id,
  );
  // Taken back by this settlement or a concurrent one: not covered.
  if (taken.includes(coupon.id) || (mine && !mine.isActive)) return refused;
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
 * earns honestly. Like any reversal it then settles (`settleLoyaltyDebt`):
 * the lifetime count fell, so a milestone gift above it is taken back.
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
  const db = getDb();
  const { error } = await db.from(TABLES.loyaltyStamps).insert(row);
  checkErr(error, "reverseCounterStamp");

  // The check above and the row are not one statement: two clicks at once
  // can both pass it. Read the coverage again with our row in; if it dips
  // below zero the stamps went below what the standing cards cost, so this
  // correction takes more than the member had left. Withdraw our row (both
  // clicks do, when both rows are in: the operator clicks once more) rather
  // than settle by taking the member's free drink for it.
  if (stampCoverage(await listStamps(owner)) < 0) {
    const del = await db.from(TABLES.loyaltyStamps).delete().eq("id", row.id);
    checkErr(del.error, "reverseCounterStamp.rollback");
    return { ok: false, error: "no_stamps" };
  }

  // Lifetime went down by one: a milestone gift above it goes back, and a
  // free drink the stamps no longer cover with it. The correction itself is
  // done; a settlement that fails here is finished by the next trigger, and
  // must not make the operator click again (a second stamp would go).
  try {
    await settleLoyaltyDebt(owner);
  } catch (err) {
    console.error("[loyalty] settlement after till correction failed", err);
  }
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
