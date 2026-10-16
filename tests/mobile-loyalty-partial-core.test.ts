import { describe, expect, it } from "vitest";

import {
  abandonedCards,
  cardCost,
  couponlessCards,
  computeStampBalance,
  freeDrinkCouponId,
  nextFreeDrinkWithdrawal,
  orderStampHoldings,
  orphanClaimIds,
  plannedStampReversals,
  REDEEM_ROW_GRACE_MS,
  redeemIdOfClaim,
  redeemIdOfCoupon,
  stampCoverage,
  staleFreeDrinkClaims,
  stampedOrderIds,
  stampRefundedGoodsMinor,
  stampReversalId,
  stampsByOrder,
  stampTargetForOrder,
  tillCorrectionId,
  unredeemId,
  type LoyaltyStamp,
  type SettleCoupon,
} from "@/lib/mobile/loyalty-core";
import { milestonesToClawBack } from "@/lib/mobile/milestones-core";

/**
 * The pure half of "stamps follow the goods kept" (review of 16 Eki 2026):
 * the target after refunds, the per-stamp reversal plan, per-order sums, and
 * the debt a reversal leaves under coupons already given.
 */

let n = 0;
function row(
  kind: LoyaltyStamp["kind"],
  delta: number,
  orderId = "",
  extra: Partial<LoyaltyStamp> = {},
): LoyaltyStamp {
  n += 1;
  return {
    id: `stamp-${String(n).padStart(6, "0")}`,
    customerEmail: "eda@example.com",
    kind,
    delta,
    source: orderId ? "order" : "counter",
    orderId,
    note: "",
    actor: "",
    createdAt: `2026-10-16T09:${String(n).padStart(2, "0")}:00.000Z`,
    ...extra,
  };
}

const refunds = (...amounts: number[]) =>
  amounts.map((amountMinor) => ({ amountMinor }));

describe("stampTargetForOrder", () => {
  const order = { totalMinor: 100000, shippingMinor: 0, status: "paid" };

  it("follows the goods kept, one stamp per started 320 TL from 140 TL", () => {
    expect(stampTargetForOrder(order)).toBe(4);
    expect(stampTargetForOrder({ ...order, refunds: refunds(10000) })).toBe(3);
    expect(
      stampTargetForOrder({ ...order, refunds: refunds(10000, 35000) }),
    ).toBe(2);
    expect(stampTargetForOrder({ ...order, refunds: refunds(87000) })).toBe(0); // ₺130
    expect(stampTargetForOrder({ ...order, refunds: refunds(86000) })).toBe(1); // ₺140
  });

  it("keeps nothing for a cancelled or refunded order, or when told so", () => {
    expect(stampTargetForOrder({ ...order, status: "cancelled" })).toBe(0);
    expect(stampTargetForOrder({ ...order, status: "refunded" })).toBe(0);
    expect(stampTargetForOrder(order, { full: true })).toBe(0);
  });

  it("counts a refund against the courier fee first, never beyond the goods", () => {
    const withCourier = { totalMinor: 105500, shippingMinor: 5500 };
    // The courier fee on its own: no goods refunded.
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(5500) }),
    ).toBe(0);
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(3000, 2500) }),
    ).toBe(0);
    // Past the fee, the rest is goods.
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(15500) }),
    ).toBe(10000);
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(105500) }),
    ).toBe(100000);
    expect(
      stampTargetForOrder({ ...withCourier, refunds: refunds(5500) }),
    ).toBe(4);
    // No courier fee: every refunded kuruş is goods.
    expect(
      stampRefundedGoodsMinor({
        totalMinor: 100000,
        shippingMinor: 0,
        refunds: refunds(5500),
      }),
    ).toBe(5500);
    // Junk amounts are ignored rather than added back.
    expect(
      stampRefundedGoodsMinor({
        ...withCourier,
        refunds: refunds(-500, Number.NaN),
      }),
    ).toBe(0);
  });
});

