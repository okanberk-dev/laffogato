// Pure loyalty arithmetic - NO "server-only", NO DB. The ledger rows and the
// member's orders come in, the `/me.loyalty` block (docs/API-MOBILE.md §4)
// comes out. Everything here is unit-tested directly; the database wiring
// lives in `./loyalty.ts`.

import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";
import type { CustomerCoupon } from "@/lib/customer/coupon-utils";

import type { MobileAppConfig } from "./app-config";

/** One row of the append-only `loyalty_stamps` ledger. */
export interface LoyaltyStamp {
  id: string;
  /** Normalized (lowercase) owner e-mail. */
  customerEmail: string;
  /**
   * `earn` adds a stamp, `redeem` spends a full card, `reversal` takes back a
   * stamp whose order was refunded or cancelled, `unredeem` withdraws a
   * `redeem` whose free-drink coupon was taken back because the stamps that
   * paid for it were reversed (`settleLoyaltyDebt` in `./loyalty.ts`). The
   * ledger stays append-only, so nothing is ever deleted to make a balance
   * come out right.
   */
  kind: "earn" | "redeem" | "reversal" | "unredeem";
  /**
   * Stamps earned (+1 per till stamp; an app cafe order earns `stampsFor` its
   * goods, so +2 or more on a big order), −target for a redeemed reward,
   * +the withdrawn card's cost for an `unredeem`, and for a reversal −1 per stamp an order gives
   * back (one row per stamp, see `plannedStampReversals`; rows written before
   * 16 Eki 2026 carry the order's whole earn delta in one row, −1 for a till
   * correction).
   */
  delta: number;
  /** order | counter | invite | admin | app */
  source: string;
  /** Order that earned the stamp; "" for counter / admin stamps. */
  orderId: string;
  note: string;
  /** Admin e-mail for counter stamps; "" otherwise. */
  actor: string;
  createdAt: string;
}

/**
 * Stamps needed for one free drink when nothing says otherwise. The live
 * value is `settings."mobileApp".loyalty.stampTarget` (3..20, edited at
 * /admin/mobil/ayarlar); the pure functions below take it as a parameter so
 * the arithmetic is testable without a database, and `./loyalty.ts` passes
 * the configured one.
 */
export const STAMP_TARGET = 6;

/**
 * The smallest app cafe order that earns a stamp, in kuruş (operator, 15 Eki
 * 2026: "minimum sipariş tutarı 140 TL"). Every paid app cafe order used to
 * earn one, so six ₺25 "Alternatif Süt" orders (₺150) bought a ₺280 free
 * drink (WS1-05). Measured like the invite minimum: what the member paid for
 * the goods, discount already out, courier fee not counted.
 */
export const STAMP_MIN_ORDER_MINOR = 14000;

/**
 * Goods per stamp above the minimum, in kuruş (operator, 15 Eki 2026: "140
 * TL'den 320 TL'ye kadar 1 tane sayılsın, damga toplam miktar ile
 * hesaplansın"). Every started ₺320 of goods is one stamp: ₺140-₺320 → 1,
 * ₺320,01-₺640 → 2, ₺640,01-₺960 → 3. A big order used to earn one stamp, the
 * same as a ₺140 one.
 */
export const STAMP_STEP_MINOR = 32000;

/**
 * What a paid app cafe order counts towards its stamps, in kuruş: what the
 * member paid for the goods - `totalMinor − shippingMinor`, so the discount is
 * already out and the courier fee is not counted.
 */
export function stampGoodsMinor(order: {
  totalMinor: number;
  shippingMinor: number;
}): number {
  const total = Math.round(Number(order.totalMinor));
  const shipping = Math.round(Number(order.shippingMinor));
  if (!Number.isFinite(total)) return 0;
  return Math.max(
    0,
    total - (Number.isFinite(shipping) ? Math.max(0, shipping) : 0),
  );
}

/**
 * Stamps for an amount of goods (kuruş): none under ₺140, otherwise one per
 * started ₺320 (`ceil(goods / 32000)`).
 */
export function stampsFor(goodsMinor: number): number {
  const goods = Math.round(Number(goodsMinor));
  if (!Number.isFinite(goods) || goods < STAMP_MIN_ORDER_MINOR) return 0;
  return Math.ceil(goods / STAMP_STEP_MINOR);
}

/** The stamps a paid app cafe order earns: `stampsFor` of its goods. */
export function stampsForOrder(order: {
  totalMinor: number;
  shippingMinor: number;
}): number {
  return stampsFor(stampGoodsMinor(order));
}

/** Whether a paid app cafe order is big enough to earn a stamp at all. */
export function earnsStamp(order: {
  totalMinor: number;
  shippingMinor: number;
}): boolean {
  return stampsForOrder(order) > 0;
}

