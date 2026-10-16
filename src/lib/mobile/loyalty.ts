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
  abandonedCards,
  buildLoyaltyView,
  cardCost,
  computeStampBalance,
  couponlessCards,
  freeDrinkCouponId,
  freeDrinkRewardFor,
  nextFreeDrinkWithdrawal,
  orphanClaimIds,
  plannedStampReversals,
  rewardReadyAt,
  stampCoverage,
  staleFreeDrinkClaims,
  stampsByOrder,
  stampsForOrder,
  stampTargetForOrder,
  tillCorrectionId,
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

/** Statements a compensation tries before it gives up (see `attempt`). */
const COMPENSATION_ATTEMPTS = 3;

/**
 * Runs a compensating write up to `COMPENSATION_ATTEMPTS` times and never
 * throws. The usual failure is a dropped connection, and the pool opens a
 * fresh one for the next statement, so trying again is what a retry is for.
 * Every compensation passed here is idempotent: deleting a row that is gone,
 * or withdrawing a coupon that is no longer unused, matches nothing and
 * succeeds, which is also how an answer lost after a commit resolves.
 * Returns whether one attempt went through.
 */
async function attempt(
  label: string,
  write: () => Promise<void>,
): Promise<boolean> {
  for (let i = 1; i <= COMPENSATION_ATTEMPTS; i += 1) {
    try {
      await write();
      return true;
    } catch (err) {
      console.error(`[loyalty] ${label} (attempt ${i})`, err);
    }
  }
  return false;
}

/**
 * Deletes one ledger row by id, with retries; true once it is known to be
 * gone. `createdAt` narrows the delete to the caller's own row when the id is
 * shared (a till correction's id is the same for every click that read the
 * same ledger).
 */
async function dropLedgerRow(id: string, createdAt?: string): Promise<boolean> {
  return attempt(`drop ledger row ${id}`, async () => {
    let q = getDb().from(TABLES.loyaltyStamps).delete().eq("id", id);
    if (createdAt !== undefined) q = q.eq("createdAt", createdAt);
    checkErr((await q).error, "dropLedgerRow");
  });
}

/**
 * Writes a card's `unredeem` row. False: 23505, a concurrent settlement wrote
 * it first.
 */
