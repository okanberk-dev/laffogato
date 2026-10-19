import { describe, expect, it, vi } from "vitest";

import type { CompiledQuery } from "@/lib/db/sql";

/**
 * Which member coupon paid for an order (ASK-COUPON, 18 Eki 2026): the
 * order page and the order CSV ask `couponSourcesForOrders`, and a reward
 * coupon (loyalty, milestone, invite) turns their KDV split into the
 * invoice's, at full price. What is pinned: only orders that took a
 * discount under a code are asked for, the coupon must be the order's own
 * (its code and the order it was spent on), a shared promo code is left
 * out, and a failed read throws instead of looking like "no reward".
 */

const db = vi.hoisted(() => ({
  queries: [] as CompiledQuery[],
  rows: [] as Record<string, unknown>[],
  fail: false,
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb } = await import("@/lib/db/client");
  const sb = createDb(async (q) => {
    db.queries.push(q);
    if (db.fail) {
      throw Object.assign(new Error("relation is locked"), { code: "55P03" });
    }
    return { rows: db.rows, rowCount: db.rows.length };
  });
  return { ...real, getDb: () => sb };
});

const { couponSourcesForOrders } = await import("@/lib/customer/coupons");

function reset(rows: Record<string, unknown>[] = []) {
  db.queries = [];
  db.rows = rows;
  db.fail = false;
}

describe("couponSourcesForOrders", () => {
  it("maps each order to the source of the coupon it redeemed", async () => {
    reset([
      { code: "SD-7K2M9Q", source: "loyalty", redeemedOrderNo: 10001 },
      // The member's coupon on 10002 is another code than the order's: the
      // order took the shared promo code, not this coupon.
      { code: "HD-ABCDEF", source: "manual", redeemedOrderNo: 10002 },
      { code: "KT-PQRSTU", source: "milestone", redeemedOrderNo: "10005" },
    ]);
    const out = await couponSourcesForOrders([
      { orderNo: 10001, promoCode: " sd-7k2m9q ", discountMinor: 12_000 },
      { orderNo: 10002, promoCode: "HOSGELDIN", discountMinor: 3_000 },
      { orderNo: 10003, promoCode: "", discountMinor: 0 },
      { orderNo: 10004, promoCode: "HD-ZZZZZZ", discountMinor: 0 },
      { orderNo: 10005, promoCode: "KT-PQRSTU", discountMinor: 25_000 },
    ]);
    expect([...out.entries()]).toEqual([
      [10001, "loyalty"],
      [10005, "milestone"],
    ]);
    // One read, for the orders that took a discount under a code only.
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].text).toContain('"customer_coupons"');
    expect(db.queries[0].text).toMatch(/"redeemedOrderNo" IN \(/);
    expect(db.queries[0].params).toEqual([10001, 10002, 10005]);
  });

  it("asks nothing when no order took a coupon", async () => {
    reset();
    const out = await couponSourcesForOrders([
      { orderNo: 10003, promoCode: "", discountMinor: 0 },
    ]);
    expect(out.size).toBe(0);
    expect(db.queries).toHaveLength(0);
  });

  it("reads a long export in batches of 500 order numbers", async () => {
    reset();
    const orders = Array.from({ length: 1_201 }, (_, i) => ({
      orderNo: 10_001 + i,
      promoCode: "SD-7K2M9Q",
      discountMinor: 100,
    }));
    await couponSourcesForOrders(orders);
    expect(db.queries.map((q) => q.params.length)).toEqual([500, 500, 201]);
  });

  it("throws on a failed read: a hidden reward would put the wrong KDV on an invoice", async () => {
    reset();
    db.fail = true;
    await expect(
      couponSourcesForOrders([
        { orderNo: 10001, promoCode: "SD-7K2M9Q", discountMinor: 12_000 },
      ]),
    ).rejects.toThrow();
  });
});