/**
 * How much of an order's goods has been refunded, in kuruş, as far as the
 * stamps are concerned.
 *
 * A refund entry (`AdminRefund`) carries an amount and a free-text reason,
 * never a split between goods and courier fee, and one refund cannot be split
 * after the fact. The refunded total is therefore counted against the
 * courier fee FIRST and only the rest against the goods:
 * `refundedGoods = min(goods, max(0, refundedTotal − courierFee))`. This
 * favours the member (third review, 16 Eki 2026): a courier fee refunded on
 * its own - the courier was late - takes no stamp, and a refund of the goods
 * takes the same stamps it always did once it is larger than the fee. The
 * most a member can keep this way is the stamp of one courier fee's worth of
 * goods.
 */
export function stampRefundedGoodsMinor(order: {
  totalMinor: number;
  shippingMinor: number;
  refunds?: readonly { amountMinor: number }[];
}): number {
  const goods = stampGoodsMinor(order);
  const shipping = Math.round(Number(order.shippingMinor));
  const courier = Number.isFinite(shipping) ? Math.max(0, shipping) : 0;
  let refunded = 0;
  for (const r of order.refunds ?? []) {
    const n = Math.round(Number(r.amountMinor));
    if (Number.isFinite(n) && n > 0) refunded += n;
  }
  return Math.min(goods, Math.max(0, refunded - courier));
}

/** Order statuses that keep no stamp at all, whatever was refunded. */
const STAMPLESS_STATUSES: ReadonlySet<string> = new Set([
  "cancelled",
  "refunded",
]);

/**
 * The stamps an order may still hold after its refunds:
 * `stampsFor(goods − refunded goods)`, and none once the order is cancelled
 * or fully refunded (or the caller says so with `full`).
 *
 * Re-derived from the order after EVERY refund, so a ₺700 order (3 stamps)
 * refunded ₺100 keeps 2 (₺600), then ₺300 more keeps 1 (₺300), then the rest
 * keeps none - the stamps follow the goods that were actually kept, exactly
 * as `stampsFor` would have counted them had the member ordered only those.
 */
export function stampTargetForOrder(
  order: {
    totalMinor: number;
    shippingMinor: number;
    refunds?: readonly { amountMinor: number }[];
    status?: string;
  },
  opts: { full?: boolean } = {},
): number {
  if (opts.full) return 0;
  if (order.status && STAMPLESS_STATUSES.has(order.status)) return 0;
  return stampsFor(stampGoodsMinor(order) - stampRefundedGoodsMinor(order));
}

/**
 * The ledger id of the reversal that takes back an order's `index`-th stamp
 * (1-based). One row per stamp, with an id derived from the order and the
 * stamp, is what keeps reversals idempotent AND safe under concurrency: two
 * refunds settled at the same moment each insert the ids of the stamps they
 * think must go, the primary key keeps one row per stamp, and the order ends
 * up holding exactly the lowest target either of them computed. A single row
 * per refund carrying "earned − already reversed − target" could not do
 * that - both callers read the same "already reversed" and both subtract.
 *
 * The first stamp keeps the id the whole-order reversal always had
 * (`stamp-rev-<orderId>`), so a reversal written by an older deployment and
 * one written now collide on the primary key instead of both counting.
 */
export function stampReversalId(orderId: string, index: number): string {
  return index <= 1 ? `stamp-rev-${orderId}` : `stamp-rev-${orderId}:${index}`;
}

/** What one order holds on the ledger. */
export interface OrderStampHolding {
  /** The delta of the order's `earn` row; 0 when it has none. */
  earned: number;
  /** Stamps its `reversal` rows took back, capped at `earned`. */
  reversed: number;
  /** `earned − reversed`. */
  held: number;
}

function earnDelta(row: { delta?: number }): number {
  // A row read without its delta (an older caller's shape) is one stamp.
  if (row.delta === undefined) return 1;
  return Math.max(0, Math.round(Number(row.delta)) || 0);
}

function reversalDelta(row: { delta?: number }): number {
  // A reversal read without its delta is the old whole-order take-back.
  if (row.delta === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round(Math.abs(Number(row.delta))) || 0);
}

/**
 * Per order: what its `earn` row gave and what its `reversal` rows SUM to.
 * A reversal is no longer all-or-nothing - a partial refund takes back part
 * of an order's stamps - so every caller that used to ask "is there a
 * reversal?" now reads this. The sum is capped at the earn delta: however
 * many rows a race or an older deployment left, an order never gives back
 * more than it earned.
 */
export function orderStampHoldings(
  rows: readonly (Pick<LoyaltyStamp, "kind" | "orderId"> & {
    delta?: number;
  })[],
): ReadonlyMap<string, OrderStampHolding> {
  const earned = new Map<string, number>();
  const reversed = new Map<string, number>();
  for (const row of rows) {
    if (!row.orderId) continue;
    if (row.kind === "earn") {
      earned.set(row.orderId, earnDelta(row));
    } else if (row.kind === "reversal") {
      reversed.set(
        row.orderId,
        (reversed.get(row.orderId) ?? 0) + reversalDelta(row),
      );
    }
  }
  const out = new Map<string, OrderStampHolding>();
  for (const [orderId, e] of earned) {
    const r = Math.min(e, reversed.get(orderId) ?? 0);
    out.set(orderId, { earned: e, reversed: r, held: e - r });
  }
  return out;
}