describe("plannedStampReversals", () => {
  it("names one row per stamp above the target, highest first", () => {
    const rows = [row("earn", 4, "ord-1")];
    expect(plannedStampReversals(rows, "ord-1", 2)).toEqual([
      "stamp-rev-ord-1:4",
      "stamp-rev-ord-1:3",
    ]);
    expect(plannedStampReversals(rows, "ord-1", 0)).toEqual([
      "stamp-rev-ord-1:4",
      "stamp-rev-ord-1:3",
      "stamp-rev-ord-1:2",
      stampReversalId("ord-1", 1),
    ]);
    expect(stampReversalId("ord-1", 1)).toBe("stamp-rev-ord-1");
  });

  it("writes nothing once the order is at or under the target", () => {
    const rows = [
      row("earn", 4, "ord-1"),
      row("reversal", -1, "ord-1", { id: "stamp-rev-ord-1:4" }),
      row("reversal", -1, "ord-1", { id: "stamp-rev-ord-1:3" }),
    ];
    expect(plannedStampReversals(rows, "ord-1", 2)).toEqual([]);
    expect(plannedStampReversals(rows, "ord-1", 3)).toEqual([]);
    expect(plannedStampReversals(rows, "ord-1", 1)).toEqual([
      "stamp-rev-ord-1:2",
    ]);
  });

  it("never plans a stamp the order did not earn", () => {
    expect(plannedStampReversals([], "ord-1", 0)).toEqual([]);
    // An older whole-order reversal already took everything.
    const rows = [
      row("earn", 3, "ord-1"),
      row("reversal", -3, "ord-1", { id: "stamp-rev-ord-1" }),
    ];
    expect(plannedStampReversals(rows, "ord-1", 0)).toEqual([]);
  });
});

describe("per-order sums", () => {
  it("sums partial reversals instead of dropping the order", () => {
    const rows = [
      row("earn", 4, "ord-1"),
      row("reversal", -1, "ord-1"),
      row("earn", 2, "ord-2"),
      row("reversal", -1, "ord-2"),
      row("reversal", -1, "ord-2"),
      row("reversal", -1), // a till correction belongs to no order
    ];
    expect([...stampsByOrder(rows)]).toEqual([["ord-1", 3]]);
    expect([...stampedOrderIds(rows)]).toEqual(["ord-1"]);
    expect(orderStampHoldings(rows).get("ord-2")).toEqual({
      earned: 2,
      reversed: 2,
      held: 0,
    });
  });

  it("caps an order's reversals at what it earned", () => {
    // A race with an older deployment: the whole-order row and per-stamp rows.
    const rows = [
      row("earn", 1),
      row("earn", 3, "ord-1"),
      row("reversal", -3, "ord-1"),
      row("reversal", -1, "ord-1"),
    ];
    expect(computeStampBalance(rows, 6).lifetimeStamps).toBe(1);
    expect(orderStampHoldings(rows).get("ord-1")?.held).toBe(0);
  });
});

let c = 0;
function coupon(extra: Partial<SettleCoupon> = {}): SettleCoupon {
  c += 1;
  return {
    id: `cpn-${String(c).padStart(4, "0")}`,
    source: "loyalty",
    isActive: true,
    redeemedAt: "",
    expiresAt: "",
    createdAt: `2026-10-16T10:${String(c).padStart(2, "0")}:00.000Z`,
    ...extra,
  };
}

/** The coupon `redeemStamps` mints for a redeem row. */
const couponFor = (redeem: LoyaltyStamp, extra: Partial<SettleCoupon> = {}) =>
  coupon({
    id: freeDrinkCouponId(redeem.id),
    createdAt: redeem.createdAt,
    ...extra,
  });

const NOW = Date.parse("2026-10-16T12:00:00.000Z");