async function writeClaim(
  owner: string,
  redeemId: string,
  cost: number,
): Promise<boolean> {
  const claim: LoyaltyStamp = {
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
  const ins = await getDb().from(TABLES.loyaltyStamps).insert(claim);
  if (ins.error?.code === "23505") return false;
  checkErr(ins.error, "settleFreeDrinks.unredeem");
  return true;
}

/**
 * A claim and a coupon withdrawal are two writes, and a stale settlement's
 * claim delete can land between them. Whoever takes a coupon, and whoever
 * drops a claim, therefore looks again afterwards: a coupon that is
 * withdrawn and unused while its card still stands with no claim is a
 * withdrawal with its claim missing, and the claim is written back. One of
 * the two parties always looks last, so one stamp of debt never costs two
 * free drinks (the stamps would otherwise be "burned" for a dead coupon, and
 * the next settlement would take a second coupon for the same debt).
 *
 * `couponId` null: the caller has just withdrawn the coupon itself.
 */
async function restoreClaim(
  owner: string,
  redeemId: string,
  couponId: string | null,
): Promise<void> {
  if (couponId !== null) {
    const coupon = (await listCustomerCoupons(owner)).find(
      (c) => c.id === couponId,
    );
    if (!coupon || coupon.isActive || coupon.redeemedAt) return;
  }
  const rows = await listStamps(owner);
  const card = rows.find((r) => r.id === redeemId && r.kind === "redeem");
  if (!card || rows.some((r) => r.id === unredeemId(redeemId))) return;
  await writeClaim(owner, redeemId, cardCost(card));
}

/** Drops the claim on a card whose coupon the member spent, then looks again. */
async function dropSpentClaim(
  owner: string,
  redeemId: string,
  couponId: string,
): Promise<void> {
  const del = await getDb()
    .from(TABLES.loyaltyStamps)
    .delete()
    .eq("id", unredeemId(redeemId));
  checkErr(del.error, "settleFreeDrinks.staleClaim");
  await restoreClaim(owner, redeemId, couponId);
}

/**
 * Heals what a dead request left in the ledger and returns the ledger this
 * round decides on.
 *
 * - A claim whose `redeem` row is gone is dropped (`orphanClaimIds`).
 * - An app `redeem` row with no coupon, older than the grace window, is
 *   dropped (`abandonedCards`): the stamps come back and the row stops
 *   counting as a standing card. A redeem in flight is younger than the
 *   window and is never deleted; the coupons are read once more right before
 *   deciding, so a coupon that landed after this settlement's first read
 *   keeps its card. A redeem slower than the window loses its row; the coupon
 *   it then creates is an orphan, taken at once by its own settlement, and
 *   the stamps stay the member's.
 * - Every card with no coupon, young or old, and every claim without a card
 *   is left out of the returned ledger, also when a delete failed (the next
 *   trigger deletes again): a settlement covers cards that have a coupon, and
 *   never takes a real free drink for one that has none. An in-flight redeem
 *   settles itself once its coupon exists (`redeemStamps`).
 */
async function healLedger(
  owner: string,
  rows: LoyaltyStamp[],
  coupons: CustomerCoupon[],
): Promise<LoyaltyStamp[]> {
  const orphans = orphanClaimIds(rows);
  const couponless = couponlessCards(rows, coupons);
  if (orphans.length === 0 && couponless.length === 0) return rows;

  const drop = new Set(orphans);
  if (abandonedCards(rows, coupons, Date.now()).length > 0) {
    const fresh = await listCustomerCoupons(owner);
    for (const card of abandonedCards(rows, fresh, Date.now())) {
      drop.add(card.id);
    }
  }
  for (const id of drop) await dropLedgerRow(id);
  const hide = new Set([...drop, ...couponless.map((c) => c.id)]);
  return rows.filter((r) => !hide.has(r.id));
}

/**
 * Takes back unused free drinks the stamps no longer cover, one per round,
 * and finishes the withdrawals an earlier settlement left half done:
 *
 * 1. Read the coupons, then the ledger (in that order: a coupon is minted
 *    after its `redeem` row is written, so a coupon read first always finds
 *    its row in the ledger read after it). Heal the ledger (`healLedger`).
 *    Then drop the stale claims (`staleFreeDrinkClaims`); otherwise
 *    `nextFreeDrinkWithdrawal` names the coupon to take - an orphan, a
 *    half-done withdrawal (its card already unredeemed), or while
 *    `stampCoverage < 0` the newest unused, unexpired free drink - or nothing.
 * 2. Claim the card, unless it is claimed already: an `unredeem` row with the
 *    idempotent id `unredeemId(card)` carrying the card's cost. A concurrent
 *    settlement that claimed it first wins (23505) and this one reads again.
 * 3. Take the coupon (`withdrawUnusedCoupon`, guarded on unused + active),
 *    then check the claim is still there (`restoreClaim`). Failing to take
 *    it, read the coupon again. If the member spent it at the checkout a
 *    moment earlier the claim is dropped and the next round looks afresh -
 *    re-reading the coupons after the drop is what keeps a redeem landing in
 *    that moment from slipping through - and the coupon is looked at once more
 *    (`dropSpentClaim`). If it is merely inactive or gone, a concurrent
 *    settlement took it and its claim is that settlement's: it stays.
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
  const taken: string[] = [];
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    const coupons = await listCustomerCoupons(owner);
    const rows = await healLedger(owner, await listStamps(owner), coupons);

    const stale = staleFreeDrinkClaims(rows, coupons);
    if (stale.length > 0) {
      for (const claim of stale) {
        if (!(await couponIsSpent(owner, claim.couponId))) continue;
        await dropSpentClaim(owner, claim.redeemId, claim.couponId);
      }
      continue;
    }

    const next = nextFreeDrinkWithdrawal(rows, coupons, Date.now());
    if (!next) return taken;

    // 23505: a concurrent settlement claimed this card; read again.
    if (
      next.redeemId &&
      !next.claimed &&
      !(await writeClaim(owner, next.redeemId, next.cost))
    ) {
      continue;
    }

    if (await withdrawUnusedCoupon(next.couponId, owner, "loyalty")) {
      taken.push(next.couponId);
      if (next.redeemId) await restoreClaim(owner, next.redeemId, null);
      continue;
    }
    // Not taken by us. Spent in the meantime: the card stands, so the claim
    // goes. Anything else (taken by a concurrent settlement, revoked by an
    // admin): the coupon is gone and the claim stays with it.
    if (next.redeemId && (await couponIsSpent(owner, next.couponId))) {
      await dropSpentClaim(owner, next.redeemId, next.couponId);
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

export type RedeemStampsResult =
  | { ok: true; coupon: CustomerCoupon; loyalty: LoyaltyView }
  | { ok: false; error: "not_enough_stamps"; stampTarget: number };

/**
 * Gives a redeem back after its coupon could not be created (or its answer
 * was lost): the row is deleted FIRST, then its claim, then the coupon is
 * withdrawn by its id. Each write is retried and none throws.
 *
 * - The row's delete failed: nothing else is touched. The coupon (if its
 *   insert did commit) and the row stay together, a redeem like any other,
 *   and if there is no coupon the row is a card without one, which the
 *   settlement drops after the grace window (`abandonedCards`). The stamps
 *   are never burned for a dead coupon, because the coupon is never
 *   withdrawn while its card stands.
 * - The row is gone: a settlement that saw both the row and the coupon may
 *   have claimed the card meanwhile, so the claim goes too (a claim without
 *   its row would credit the stamps twice; the settlement drops any that
 *   slips through, `orphanClaimIds`), and the coupon is withdrawn. Should
 *   that last write fail on every attempt, the coupon is an orphan - active
 *   with no card - and the next settlement takes it (`nextFreeDrinkWithdrawal`,
 *   rule 1). Until some trigger runs that coupon is spendable: it takes the
 *   outage that made the compensation fail, so the window is the length of
 *   the outage plus the time to the next trigger.
 */
async function abandonRedeem(
  owner: string,
  redeemId: string,
  couponId: string,
): Promise<void> {
  if (!(await dropLedgerRow(redeemId))) return;
  await dropLedgerRow(unredeemId(redeemId));
  await attempt(`withdraw coupon ${couponId}`, async () => {
    await withdrawUnusedCoupon(couponId, owner, "loyalty");
  });
}

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
 *   removed again and the request fails before any coupon exists. The delete
 *   is best effort and retried; one that never goes through leaves a card
 *   with no coupon, which the settlement drops after the grace window
 *   (`abandonedCards`).
 * - After the coupon: a reversal can still land between the row and the
 *   coupon, and its settlement finds no unused coupon to take back yet. So
 *   the free-drink settlement runs here too, under the same rule; if it
 *   takes this coupon back, the request fails with `not_enough_stamps`.
 *
 * A request that dies between the row and the coupon gives the stamps back
 * (`abandonRedeem`). So does a row whose own insert got no answer.
 *
 * A member whose balance looks short while a card of theirs has no coupon
 * (its request died and its rollback failed) is refused only after a
 * settlement has had its chance to drop that card: their own tap is a trigger.
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
  let ledger = await listStamps(owner);
  let before = computeStampBalance(ledger, target);
  if (before.available < target && ledger.some((r) => r.kind === "redeem")) {
    try {
      await settleFreeDrinks(owner);
      ledger = await listStamps(owner);
      before = computeStampBalance(ledger, target);
    } catch (err) {
      console.error("[loyalty] settlement before a refused redeem", err);
    }
  }
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
    await dropLedgerRow(id);
  }
  checkErr(ins.error, "redeemStamps.insert");

  let coverage: number;
  try {
    coverage = stampCoverage(await listStamps(owner));
  } catch (err) {
    await dropLedgerRow(id);
    throw err;
  }
  if (coverage < 0) {
    // Lost a race: the stamps went elsewhere first. Withdraw our row.
    await dropLedgerRow(id);
    return refused;
  }

  const couponId = freeDrinkCouponId(id);
  let coupon: CustomerCoupon;
  try {
    coupon = await grantFreeDrinkCoupon(owner, "loyalty", reward, couponId);
  } catch (err) {
    // The stamps were spent for a coupon that never existed - or did: the
    // insert may have committed with its answer lost. Let the caller fail
    // loudly, but give the card back first.
    await abandonRedeem(owner, id, couponId);
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
 * Rounds a till correction may lose to concurrent corrections before it gives
 * up. Every lost round means another click made progress, so n clicks at once
 * need at most n; the cap only keeps a bug from looping.
 */
const TILL_ATTEMPTS = 16;

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
 *
 * Two clicks at once used to both pass that check and write a row each, and
 * for a moment the ledger overdrew the member: a settlement running then took
 * their free drink before either click withdrew its row. The row's id now
 * names the ledger state it was decided on (`tillCorrectionId`), so two
 * clicks that read the same ledger write the same id and the primary key
 * lets one in; the other reads again (sees the first row, so it is refused
 * when nothing is left, or writes its own row when stamps are). Till
 * corrections therefore never overlap.
 *
 * KNOWN WINDOW (documented, docs/AUDIT.md): a correction racing a DIFFERENT
 * writer - a redeem, an order reversal - can still be overdrawn by it. The
 * coverage read after the row catches that and withdraws the row, but
 * between the row and its withdrawal (milliseconds) a settlement running at
 * that very moment sees the overdraft and may take a free drink the member
 * keeps the stamps for. Closing it needs a transaction or a database
 * function; the pool has neither (one statement at a time).
 *
 * Failure windows, so that the operator's message always matches the ledger:
 * an insert whose answer is lost is rolled back before the error is shown
 * (the retry takes exactly one stamp); a coverage read that fails after the
 * row is in rolls the row back and reports the error; if that rollback fails
 * too the row stands and the click reports success - the stamp IS taken, and
 * an error would have the operator click again and take a second one.
 */
export async function reverseCounterStamp(
  email: string,
  actor: string,
  note = "",
): Promise<ReverseCounterStampResult> {
  const owner = normalizeEmail(email);
  if (!owner) throw new Error("reverseCounterStamp: e-mail required");
  const rules = await loyaltyRules();
  const db = getDb();

  let row: LoyaltyStamp | null = null;
  for (let tries = 0; tries < TILL_ATTEMPTS && !row; tries += 1) {
    const ledger = await listStamps(owner);
    if (computeStampBalance(ledger, rules.stampTarget).available <= 0) {
      return { ok: false, error: "no_stamps" };
    }
    const candidate: LoyaltyStamp = {
      id: tillCorrectionId(ledger),
      customerEmail: owner,
      kind: "reversal",
      delta: -1,
      source: "admin",
      orderId: "",
      note: note.trim().slice(0, 120) || "Kasa damgası düzeltmesi",
      actor: normalizeEmail(actor),
      createdAt: new Date().toISOString(),
    };
    const { error } = await db.from(TABLES.loyaltyStamps).insert(candidate);
    // 23505: another click wrote its row against this very ledger; read again.
    if (error?.code === "23505") continue;
    if (error?.code === "") {
      // No answer: the row may have landed. Take it back before the error is
      // shown, or the operator's retry would take a second stamp.
      await dropLedgerRow(candidate.id, candidate.createdAt);
    }
    checkErr(error, "reverseCounterStamp");
    row = candidate;
  }
  if (!row) throw new Error("reverseCounterStamp: concurrent corrections");

  // The check above and the row are not one statement: a redeem or a
  // reversal can land between them. Read the coverage again with our row in;
  // if it dips below zero the stamps went below what the standing cards cost,
  // so this correction takes more than the member had left. Withdraw our row
  // rather than settle by taking the member's free drink for it.
  let coverage = 0;
  try {
    coverage = stampCoverage(await listStamps(owner));
  } catch (err) {
    if (await dropLedgerRow(row.id, row.createdAt)) throw err;
    console.error("[loyalty] till correction kept: coverage unread", err);
  }
  if (coverage < 0) {
    if (!(await dropLedgerRow(row.id, row.createdAt))) {
      throw new Error("reverseCounterStamp: overdrawn and not withdrawn");
    }
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
