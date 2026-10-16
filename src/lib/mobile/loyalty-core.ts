// Pure loyalty arithmetic - NO "server-only", NO DB. The ledger rows and the
// member's orders come in, the `/me.loyalty` block (docs/API-MOBILE.md §4)
// comes out. Everything here is unit-tested directly; the database wiring
// lives in `./loyalty.ts`.

import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";

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
 * never a split between goods and courier fee, so there is no honest way to
 * tell a refunded courier fee from refunded goods. Every refunded kuruş is
 * therefore charged to the goods first, capped at the goods
 * (`min(refunded, goods)`): a refund can only ever lower the stamps, never
 * leave the member holding stamps for goods they got their money back for.
 * The one case this reads against the member - the courier fee refunded on
 * its own - costs at most the stamp of one ₺320 step, and is the house's
 * call to make by hand (a till stamp) rather than a hole to farm.
 */
export function stampRefundedGoodsMinor(order: {
  totalMinor: number;
  shippingMinor: number;
  refunds?: readonly { amountMinor: number }[];
}): number {
  const goods = stampGoodsMinor(order);
  let refunded = 0;
  for (const r of order.refunds ?? []) {
    const n = Math.round(Number(r.amountMinor));
    if (Number.isFinite(n) && n > 0) refunded += n;
  }
  return Math.min(goods, refunded);
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

/** The ledger id of the `unredeem` row that withdraws one `redeem` row. */
export function unredeemId(redeemRowId: string): string {
  return `stamp-unredeem-${redeemRowId}`;
}

/**
 * Stamps the member owes on the balance: what their redeemed cards cost at
 * the CURRENT card size beyond the stamps they still hold. This is the hole
 * `computeStampBalance` keeps under its clamp at 0 (the next stamps fill it
 * before a new card does). It is not what a settlement takes coupons for:
 * an operator who grows the card makes this positive without any stamp
 * having been reversed; see `reversalDebt`.
 */
export function stampDebt(
  balance: Pick<StampBalance, "lifetimeStamps" | "redeemCount">,
  stampTarget: number = STAMP_TARGET,
): number {
  const target = Math.max(1, Math.round(stampTarget));
  return Math.max(0, target * balance.redeemCount - balance.lifetimeStamps);
}

/**
 * What one card cost when it was redeemed: the stamps its `redeem` row (or
 * the `unredeem` row that withdrew it) carries. A row without a usable
 * delta is priced at the current card.
 */
function cardCost(row: { delta?: number }, target: number): number {
  const n = Math.round(Math.abs(Number(row.delta)));
  return Number.isFinite(n) && n > 0 ? n : target;
}

type SettleRow = Pick<
  LoyaltyStamp,
  "id" | "kind" | "delta" | "createdAt" | "orderId"
>;

function openRedeems<T extends SettleRow>(rows: readonly T[]): T[] {
  const withdrawn = new Set(
    rows.filter((r) => r.kind === "unredeem").map((r) => r.id),
  );
  return rows
    .filter((r) => r.kind === "redeem" && !withdrawn.has(unredeemId(r.id)))
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? b.id.localeCompare(a.id)
        : b.createdAt.localeCompare(a.createdAt),
    );
}

/**
 * The stamps a settlement may still take coupons back for: the part of the
 * member's debt that ORDER REVERSALS created and no withdrawal has covered
 * yet. The smallest of three numbers:
 *
 * 1. The debt at the current card: `target × open cards − lifetime`.
 * 2. The debt at what each card really cost (its own `redeem` delta). A card
 *    of 6 redeemed before the operator grew the card to 8 still cost 6: the
 *    setting re-reads the BALANCE at 8 (that is what it promises), but it
 *    never makes a member owe a coupon they paid for in full.
 * 3. The stamps order reversals took back, minus what the withdrawals so far
 *    settled (the cost on each `unredeem` row). Without a reversal nothing
 *    is ever owed: a change of the card size, a till correction (refused
 *    when it would leave the member short) or a hand edit is not a refund.
 *
 * 1 and 2 together keep a card-size change in either direction from
 * inventing a debt; 3 keeps it from ever exceeding what refunds and cancels
 * actually took back. Settlement uses this, never `stampDebt`.
 */
export function reversalDebt(
  rows: readonly SettleRow[],
  stampTarget: number = STAMP_TARGET,
): number {
  const target = Math.max(1, Math.round(stampTarget));
  const lifetime = computeStampBalance(rows, target).lifetimeStamps;
  const open = openRedeems(rows);
  const atCurrent = target * open.length;
  const atCost = open.reduce((sum, r) => sum + cardCost(r, target), 0);
  const owed = Math.min(atCurrent, atCost) - lifetime;
  if (owed <= 0) return 0;
  let reversed = 0;
  for (const holding of orderStampHoldings(rows).values()) {
    reversed += holding.reversed;
  }
  let settled = 0;
  for (const r of rows)
    if (r.kind === "unredeem") settled += cardCost(r, target);
  return Math.max(0, Math.min(owed, reversed - settled));
}

/** One card a settlement withdraws. */
export interface PlannedWithdrawal {
  /** The `redeem` row withdrawn. */
  redeemId: string;
  /** What that card cost; the `unredeem` row carries it. */
  cost: number;
}

/**
 * The `redeem` rows a reversal debt withdraws, newest first, as few as clear
 * it (`reversalDebt` re-read after each), never one already withdrawn.
 * Deterministic for a given ledger, so two callers settling the same debt at
 * the same moment pick the same rows and the primary key on `unredeemId`
 * keeps one withdrawal per row.
 */
export function plannedWithdrawals(
  rows: readonly SettleRow[],
  stampTarget: number = STAMP_TARGET,
): PlannedWithdrawal[] {
  const target = Math.max(1, Math.round(stampTarget));
  const sim: SettleRow[] = [...rows];
  const plan: PlannedWithdrawal[] = [];
  for (const redeem of openRedeems(rows)) {
    if (reversalDebt(sim, target) <= 0) break;
    const cost = cardCost(redeem, target);
    plan.push({ redeemId: redeem.id, cost });
    sim.push({
      id: unredeemId(redeem.id),
      kind: "unredeem",
      delta: cost,
      createdAt: "",
      orderId: "",
    });
  }
  return plan;
}

/** The ids of {@link plannedWithdrawals}. */
export function redeemsToWithdraw(
  rows: readonly SettleRow[],
  stampTarget: number = STAMP_TARGET,
): string[] {
  return plannedWithdrawals(rows, stampTarget).map((w) => w.redeemId);
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
 * `available` is clamped at 0, but the debt is not forgotten: it is
 * `target × redeemCount − lifetimeStamps`, recomputed from the ledger every
 * time, so the stamps a member earns after a reversal first fill the hole
 * the reversal left under a coupon they already spent (`stampDebt`).
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
    } else if (row.kind === "unredeem") {
      unredeemCount += 1;
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
  const available = Math.max(0, lifetimeStamps - target * redeemCount);
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
