// Pure loyalty arithmetic — NO "server-only", NO DB. The ledger rows and the
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
   * stamp whose order was refunded or cancelled — the ledger stays
   * append-only, so nothing is ever deleted to make a balance come out right.
   */
  kind: "earn" | "redeem" | "reversal";
  /** +1 for an earned stamp, −6 for a redeemed reward, −1 for a reversal. */
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

/** The loyalty knobs the operator turns; one shape for the core and the till. */
export type LoyaltyRules = MobileAppConfig["loyalty"];

/**
 * The free-drink coupon as `customer_coupons` stores it. `kind` and the
 * subtotal floor are fixed — a free drink is a fixed amount off, on any
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

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  verde: "VERDE",
  argento: "ARGENTO",
  oro: "ORO",
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
 * 6 to 8 re-reads old redeems at 8 — the operator changing the target is
 * changing the deal for everyone, past cards included, and that is what the
 * setting says.
 */
export function computeStampBalance(
  rows: readonly Pick<LoyaltyStamp, "kind" | "delta">[],
  stampTarget: number = STAMP_TARGET,
): StampBalance {
  const target = Math.max(1, Math.round(stampTarget));
  let lifetimeStamps = 0;
  let redeemCount = 0;
  let reversed = 0;
  for (const row of rows) {
    if (row.kind === "earn") {
      lifetimeStamps += Math.max(0, Math.round(row.delta));
    } else if (row.kind === "redeem") {
      redeemCount += 1;
    } else if (row.kind === "reversal") {
      // A refunded order's stamp leaves the balance, and the lifetime count
      // with it: it was never a visit that happened.
      reversed += Math.max(0, Math.round(Math.abs(row.delta)));
    }
  }
  lifetimeStamps = Math.max(0, lifetimeStamps - reversed);
  const available = Math.max(0, lifetimeStamps - target * redeemCount);
  return {
    lifetimeStamps,
    redeemCount,
    available,
    stamps: available % target,
    rewardsReady: Math.floor(available / target),
  };
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
  stamps: readonly Pick<LoyaltyStamp, "kind" | "delta">[],
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
