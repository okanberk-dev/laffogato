import { describe, expect, it } from "vitest";

import { bucketRevenue, type AdminOrder } from "@/lib/admin/store";

function order(createdAt: string, totalMinor: number): AdminOrder {
  return {
    id: `ord-${createdAt}`,
    orderNo: 10001,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [],
    subtotalMinor: totalMinor,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor,
    refunds: [],
    createdAt,
  } as AdminOrder;
}

describe("revenue report buckets", () => {
  it("does not repeat the current month on the 31st", () => {
    // setMonth(8) on 31 October is "31 September" → 1 October: the report
    // used to show October twice and September not at all.
    const buckets = bucketRevenue(
      [],
      "month",
      3,
      new Date("2026-10-31T12:00:00Z"),
    );
    expect(buckets.map((b) => b.bucket)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("cuts days at Istanbul midnight, not UTC midnight", () => {
    // 01:30 in Tuzla on 23 Sept is 22:30 UTC on 22 Sept.
    const late = order("2026-09-22T22:30:00.000Z", 5000);
    const buckets = bucketRevenue(
      [late],
      "day",
      2,
      new Date("2026-09-23T09:00:00Z"),
    );
    expect(buckets.map((b) => b.bucket)).toEqual(["2026-09-22", "2026-09-23"]);
    expect(buckets[1]).toMatchObject({ revenueMinor: 5000, orderCount: 1 });
    expect(buckets[0]).toMatchObject({ revenueMinor: 0, orderCount: 0 });
  });

  it("names 'today' by the venue's date just after Istanbul midnight", () => {
    // 00:15 on 1 Oct in Tuzla is still 30 Sept in UTC.
    const buckets = bucketRevenue(
      [],
      "day",
      1,
      new Date("2026-09-30T21:15:00Z"),
    );
    expect(buckets[0].bucket).toBe("2026-10-01");
  });

  it("nets refunds against the order's own bucket", () => {
    const o = order("2026-09-10T10:00:00.000Z", 10000);
    o.refunds = [{ amountMinor: 2500 } as AdminOrder["refunds"][number]];
    const [b] = bucketRevenue(
      [o],
      "month",
      1,
      new Date("2026-09-23T09:00:00Z"),
    );
    expect(b).toMatchObject({
      bucket: "2026-09",
      revenueMinor: 7500,
      orderCount: 1,
    });
  });
});