describe("stampCoverage: lifetime − Σ cost of the standing cards", () => {
  it("prices each card at its own redeem delta, never the current card", () => {
    const rows = [row("earn", 14), row("redeem", -6), row("redeem", -4)];
    expect(stampCoverage(rows)).toBe(4);
    expect(cardCost(rows[1])).toBe(6);
    // The same ledger read on any card size covers the same.
    for (const t of [3, 4, 6, 8, 20]) {
      expect(stampCoverage(rows)).toBe(14 - 10);
      expect(computeStampBalance(rows, t).lifetimeStamps).toBe(14);
    }
  });

  it("goes negative when reversed stamps had paid for a card, and an unredeem restores it", () => {
    const redeem = row("redeem", -6);
    const reversed = [
      row("earn", 3),
      row("earn", 4, "ord-1"),
      redeem,
      ...[4, 3, 2, 1].map((i) =>
        row("reversal", -1, "ord-1", { id: stampReversalId("ord-1", i) }),
      ),
    ];
    expect(stampCoverage(reversed)).toBe(3 - 6);
    expect(computeStampBalance(reversed, 6).available).toBe(0);
    const settled = [
      ...reversed,
      row("unredeem", 6, "", { id: unredeemId(redeem.id) }),
    ];
    expect(stampCoverage(settled)).toBe(3);
    expect(computeStampBalance(settled, 6)).toMatchObject({
      redeemCount: 0,
      available: 3,
      stamps: 3,
    });
  });

  it("bounds the balance by card cost after the card shrank", () => {
    // A card of 6, then the operator set 4: 8 stamps leave 2, not 4.
    const rows = [row("earn", 8), row("redeem", -6)];
    expect(computeStampBalance(rows, 4)).toMatchObject({
      available: 2,
      rewardsReady: 0,
    });
    // A card that grew still reads at the new size (the setting's promise).
    expect(
      computeStampBalance([row("earn", 14), row("redeem", -6)], 8),
    ).toMatchObject({ available: 6, rewardsReady: 0 });
  });
});

