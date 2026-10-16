/**
 * Milestone gifts (karar 175, 23 Eyl 2026) - the pure half.
 *
 * The operator: "10 kahvede bir filtre kahve, 20 kahvede bir americano, 30
 * kahvede, 40 kahvede de menüden bir içecek veya tatlıyı rastgele hediye et."
 *
 * A milestone is counted in LIFETIME stamps (earned minus reversed - a
 * refunded order does not count toward one), is granted once per member and
 * milestone, and becomes a cafe-only coupon worth the gift's own price at the
 * moment it is granted - the same value model as the free drink, so the till
 * and the checkout need nothing new. A "random" milestone picks, on the
 * server and at that moment, one active drink or dessert from the menu; the
 * pick is recorded with the grant.
 */

export type MilestoneSpec = {
  /** Lifetime stamps that reach it. */
  at: number;
  /** The gift by its menu name, or null for a random drink or dessert. */
  item: string | null;
};

export const MILESTONE_GIFTS: readonly MilestoneSpec[] = [
  { at: 10, item: "Filtre Kahve" },
  { at: 20, item: "Americano" },
  { at: 30, item: null },
  { at: 40, item: null },
];

/** How long a milestone gift stays spendable. */
export const MILESTONE_TTL_DAYS = 30;

/** The menu's drink categories and the dessert case - what a random gift may be. */
export const GIFT_CATEGORIES: ReadonlySet<string> = new Set([
  "matcha",
  "espresso",
  "ice-coffee",
  "cold",
  "hot",
  "frappe",
  "smoothie",
  "frozen",
  "ice-tea",
  "dessert",
]);

export type GiftCandidate = {
  id: string;
  name: string;
  categoryKey: string;
  priceMinor: number;
  isActive: boolean;
};

/** Milestones reached at this lifetime count, in order. */
export function reachedMilestones(
  lifetime: number,
  specs: readonly MilestoneSpec[] = MILESTONE_GIFTS,
): MilestoneSpec[] {
  return specs.filter((m) => lifetime >= m.at).sort((a, b) => a.at - b.at);
}

/** The next milestone not yet reached, or null past the last. */
export function nextMilestone(
  lifetime: number,
  specs: readonly MilestoneSpec[] = MILESTONE_GIFTS,
): MilestoneSpec | null {
  return (
    [...specs].sort((a, b) => a.at - b.at).find((m) => lifetime < m.at) ?? null
  );
}

/** Whether an item may be given: on sale, priced, a drink or a dessert. */
export function isGiftable(item: GiftCandidate): boolean {
  return (
    item.isActive &&
    item.priceMinor > 0 &&
    GIFT_CATEGORIES.has(item.categoryKey)
  );
}

/**
 * The item a milestone gives. A named gift is looked up by its exact menu
 * name among what is on sale; if the operator renamed or retired it, the
 * milestone falls back to a random pick rather than giving nothing. `random`
 * is injected (0 ≤ r < 1) so the choice is testable.
 */
export function pickGift(
  spec: MilestoneSpec,
  menu: readonly GiftCandidate[],
  random: () => number,
): GiftCandidate | null {
  const pool = menu.filter(isGiftable);
  if (spec.item) {
    const named = pool.find(
      (m) =>
        m.name.trim().toLocaleLowerCase("tr-TR") ===
        spec.item!.toLocaleLowerCase("tr-TR"),
    );
    if (named) return named;
  }
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
}

/** The road map `/me` hands the app (docs/API-MOBILE.md §4, additive). */
export type MeMilestone = {
  at: number;
  /** What it gives: the named item, or the surprise's own words. */
  title: string;
  /** A random drink or dessert, picked when it is granted. */
  surprise: boolean;
  /** Lifetime stamps have reached it. */
  reached: boolean;
  /** It has been given, and as what. */
  given: boolean;
  gift: string;
};

export const SURPRISE_TITLE = "Sürpriz: menüden bir içecek ya da tatlı";

export function milestoneRoadmap(
  lifetime: number,
  grants: readonly { milestone: number; itemName: string }[],
  specs: readonly MilestoneSpec[] = MILESTONE_GIFTS,
): MeMilestone[] {
  const byAt = new Map(grants.map((g) => [g.milestone, g.itemName]));
  return [...specs]
    .sort((a, b) => a.at - b.at)
    .map((m) => ({
      at: m.at,
      title: m.item ?? SURPRISE_TITLE,
      surprise: m.item === null,
      reached: lifetime >= m.at,
      given: byAt.has(m.at),
      gift: byAt.get(m.at) ?? "",
    }));
}

/**
 * Each tier's perks, in words - ONLY what the server applies (Tüketici
 * Kanunu md. 61: a perk printed and not given misleads). Today that is one:
 * RUBY's karaoke discount, at the operator's configured percentage.
 */
export function perksByTier(
  oroKaraokePct: number,
): Record<"verde" | "argento" | "oro", string[]> {
  const pct = Math.max(0, Math.round(oroKaraokePct));
  return {
    verde: [],
    argento: [],
    oro: pct > 0 ? [`Karaoke odasında %${pct} indirim`] : [],
  };
}

/** The coupon's title: what the gift is. */
export function giftTitle(item: Pick<GiftCandidate, "name">): string {
  return `Hediye: ${item.name}`;
}

/** What a claw-back does to one milestone grant above the new lifetime. */
export type MilestoneClawBack = {
  milestone: number;
  couponId: string;
  /**
   * `withdraw`: the gift is unused - take the coupon back, then drop the
   * claim. `release`: the coupon is already inactive and unused (a claw-back
   * that stopped between its two writes) - only the claim is left to drop.
   */
  action: "withdraw" | "release";
};

/**
 * The milestone gifts a reversal no longer covers (karar 175 read against a
 * lifetime that went DOWN): every grant above the new lifetime whose gift is
 * still unused. Dropping its claim row lets the member earn that milestone
 * again, honestly, later - `grantMilestoneGifts` gives it once the lifetime
 * gets back there.
 *
 * A gift that was already used, or let expire, keeps its claim: it was
 * given and consumed, and handing it out a second time when the member
 * passes the milestone again would be the double gift. A claim still being
 * written (no coupon yet) and a coupon the admin revoked by hand are left
 * alone too. Only coupons of the `milestone` source are ever touched.
 */
export function milestonesToClawBack(
  lifetime: number,
  grants: readonly { milestone: number; couponId: string }[],
  coupons: readonly {
    id: string;
    source: string;
    isActive: boolean;
    redeemedAt: string;
    expiresAt: string;
  }[],
  nowMs: number,
): MilestoneClawBack[] {
  const byId = new Map(coupons.map((c) => [c.id, c]));
  const out: MilestoneClawBack[] = [];
  for (const g of [...grants].sort((a, b) => b.milestone - a.milestone)) {
    if (g.milestone <= lifetime || !g.couponId) continue;
    const c = byId.get(g.couponId);
    if (!c || c.source !== "milestone" || c.redeemedAt) continue;
    if (!c.isActive) {
      out.push({ milestone: g.milestone, couponId: c.id, action: "release" });
      continue;
    }
    const expires = c.expiresAt ? Date.parse(c.expiresAt) : Number.NaN;
    if (Number.isFinite(expires) && expires < nowMs) continue;
    out.push({ milestone: g.milestone, couponId: c.id, action: "withdraw" });
  }
  return out;
}