/**
 * The reversal rows that bring an order down to `target` stamps: one id per
 * stamp above the target that is still held, highest stamp first. Empty when
 * the order already holds `target` or fewer (a retry, or a refund that did
 * not cross a ₺320 step). Ids already on the ledger are left out; the primary
 * key refuses any a concurrent caller wrote a moment ago.
 */
export function plannedStampReversals(
  rows: readonly Pick<LoyaltyStamp, "id" | "kind" | "orderId" | "delta">[],
  orderId: string,
  target: number,
): string[] {
  const holding = orderStampHoldings(rows).get(orderId);
  if (!holding) return [];
  const keep = Math.max(0, Math.min(holding.earned, Math.round(target) || 0));
  if (holding.held <= keep) return [];
  const present = new Set(rows.map((r) => r.id));
  const ids: string[] = [];
  for (let index = holding.earned; index > keep; index -= 1) {
    const id = stampReversalId(orderId, index);
    if (!present.has(id)) ids.push(id);
  }
  return ids;
}

const UNREDEEM_PREFIX = "stamp-unredeem-";

/** The ledger id of the `unredeem` row that withdraws one `redeem` row. */
export function unredeemId(redeemRowId: string): string {
  return `${UNREDEEM_PREFIX}${redeemRowId}`;
}

/** The `redeem` row an `unredeem` row id withdraws; null for any other id. */
export function redeemIdOfClaim(claimId: string): string | null {
  return claimId.startsWith(UNREDEEM_PREFIX) &&
    claimId.length > UNREDEEM_PREFIX.length
    ? claimId.slice(UNREDEEM_PREFIX.length)
    : null;
}

/**
 * The id of a till "−1" row. It names the ledger state the correction was
 * decided on (a fingerprint of the ids of the member's rows), so two clicks
 * that read the same ledger write the SAME id and the primary key keeps one
 * of them (23505): a conditional insert. The loser reads the ledger again,
 * now with the winner's row in it, and decides afresh. Two till corrections
 * can therefore never both be in the ledger on the strength of one stamp, and
 * no settlement ever sees the transient overdraft that two rows would make.
 *
 * Any row that lands or goes changes the fingerprint, so a click is never
 * stuck behind its own earlier row (ties on `createdAt` do not matter). A
 * hash collision between two different ledgers only costs a click one more
 * round. The id carries nothing about the member.
 */
export function tillCorrectionId(rows: readonly { id: string }[]): string {
  const ids = rows.map((r) => r.id).sort();
  // FNV-1a, twice with different offsets: 64 bits are plenty to tell the
  // ledgers of one member apart.
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (const id of ids) {
    for (let i = 0; i <= id.length; i += 1) {
      const c = i < id.length ? id.charCodeAt(i) : 0; // 0 separates the ids
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193) >>> 0;
    }
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return `stamp-till-${hex(a)}${hex(b)}`;
}

/**
 * The id of the free-drink coupon a `redeem` row bought. `redeemStamps`
 * gives the coupon this id, so every card knows its own coupon and every
 * coupon its own card (and what that card cost) without a lookup table.
 * Coupons granted before 16 Eki 2026 carry a plain `cpn-NNNN` id; see
 * `nextFreeDrinkWithdrawal` for how they are paired.
 */
export function freeDrinkCouponId(redeemRowId: string): string {
  return `cpn-${redeemRowId}`;
}

/** The `redeem` row behind a coupon id from {@link freeDrinkCouponId}. */
export function redeemIdOfCoupon(couponId: string): string | null {
  return couponId.startsWith("cpn-stamp-") ? couponId.slice(4) : null;
}

/**
 * What one card cost: the stamps its own `redeem` row consumed (the card
 * size in force when it was redeemed), or, on an `unredeem` row, the cost of
 * the card it withdrew. Never the current card size: an operator who changes
 * `stampTarget` changes what the NEXT card costs, not what an old one did.
 */
export function cardCost(row: { delta?: number }): number {
  const n = Math.round(Math.abs(Number(row.delta)));
  return Number.isFinite(n) ? n : 0;
}

/**
 * The settlement invariant (third review of 16 Eki 2026):
 *
 *   covered = lifetimeStamps − Σ cost of every redeemed card still standing
 *
 * "Still standing" is every `redeem` row no `unredeem` row withdrew, whether
 * its coupon is unused, used or expired; each is priced at its own cost
 * (`cardCost`). The `unredeem` row carries the cost of the card it withdrew,
 * so the sum is `Σ redeem costs − Σ unredeem costs` and needs no ids.
 *
 * `covered < 0` means stamps that paid for a card were reversed. It does not
 * depend on `stampTarget` at all, so changing the card size can never make
 * it negative. A settlement withdraws unused free drinks while it is
 * negative (`nextFreeDrinkWithdrawal`); what is left once none is unused is
 * paid by the next stamps.
 */