describe("nextFreeDrinkWithdrawal", () => {
  it("names nothing while the stamps cover every card", () => {
    const r = row("redeem", -6);
    const rows = [row("earn", 6), r];
    expect(stampCoverage(rows)).toBe(0);
    expect(nextFreeDrinkWithdrawal(rows, [couponFor(r)], NOW)).toBeNull();
  });

  it("takes the newest unused coupon and its own card at that card's cost", () => {
    const older = row("redeem", -6);
    const newer = row("redeem", -4);
    const rows = [row("earn", 9), older, newer];
    expect(stampCoverage(rows)).toBe(-1);
    const plan = nextFreeDrinkWithdrawal(
      rows,
      [couponFor(older), couponFor(newer)],
      NOW,
    );
    expect(plan).toEqual({
      couponId: freeDrinkCouponId(newer.id),
      redeemId: newer.id,
      cost: 4,
      claimed: false,
    });
    expect(redeemIdOfCoupon(plan!.couponId)).toBe(newer.id);
  });

  it("skips used, expired, inactive and foreign coupons", () => {
    const a = row("redeem", -6);
    const b = row("redeem", -6);
    const rows = [row("earn", 6), a, b];
    const used = couponFor(b, { redeemedAt: "2026-10-16T11:00:00.000Z" });
    expect(
      nextFreeDrinkWithdrawal(
        rows,
        [
          used,
          coupon({ source: "invite" }),
          couponFor(a, { expiresAt: "2026-10-16T11:59:00.000Z" }),
        ],
        NOW,
      ),
    ).toBeNull();
    expect(
      nextFreeDrinkWithdrawal(
        rows,
        [used, couponFor(a, { isActive: false })],
        NOW,
      ),
    ).toBeNull();
    // The older card's coupon is unused: it goes, the used one stays.
    expect(nextFreeDrinkWithdrawal(rows, [used, couponFor(a)], NOW)).toEqual({
      couponId: freeDrinkCouponId(a.id),
      redeemId: a.id,
      cost: 6,
      claimed: false,
    });
  });

  it("finishes a withdrawal another settlement claimed and left half done", () => {
    const a = row("redeem", -6);
    const b = row("redeem", -6);
    const claimed = [
      row("earn", 1),
      a,
      b,
      row("unredeem", 6, "", { id: unredeemId(b.id) }),
    ];
    // Still 5 short after the claim, but b's coupon is unused on a card
    // already unredeemed: that one goes first, with no new row to write.
    expect(stampCoverage(claimed)).toBe(-5);
    expect(
      nextFreeDrinkWithdrawal(claimed, [couponFor(a), couponFor(b)], NOW),
    ).toEqual({
      couponId: freeDrinkCouponId(b.id),
      redeemId: b.id,
      cost: 6,
      claimed: true,
    });
    // Once it is taken the next card is a fresh claim.
    expect(
      nextFreeDrinkWithdrawal(
        claimed,
        [couponFor(a), couponFor(b, { isActive: false })],
        NOW,
      ),
    ).toMatchObject({ redeemId: a.id, claimed: false });
  });

  it("finishes a half-done withdrawal although the stamps cover every card", () => {
    const a = row("redeem", -6);
    // 12 stamps, one card of 6, and its coupon is still unused: covered 12.
    const rows = [
      row("earn", 12),
      a,
      row("unredeem", 6, "", { id: unredeemId(a.id) }),
    ];
    expect(stampCoverage(rows)).toBeGreaterThanOrEqual(0);
    expect(nextFreeDrinkWithdrawal(rows, [couponFor(a)], NOW)).toEqual({
      couponId: freeDrinkCouponId(a.id),
      redeemId: a.id,
      cost: 6,
      claimed: true,
    });
    // Nothing to finish once the coupon is inactive, used or expired.
    for (const extra of [
      { isActive: false },
      { redeemedAt: "2026-10-16T11:00:00.000Z" },
      { expiresAt: "2026-10-16T11:59:00.000Z" },
    ]) {
      expect(
        nextFreeDrinkWithdrawal(rows, [couponFor(a, extra)], NOW),
      ).toBeNull();
    }
  });

  it("takes an orphan: a coupon whose redeem row is gone, whatever the coverage", () => {
    const a = row("redeem", -6);
    const rows = [row("earn", 12), a];
    const gone = freeDrinkCouponId("stamp-999999");
    expect(
      nextFreeDrinkWithdrawal(
        rows,
        [couponFor(a), coupon({ id: gone, createdAt: a.createdAt })],
        NOW,
      ),
    ).toEqual({ couponId: gone, redeemId: "", cost: 0, claimed: false });
    // An unlinked coupon with no card before it is no orphan.
    expect(
      nextFreeDrinkWithdrawal(
        rows,
        [
          couponFor(a),
          coupon({ id: "cpn-0007", createdAt: "2026-01-01T00:00:00.000Z" }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("pairs a coupon granted before ids were linked with the newest card before it", () => {
    const r1 = row("redeem", -6, "", { createdAt: "2026-09-01T10:00:00.000Z" });
    const r2 = row("redeem", -6, "", { createdAt: "2026-09-10T10:00:00.000Z" });
    const rows = [
      row("earn", 7, "", { createdAt: "2026-08-01T10:00:00.000Z" }),
      r1,
      r2,
    ];
    const l1 = coupon({
      id: "cpn-0101",
      createdAt: "2026-09-01T10:00:01.000Z",
    });
    const l2 = coupon({
      id: "cpn-0102",
      createdAt: "2026-09-10T10:00:01.000Z",
      redeemedAt: "2026-09-11T10:00:00.000Z",
    });
    // l2 is used; l1 belongs to r1, not to the newer r2.
    expect(nextFreeDrinkWithdrawal(rows, [l1, l2], NOW)).toEqual({
      couponId: "cpn-0101",
      redeemId: r1.id,
      cost: 6,
      claimed: false,
    });
  });
});

describe("legacy pairing does not depend on the claims", () => {
  // Two cards and their two plain-id coupons, granted before ids were linked.
  const r1 = row("redeem", -6, "", { createdAt: "2026-09-01T10:00:00.000Z" });
  const r2 = row("redeem", -6, "", { createdAt: "2026-09-10T10:00:00.000Z" });
  const l1 = coupon({ id: "cpn-0101", createdAt: "2026-09-01T10:00:01.000Z" });
  const l2 = coupon({ id: "cpn-0102", createdAt: "2026-09-10T10:00:01.000Z" });
  const earn = row("earn", 0, "", { createdAt: "2026-08-01T10:00:00.000Z" });

  it("keeps each coupon on its own card once the newer card is claimed", () => {
    // Settlement A has claimed r2 (l2's card). Settlement B reads now: l2 must
    // not slide onto r1, or B would claim r1 for l2 and strand l1.
    const claimedNewest = [
      earn,
      r1,
      r2,
      row("unredeem", 6, "", { id: unredeemId(r2.id) }),
    ];
    expect(nextFreeDrinkWithdrawal(claimedNewest, [l1, l2], NOW)).toEqual({
      couponId: "cpn-0102",
      redeemId: r2.id,
      cost: 6,
      claimed: true,
    });
    // A took l2: the next card is r1, with l1, not a second claim on r2.
    expect(
      nextFreeDrinkWithdrawal(
        claimedNewest,
        [l1, { ...l2, isActive: false }],
        NOW,
      ),
    ).toEqual({
      couponId: "cpn-0101",
      redeemId: r1.id,
      cost: 6,
      claimed: false,
    });
  });

  it("pairs over used and withdrawn coupons too", () => {
    // l2 is spent; l1 is still on r1, never on the newer r2.
    const used = { ...l2, redeemedAt: "2026-09-11T10:00:00.000Z" };
    expect(nextFreeDrinkWithdrawal([earn, r1, r2], [l1, used], NOW)).toEqual({
      couponId: "cpn-0101",
      redeemId: r1.id,
      cost: 6,
      claimed: false,
    });
  });
});

describe("staleFreeDrinkClaims", () => {
  it("names a claim whose coupon was spent or is held, and no other", () => {
    const a = row("redeem", -6);
    const b = row("redeem", -6);
    const c = row("redeem", -6);
    const rows = [
      row("earn", 3),
      a,
      b,
      c,
      row("unredeem", 6, "", { id: unredeemId(a.id) }),
      row("unredeem", 6, "", { id: unredeemId(b.id) }),
    ];
    const spent = couponFor(a, { redeemedAt: "2026-10-16T11:00:00.000Z" });
    const withdrawn = couponFor(b, { isActive: false });
    const standing = couponFor(c, { redeemedAt: "2026-10-16T11:00:00.000Z" });
    expect(staleFreeDrinkClaims(rows, [spent, withdrawn, standing])).toEqual([
      { redeemId: a.id, couponId: spent.id },
    ]);
  });
});

describe("orphanClaimIds and redeemIdOfClaim", () => {
  it("names a claim whose redeem row is gone, and no other", () => {
    const a = row("redeem", -6);
    const gone = row("redeem", -6);
    const rows = [
      row("earn", 3),
      a,
      row("unredeem", 6, "", { id: unredeemId(a.id) }),
      row("unredeem", 6, "", { id: unredeemId(gone.id) }),
      // Not one of ours: no id to read a card from.
      row("unredeem", 6, "", { id: "stamp-hand-written" }),
    ];
    expect(orphanClaimIds(rows)).toEqual([unredeemId(gone.id)]);
  });

  it("reads the card out of a claim id", () => {
    expect(redeemIdOfClaim(unredeemId("stamp-000007"))).toBe("stamp-000007");
    expect(redeemIdOfClaim("stamp-000007")).toBeNull();
    expect(redeemIdOfClaim("stamp-unredeem-")).toBeNull();
  });
});

describe("couponlessCards and abandonedCards", () => {
  const T0 = Date.parse("2026-10-16T09:00:00.000Z");
  const card = (extra: Partial<LoyaltyStamp> = {}) =>
    row("redeem", -6, "", {
      source: "app",
      createdAt: new Date(T0).toISOString(),
      ...extra,
    });

  it("a card with no coupon is couponless at once, abandoned only past the grace window", () => {
    const withCoupon = card();
    const bare = card();
    const rows = [row("earn", 12), withCoupon, bare];
    const coupons = [couponFor(withCoupon)];
    expect(couponlessCards(rows, coupons).map((r) => r.id)).toEqual([bare.id]);
    expect(abandonedCards(rows, coupons, T0 + REDEEM_ROW_GRACE_MS)).toEqual([]);
    expect(
      abandonedCards(rows, coupons, T0 + REDEEM_ROW_GRACE_MS + 1).map(
        (r) => r.id,
      ),
    ).toEqual([bare.id]);
  });

  it("a used or withdrawn coupon is still the card's coupon", () => {
    const a = card();
    const b = card();
    const rows = [row("earn", 12), a, b];
    const coupons = [
      couponFor(a, { redeemedAt: "2026-10-16T09:30:00.000Z" }),
      couponFor(b, { isActive: false }),
    ];
    expect(couponlessCards(rows, coupons)).toEqual([]);
  });

  it("leaves other sources alone", () => {
    const rows = [row("earn", 12), card({ source: "counter" })];
    expect(couponlessCards(rows, [])).toEqual([]);
  });

  it("a legacy coupon pairs with the newest earlier card, so only the other is bare", () => {
    const old = card({ createdAt: "2026-09-01T10:00:00.000Z" });
    const newer = card({ createdAt: "2026-09-10T10:00:00.000Z" });
    const legacy = coupon({
      id: "cpn-0900",
      createdAt: "2026-09-10T10:00:01.000Z",
    });
    expect(
      couponlessCards([row("earn", 12), old, newer], [legacy]).map((r) => r.id),
    ).toEqual([old.id]);
  });

  it("returns nothing while a coupon of unknown origin matches no card", () => {
    const bare = card({ createdAt: "2026-10-16T10:00:00.000Z" });
    const stray = coupon({
      id: "cpn-0901",
      createdAt: "2026-10-16T09:00:00.000Z",
    });
    expect(couponlessCards([row("earn", 12), bare], [stray])).toEqual([]);
  });
});

describe("tillCorrectionId", () => {
  const ids = (...xs: string[]) => xs.map((id) => ({ id }));

  it("is the same for two clicks that read the same ledger, in any order", () => {
    const rows = ids("stamp-000001", "stamp-000002", "stamp-till-x");
    expect(tillCorrectionId(rows)).toBe(tillCorrectionId([...rows].reverse()));
    expect(tillCorrectionId(rows)).toMatch(/^stamp-till-[0-9a-f]{16}$/);
  });

  it("moves on whenever a row lands or goes, even one written in the same instant", () => {
    const base = ids("stamp-000001", "stamp-000002");
    const seen = new Set([
      tillCorrectionId(base),
      tillCorrectionId([...base, ...ids("stamp-000003")]),
      tillCorrectionId(ids("stamp-000001")),
      tillCorrectionId([...base, ...ids("stamp-till-aaaaaaaaaaaaaaaa")]),
    ]);
    expect(seen.size).toBe(4);
  });
});

describe("milestonesToClawBack", () => {
  const NOW = Date.parse("2026-10-16T12:00:00.000Z");
  const coupon = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    source: "milestone",
    isActive: true,
    redeemedAt: "",
    expiresAt: "2026-11-15T12:00:00.000Z",
    ...over,
  });

  it("takes back unused gifts above the new lifetime only", () => {
    const grants = [
      { milestone: 10, couponId: "c-10" },
      { milestone: 20, couponId: "c-20" },
      { milestone: 30, couponId: "c-30" },
    ];
    const coupons = [
      coupon("c-10"),
      coupon("c-20"),
      coupon("c-30", { isActive: false }),
    ];
    expect(milestonesToClawBack(12, grants, coupons, NOW)).toEqual([
      { milestone: 30, couponId: "c-30", action: "release" },
      { milestone: 20, couponId: "c-20", action: "withdraw" },
    ]);
  });

  it("keeps a used, expired, unrecorded or foreign gift", () => {
    const grants = [
      { milestone: 10, couponId: "used" },
      { milestone: 20, couponId: "expired" },
      { milestone: 30, couponId: "" },
      { milestone: 40, couponId: "loyalty" },
    ];
    const coupons = [
      coupon("used", { redeemedAt: "2026-10-10T10:00:00.000Z" }),
      coupon("expired", { expiresAt: "2026-10-01T00:00:00.000Z" }),
      coupon("loyalty", { source: "loyalty" }),
    ];
    expect(milestonesToClawBack(0, grants, coupons, NOW)).toEqual([]);
  });
});
