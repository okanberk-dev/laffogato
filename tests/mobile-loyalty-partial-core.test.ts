import { describe, expect, it } from "vitest";

import {
  computeStampBalance,
  orderStampHoldings,
  plannedStampReversals,
  plannedWithdrawals,
  redeemsToWithdraw,
  reversalDebt,
  stampDebt,
  stampedOrderIds,
  stampRefundedGoodsMinor,
  stampReversalId,
  stampsByOrder,
  stampTargetForOrder,
  unredeemId,
  type LoyaltyStamp,
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

  it("charges refunds to the goods first, never beyond them", () => {
    const withCourier = { totalMinor: 105500, shippingMinor: 5500 };
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(5500) }),
    ).toBe(5500);
    expect(
      stampRefundedGoodsMinor({ ...withCourier, refunds: refunds(105500) }),
    ).toBe(100000);
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

describe("the debt a reversal leaves under spent cards", () => {
  it("is target × redeemed − lifetime, and an unredeem withdraws one card", () => {
    const earned = [row("earn", 3), row("earn", 4, "ord-1")];
    const redeem = row("redeem", -6);
    const reversed = [
      ...earned,
      redeem,
      ...[4, 3, 2, 1].map((i) =>
        row("reversal", -1, "ord-1", { id: stampReversalId("ord-1", i) }),
      ),
    ];
    const owed = computeStampBalance(reversed, 6);
    expect(owed).toMatchObject({
      lifetimeStamps: 3,
      redeemCount: 1,
      available: 0,
    });
    expect(stampDebt(owed, 6)).toBe(3);
    expect(redeemsToWithdraw(reversed, 6)).toEqual([redeem.id]);

    const settled = [
      ...reversed,
      row("unredeem", 6, "", { id: unredeemId(redeem.id) }),
    ];
    expect(computeStampBalance(settled, 6)).toMatchObject({
      redeemCount: 0,
      available: 3,
      stamps: 3,
    });
    expect(redeemsToWithdraw(settled, 6)).toEqual([]);
  });

  it("withdraws one card per card short, newest first", () => {
    const rows = [
      row("earn", 8),
      row("earn", 10, "ord-1"),
      row("redeem", -6),
      row("redeem", -6),
      row("redeem", -6),
      ...Array.from({ length: 10 }, (_, i) =>
        row("reversal", -1, "ord-1", { id: stampReversalId("ord-1", i + 1) }),
      ),
    ];
    // 8 against 18: 10 short → two cards.
    const [, , older, middle, newest] = rows;
    expect(redeemsToWithdraw(rows, 6)).toEqual([newest.id, middle.id]);
    expect(redeemsToWithdraw(rows, 6)).not.toContain(older.id);
    expect(reversalDebt(rows, 6)).toBe(10);
  });

  it("owes nothing without a reversal, whatever the card size says", () => {
    // Two cards of 6 redeemed, then the card grew to 8: the balance reads
    // 12 against 16, but no stamp was ever taken back.
    const rows = [row("earn", 12), row("redeem", -6), row("redeem", -6)];
    expect(stampDebt(computeStampBalance(rows, 8), 8)).toBe(4);
    expect(reversalDebt(rows, 8)).toBe(0);
    expect(plannedWithdrawals(rows, 8)).toEqual([]);
  });

  it("prices a card at what it cost, and never above what reversals took", () => {
    const base = [
      row("earn", 3),
      row("earn", 4, "ord-1"),
      row("redeem", -6),
      ...[4, 3, 2, 1].map((i) =>
        row("reversal", -1, "ord-1", { id: stampReversalId("ord-1", i) }),
      ),
    ];
    // At a card of 8: owed min(8, 6) − 3 = 3, capped by the 4 reversed.
    expect(reversalDebt(base, 8)).toBe(3);
    expect(plannedWithdrawals(base, 8)).toEqual([
      { redeemId: base[2].id, cost: 6 },
    ]);
    // One stamp reversed while the card grew from 6 to 8: two cards of 6
    // against 12 stamps are still paid in full.
    const reversedOne = (counter: number) => [
      row("earn", counter),
      row("earn", 1, "ord-2"),
      row("redeem", -6),
      row("redeem", -6),
      row("reversal", -1, "ord-2", { id: stampReversalId("ord-2", 1) }),
    ];
    expect(reversalDebt(reversedOne(12), 8)).toBe(0);
    // With 11 till stamps the reversed one was under a card: 1 owed, one
    // card withdrawn.
    const short = reversedOne(11);
    expect(reversalDebt(short, 6)).toBe(1);
    expect(redeemsToWithdraw(short, 6)).toEqual([short[3].id]);
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