export function stampCoverage(
  rows: readonly (Pick<LoyaltyStamp, "kind" | "delta"> & {
    orderId?: string;
  })[],
): number {
  let spent = 0;
  for (const row of rows) {
    if (row.kind === "redeem") spent += cardCost(row);
    else if (row.kind === "unredeem") spent -= cardCost(row);
  }
  return computeStampBalance(rows).lifetimeStamps - spent;
}

/** The coupon fields a settlement reads. */
export type SettleCoupon = Pick<
  CustomerCoupon,
  "id" | "source" | "isActive" | "redeemedAt" | "expiresAt" | "createdAt"
>;

/** One free drink a settlement takes back, and the card it withdraws. */
export interface FreeDrinkWithdrawal {
  couponId: string;
  /**
   * The coupon's own `redeem` row; its `unredeem` row is
   * `unredeemId(redeemId)`. Empty for an orphan: a coupon whose `redeem` row
   * is gone, so there is no card to withdraw, only the coupon.
   */
  redeemId: string;
  /** What that card cost; the `unredeem` row carries it. 0 for an orphan. */
  cost: number;
  /**
   * The card's `unredeem` row is already on the ledger: a settlement wrote it
   * and stopped before taking the coupon. The coupon is still to be taken,
   * with no new row to write.
   */
  claimed: boolean;
}

function newestFirst(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  return a.createdAt === b.createdAt
    ? b.id.localeCompare(a.id)
    : b.createdAt.localeCompare(a.createdAt);
}

/** The ledger fields settlement reads (`orderId` feeds `stampCoverage`). */
type CardRow = Pick<
  LoyaltyStamp,
  "id" | "kind" | "delta" | "orderId" | "createdAt"
>;

/** A loyalty coupon and the `redeem` row that bought it (null: none found). */
interface CouponCard {
  coupon: SettleCoupon;
  card: CardRow | null;
}

/**
 * Pairs every loyalty coupon, newest first, with its card.
 *
 * A coupon whose id is `freeDrinkCouponId(redeem row)` names its card. A
 * coupon granted before ids were linked is paired with the newest `redeem`
 * row created no later than it that no linked coupon claims.
 *
 * The pairing reads ALL coupons (used, withdrawn, expired) and ALL `redeem`
 * rows, and never looks at `unredeem` rows. It is therefore the same for
 * every settlement running at once, whatever each has already claimed or
 * withdrawn: a coupon cannot slide onto a card that a concurrent settlement
 * has just withdrawn, which is how two of them used to take the same coupon
 * for two different cards and leave another coupon stranded.
 */
function pairCouponsWithCards(
  rows: readonly CardRow[],
  coupons: readonly SettleCoupon[],
): CouponCard[] {
  const redeems = rows.filter((r) => r.kind === "redeem");
  const byId = new Map(redeems.map((r) => [r.id, r]));
  const loyalty = coupons.filter((c) => c.source === "loyalty");
  const linked = new Set(
    loyalty.map((c) => redeemIdOfCoupon(c.id)).filter(Boolean),
  );
  const legacyCards = redeems
    .filter((r) => !linked.has(r.id))
    .sort(newestFirst);
  const taken = new Set<string>();
  return [...loyalty].sort(newestFirst).map((coupon) => {
    const own = redeemIdOfCoupon(coupon.id);
    if (own) return { coupon, card: byId.get(own) ?? null };
    const card =
      legacyCards.find(
        (r) => !taken.has(r.id) && r.createdAt <= coupon.createdAt,
      ) ?? null;
    if (card) taken.add(card.id);
    return { coupon, card };
  });
}

function withdrawnCards(rows: readonly Pick<CardRow, "id" | "kind">[]) {
  return new Set(rows.filter((r) => r.kind === "unredeem").map((r) => r.id));
}

/**
 * The next free drink to take back, or `null` when there is nothing to do.
 * Candidates are the UNUSED, active, unexpired `loyalty` coupons
 * (`pairCouponsWithCards` names each one's card), newest first, and the rule
 * picks, in this order:
 *
 * 1. an orphan: a coupon whose own `redeem` row is gone (a coupon insert
 *    that committed after its request had given up: `redeemStamps` rolled
 *    the card back, the coupon stayed). No stamps paid for it; it goes,
 *    whatever the coverage. POLICY, deliberate: this is also what happens
 *    when someone deletes a ledger `redeem` row by hand - the coupon is
 *    withdrawn at the next trigger, with no stamp refund.
 * 2. a half-done withdrawal: the card's `unredeem` row is on the ledger and
 *    the coupon is still active and unused (a settlement died between its two
 *    writes, or lost a race for the coupon). The coverage already counts
 *    the card as withdrawn, so the coupon must go too, whatever the coverage
 *    is now (POLICY, deliberate, like rule 1: finishing a withdrawal does not
 *    ask whether the stamps would cover the card today). `claimed` is true;
 *    only the coupon is left to take.
 * 3. while `stampCoverage < 0`, the newest standing card's coupon, at that
 *    card's cost.
 *
 * Deterministic for a given ledger and coupon list, so two settlements running
 * at once pick the same coupon and the primary key on `unredeemId` plus the
 * guarded coupon update let only one of them take it.
 */
export function nextFreeDrinkWithdrawal(
  rows: readonly CardRow[],
  coupons: readonly SettleCoupon[],
  nowMs: number,
): FreeDrinkWithdrawal | null {
  const withdrawn = withdrawnCards(rows);
  const owed = stampCoverage(rows) < 0;
  let fresh: FreeDrinkWithdrawal | null = null;
  for (const { coupon, card } of pairCouponsWithCards(rows, coupons)) {
    if (
      !coupon.isActive ||
      coupon.redeemedAt ||
      (coupon.expiresAt && Date.parse(coupon.expiresAt) < nowMs)
    ) {
      continue;
    }
    if (!card) {
      // A linked id with no card behind it is an orphan; an unlinked coupon
      // with no card before it is just not ours to judge.
      if (redeemIdOfCoupon(coupon.id)) {
        return { couponId: coupon.id, redeemId: "", cost: 0, claimed: false };
      }
      continue;
    }
    const claimed = withdrawn.has(unredeemId(card.id));
    const plan = {
      couponId: coupon.id,
      redeemId: card.id,
      cost: cardCost(card),
      claimed,
    };
    if (claimed) return plan;
    if (owed && !fresh) fresh = plan;
  }
  return fresh;
}

/** A withdrawal claim whose coupon turned out to be spent. */
export interface StaleClaim {
  redeemId: string;
  couponId: string;
}

/**
 * The `unredeem` rows to drop: a settlement wrote one, then the member spent
 * (or an unpaid order is holding) the coupon before it could be taken, and
 * the settlement died before it could drop its claim again. A used coupon is
 * never taken back, so its card stands - the claim only hides a card the
 * member really spent, and the next stamps pay for it.
 */
export function staleFreeDrinkClaims(
  rows: readonly CardRow[],
  coupons: readonly SettleCoupon[],
): StaleClaim[] {
  const withdrawn = withdrawnCards(rows);
  const out: StaleClaim[] = [];
  for (const { coupon, card } of pairCouponsWithCards(rows, coupons)) {
    if (card && coupon.redeemedAt && withdrawn.has(unredeemId(card.id))) {
      out.push({ redeemId: card.id, couponId: coupon.id });
    }
  }
  return out;
}

/**
 * The `unredeem` rows to drop because their `redeem` row is gone: a claim
 * written for a card that a redeem's rollback (or a hand edit) deleted a
 * moment later. It would credit the member the card's cost for nothing, and
 * `redeemStamps` would sell those stamps a second time.
 */
export function orphanClaimIds(
  rows: readonly Pick<CardRow, "id" | "kind">[],
): string[] {
  const redeems = new Set(
    rows.filter((r) => r.kind === "redeem").map((r) => r.id),
  );
  return rows
    .filter((r) => {
      if (r.kind !== "unredeem") return false;
      const own = redeemIdOfClaim(r.id);
      return own !== null && !redeems.has(own);
    })
    .map((r) => r.id);
}

/**
 * How long an app `redeem` row may stand without its coupon before it counts
 * as abandoned. A live redeem writes the row and the coupon within two
 * statements; two minutes is far past any request that is still running, and
 * short enough that the stamps of a request that died are back soon.
 */
export const REDEEM_ROW_GRACE_MS = 2 * 60 * 1000;

/**
 * The app `redeem` rows no loyalty coupon belongs to (`pairCouponsWithCards`,
 * legacy pairing included): a redeem in flight, between its row and its
 * coupon, or a card whose request died and whose rollback could not delete
 * it. Empty while a loyalty coupon exists that no card claims (an old coupon
 * of unknown origin): which card lacks a coupon is then a guess.
 *
 * A settlement never takes a real free drink to "cover" such a card
 * (`healLedger` leaves it out of the ledger it decides on): the stamps are
 * not in the member's hands, the coupon they bought does not exist, and if
 * the card is in flight its own redeem settles once its coupon is there.
 */
export function couponlessCards<T extends CardRow & { source?: string }>(
  rows: readonly T[],
  coupons: readonly SettleCoupon[],
): T[] {
  const paired = pairCouponsWithCards(rows, coupons);
  if (paired.some((p) => !p.card && !redeemIdOfCoupon(p.coupon.id))) return [];
  const hasCoupon = new Set(paired.flatMap((p) => (p.card ? [p.card.id] : [])));
  return rows.filter(
    (r) => r.kind === "redeem" && r.source === "app" && !hasCoupon.has(r.id),
  );
}

/**
 * The couponless cards to DROP: older than the grace window, so no redeem can
 * still be on its way to creating a coupon. The request that wrote the row
 * died and its rollback could not delete it; the row would keep holding the
 * member's stamps against a card nobody can use. Within the grace window the
 * row is a redeem in flight and is never touched.
 *
 * POLICY (deliberate, the consequence of this rule): the card and its coupon
 * live and die together. A coupon an admin hard-deletes
 * (`revokeCustomerCoupon`) leaves a card with no coupon, and after the grace
 * window its stamps are given back - the mirror image of a hand-deleted
 * `redeem` row withdrawing its coupon (`nextFreeDrinkWithdrawal`, rule 1).
 */
export function abandonedCards<T extends CardRow & { source?: string }>(
  rows: readonly T[],
  coupons: readonly SettleCoupon[],
  nowMs: number,
  graceMs: number = REDEEM_ROW_GRACE_MS,
): T[] {
  return couponlessCards(rows, coupons).filter(
    (r) => nowMs - Date.parse(r.createdAt) > graceMs,
  );
}

/** The loyalty knobs the operator turns; one shape for the core and the till. */
export type LoyaltyRules = MobileAppConfig["loyalty"];

/**
 * The free-drink coupon as `customer_coupons` stores it. `kind` and the
 * subtotal floor are fixed - a free drink is a fixed amount off, on any
 * basket; the amount, the title and the shelf life come from the rules.
 */
export interface FreeDrinkReward {
  kind: "fixed";
  valueMinor: number;
  title: string;
  minSubtotalMinor: number;
  ttlDays: number;
}

export function freeDrinkRewardFor(
  loyalty: Pick<
    LoyaltyRules,
    "rewardTitle" | "rewardValueMinor" | "rewardTtlDays"
  >,
): FreeDrinkReward {
  return {
    kind: "fixed",
    valueMinor: Math.max(0, Math.round(loyalty.rewardValueMinor)),
    title: loyalty.rewardTitle,
    minSubtotalMinor: 0,
    ttlDays: Math.max(1, Math.round(loyalty.rewardTtlDays)),
  };
}

export type LoyaltyTier = "verde" | "argento" | "oro";

/**
 * The names a member reads (karar 165, 23 Eyl 2026). The operator asked for
 * tiers drawn from the Italian flag with English names: its green, white and
 * red. The green, where every member starts, carries the house's own name
 * (the operator: "yeşile L'Af"), and the two above it are gems - Pearl, Ruby
 * - so the ladder reads at a glance. The ids stay
 * `verde` / `argento` / `oro` - they are the contract (`docs/API-MOBILE.md`
 * §4) and v1 only grows; only the words change.
 */
export const TIER_LABELS: Record<LoyaltyTier, string> = {
  verde: "L'AF",
  argento: "PEARL",
  oro: "RUBY",
};

/** Paid orders in the last 365 days that reach each tier. */
export const TIER_THRESHOLDS = { argento: 12, oro: 36 } as const;

export type BadgeId =
  | "first-affogato"
  | "streak-10"
  | "early-bird"
  | "matcha-fan"
  | "bean-subscriber"
  | "orders-50";

export const BADGE_LABELS: Record<BadgeId, string> = {
  "first-affogato": "İlk affogato",
  "streak-10": "10 gün üst üste",
  "early-bird": "Erken kuş",
  "matcha-fan": "Matcha meraklısı",
  "bean-subscriber": "Çekirdek abonesi",
  "orders-50": "50 sipariş",
};

export const BADGE_IDS: BadgeId[] = [
  "first-affogato",
  "streak-10",
  "early-bird",
  "matcha-fan",
  "bean-subscriber",
  "orders-50",
];

export interface LoyaltyBadge {
  id: BadgeId;
  label: string;
  earned: boolean;
}

export interface LoyaltyView {
  stamps: number;
  stampTarget: number;
  rewardsReady: number;
  lifetimeStamps: number;
  tier: LoyaltyTier;
  tierLabel: string;
  ordersLast365: number;
  badges: LoyaltyBadge[];
}

export interface StampBalance {
  /** Every stamp ever earned. */
  lifetimeStamps: number;
  /** Rewards already turned into coupons. */
  redeemCount: number;
  /** Stamps not yet spent: earned − target × redeemed. */
  available: number;
  /** Filled stamps on the current card (0 … target − 1). */
  stamps: number;
  /** Full cards waiting to be redeemed. */
  rewardsReady: number;
}

/**
 * Orders that count towards loyalty. An unpaid, cancelled or refunded order
 * is not a visit: it neither advances the tier nor unlocks a badge.
 */
export const COUNTED_ORDER_STATUSES: readonly AdminOrderStatus[] = [
  "paid",
  "preparing",
  "shipped",
  "completed",
];

export function isCountedOrder(order: Pick<AdminOrder, "status">): boolean {
  return COUNTED_ORDER_STATUSES.includes(order.status);
}

/**
 * `stampTarget` is the card size the balance is read against. A redeem row
 * is counted by presence and charged the current target, not its own delta:
 * a hand-edited −5 must not leave a phantom stamp, and a card that grew from
 * 6 to 8 re-reads old redeems at 8 - the operator changing the target is
 * changing the deal for everyone, past cards included, and that is what the
 * setting says. An `unredeem` row withdraws one redeem the same way, by
 * presence, so `redeemCount` counts the cards whose coupon still stands
 * (unused, or used) and never one that was taken back.
 *
 * `available` is also never more than the stamps the standing cards left
 * at what each of them cost (`stampCoverage`). That second bound matters
 * only after the card SHRANK: a card of 6 redeemed before the operator set 4
 * still cost 6, so it does not hand out a free card of 4 the stamps never
 * paid for - and `redeemStamps`, which checks `available`, never mints a
 * coupon the settlement invariant would call uncovered.
 *
 * `available` is clamped at 0, but the debt is not forgotten: it is
 * recomputed from the ledger every time, so the stamps a member earns after
 * a reversal first fill the hole the reversal left under a coupon they
 * already spent.
 *
 * Reversals of an order are summed per order and capped at what that order
 * earned (`orderStampHoldings`); an orderless reversal (a till correction)
 * counts as written.
 */
export function computeStampBalance(
  rows: readonly (Pick<LoyaltyStamp, "kind" | "delta"> & {
    orderId?: string;
  })[],
  stampTarget: number = STAMP_TARGET,
): StampBalance {
  const target = Math.max(1, Math.round(stampTarget));
  let lifetimeStamps = 0;
  let redeemCount = 0;
  let unredeemCount = 0;
  let spentCost = 0;
  let reversed = 0;
  const earnedOrders = new Set<string>();
  for (const row of rows) {
    if (row.kind === "earn" && row.orderId) earnedOrders.add(row.orderId);
  }
  for (const row of rows) {
    if (row.kind === "earn") {
      lifetimeStamps += Math.max(0, Math.round(row.delta));
    } else if (row.kind === "redeem") {
      redeemCount += 1;
      spentCost += cardCost(row);
    } else if (row.kind === "unredeem") {
      unredeemCount += 1;
      spentCost -= cardCost(row);
    } else if (
      row.kind === "reversal" &&
      !(row.orderId && earnedOrders.has(row.orderId))
    ) {
      // A refunded order's stamp leaves the balance, and the lifetime count
      // with it: it was never a visit that happened. Reversals of an order
      // that earned on this ledger are summed (and capped) below.
      reversed += Math.max(0, Math.round(Math.abs(row.delta)));
    }
  }
  for (const holding of orderStampHoldings(
    rows.map((r) => ({
      kind: r.kind,
      delta: r.delta,
      orderId: r.orderId ?? "",
    })),
  ).values()) {
    reversed += holding.reversed;
  }
  lifetimeStamps = Math.max(0, lifetimeStamps - reversed);
  redeemCount = Math.max(0, redeemCount - unredeemCount);
  const available = Math.max(
    0,
    Math.min(
      lifetimeStamps - target * redeemCount,
      lifetimeStamps - Math.max(0, spentCost),
    ),
  );
  return {
    lifetimeStamps,
    redeemCount,
    available,
    stamps: available % target,
    rewardsReady: Math.floor(available / target),
  };
}

/**
 * The orders that actually hold a stamp: an `earn` row its `reversal` rows
 * have not taken back in full (`orderStampHoldings`). A row read without a
 * delta counts as the old shape: one stamp earned, a reversal takes it all.
 *
 * Reversals are matched per order rather than counted globally, because a
 * counter stamp's reversal carries no `orderId` and must not cancel some
 * order's stamp.
 */
export function stampedOrderIds(
  rows: readonly (Pick<LoyaltyStamp, "kind" | "orderId"> & {
    delta?: number;
  })[],
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [orderId, holding] of orderStampHoldings(rows)) {
    if (holding.held > 0) out.add(orderId);
  }
  return out;
}

/**
 * How many stamps each order really holds: the delta of its `earn` row minus
 * the SUM of its `reversal` rows, for every order still holding at least one.
 * One order earns at most one `earn` row (the unique index
 * `loyalty_stamps_order_key`); a partial refund takes back part of it and a
 * cancel or full refund the rest, so a ₺700 order (3) refunded down to ₺300
 * of goods holds 1 and a fully refunded one is not listed.
 *
 * `stampsEarned` on the wire is answered from this: an order of ₺700 of goods
 * says 3, not 1.
 */
export function stampsByOrder(
  rows: readonly Pick<LoyaltyStamp, "kind" | "orderId" | "delta">[],
): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const [orderId, holding] of orderStampHoldings(rows)) {
    if (holding.held > 0) out.set(orderId, holding.held);
  }
  return out;
}

/**
 * When the newest full card was completed - the `createdAt` of the earn row
 * that filled it - or `null` when no reward is waiting.
 *
 * The inbox stamps its "Ödülün hazır" item with this instant. It used to be
 * stamped with "now", which moved forward on every poll, so the item was
 * unread again a minute after the member marked the inbox read and stayed at
 * the top until they redeemed. A reversal is charged against the newest
 * stamps, the same way `computeStampBalance` counts them.
 */
export function rewardReadyAt(
  rows: readonly (Pick<LoyaltyStamp, "kind" | "delta" | "createdAt"> & {
    orderId?: string;
  })[],
  stampTarget: number = STAMP_TARGET,
): string | null {
  const target = Math.max(1, Math.round(stampTarget));
  const balance = computeStampBalance(rows, target);
  if (balance.rewardsReady <= 0) return null;

  const earned: string[] = [];
  for (const row of rows) {
    if (row.kind !== "earn") continue;
    for (let i = 0; i < Math.max(0, Math.round(row.delta)); i++) {
      earned.push(row.createdAt);
    }
  }
  earned.sort();
  const live = earned.slice(0, balance.lifetimeStamps);
  const filled = target * (balance.redeemCount + balance.rewardsReady);
  return live[filled - 1] ?? live[live.length - 1] ?? null;
}

export function computeTier(ordersLast365: number): LoyaltyTier {
  if (ordersLast365 >= TIER_THRESHOLDS.oro) return "oro";
  if (ordersLast365 >= TIER_THRESHOLDS.argento) return "argento";
  return "verde";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Counted orders created within the last 365 days of `nowMs`. */
export function countOrdersLast365(
  orders: readonly Pick<AdminOrder, "status" | "createdAt">[],
  nowMs: number,
): number {
  const since = nowMs - 365 * DAY_MS;
  let n = 0;
  for (const o of orders) {
    if (!isCountedOrder(o)) continue;
    const at = Date.parse(o.createdAt);
    if (Number.isFinite(at) && at >= since && at <= nowMs) n += 1;
  }
  return n;
}

// Türkiye has kept UTC+3 all year since 2016; no DST table needed.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Local (Istanbul) calendar day and hour of an ISO instant, or null. */
export function istanbulParts(
  iso: string,
): { dayKey: string; dayIndex: number; hour: number } | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const shifted = new Date(at + ISTANBUL_OFFSET_MS);
  const dayIndex = Math.floor(shifted.getTime() / DAY_MS);
  return {
    dayKey: shifted.toISOString().slice(0, 10),
    dayIndex,
    hour: shifted.getUTCHours(),
  };
}

/** Case-, apostrophe- and accent-insensitive item-name key. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSignatureAffogato(name: string): boolean {
  return nameKey(name) === "l'affogato";
}

function isMatcha(name: string): boolean {
  return nameKey(name).includes("matcha");
}

/** Longest run of consecutive calendar days with at least one counted order. */
export function longestDailyStreak(
  orders: readonly Pick<AdminOrder, "status" | "createdAt">[],
): number {
  const days = new Set<number>();
  for (const o of orders) {
    if (!isCountedOrder(o)) continue;
    const parts = istanbulParts(o.createdAt);
    if (parts) days.add(parts.dayIndex);
  }
  const sorted = Array.from(days).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of sorted) {
    run = prev !== null && day === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

export const EARLY_BIRD_HOUR = 9;
export const STREAK_TARGET = 10;
export const MATCHA_TARGET = 5;
export const ORDERS_BADGE_TARGET = 50;

export function computeBadges(
  orders: readonly Pick<AdminOrder, "status" | "createdAt" | "items">[],
): LoyaltyBadge[] {
  const counted = orders.filter(isCountedOrder);
  let firstAffogato = false;
  let earlyBird = false;
  let matchaQty = 0;
  for (const o of counted) {
    for (const it of o.items) {
      if (it.status === "cancelled") continue;
      if (isSignatureAffogato(it.productName)) firstAffogato = true;
      if (isMatcha(it.productName)) matchaQty += Math.max(0, it.qty);
    }
    const parts = istanbulParts(o.createdAt);
    if (parts && parts.hour < EARLY_BIRD_HOUR) earlyBird = true;
  }
  const earned: Record<BadgeId, boolean> = {
    "first-affogato": firstAffogato,
    "streak-10": longestDailyStreak(counted) >= STREAK_TARGET,
    "early-bird": earlyBird,
    "matcha-fan": matchaQty >= MATCHA_TARGET,
    // There is no bean subscription in v1 (docs/API-MOBILE.md §2, karar 8).
    "bean-subscriber": false,
    "orders-50": counted.length >= ORDERS_BADGE_TARGET,
  };
  return BADGE_IDS.map((id) => ({
    id,
    label: BADGE_LABELS[id],
    earned: earned[id],
  }));
}

/**
 * The whole `/me.loyalty` block from ledger rows + orders (pure). The
 * `stampTarget` it publishes is the one the balance was computed with, so
 * the app's card always has as many slots as the arithmetic assumed.
 */
export function buildLoyaltyView(
  stamps: readonly (Pick<LoyaltyStamp, "kind" | "delta"> & {
    orderId?: string;
  })[],
  orders: readonly Pick<AdminOrder, "status" | "createdAt" | "items">[],
  nowMs: number,
  stampTarget: number = STAMP_TARGET,
): LoyaltyView {
  const balance = computeStampBalance(stamps, stampTarget);
  const ordersLast365 = countOrdersLast365(orders, nowMs);
  const tier = computeTier(ordersLast365);
  return {
    stamps: balance.stamps,
    stampTarget: Math.max(1, Math.round(stampTarget)),
    rewardsReady: balance.rewardsReady,
    lifetimeStamps: balance.lifetimeStamps,
    tier,
    tierLabel: TIER_LABELS[tier],
    ordersLast365,
    badges: computeBadges(orders),
  };
}
