import { describe, expect, it } from "vitest";

import {
  birthdayMonth,
  computeCouponDiscount,
  couponStatus,
  evaluateCoupon,
  generateCouponCode,
  normalizeCouponCode,
  type CustomerCoupon,
} from "@/lib/customer/coupons";

function coupon(over: Partial<CustomerCoupon> = {}): CustomerCoupon {
  return {
    id: "cpn-0001",
    customerEmail: "a@b.com",
    code: "HG-ABCDEF",
    title: "",
    kind: "pct",
    value: 15,
    minSubtotalMinor: 20000,
    source: "welcome",
    expiresAt: "",
    redeemedAt: "",
    redeemedOrderNo: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const NOW = Date.UTC(2026, 5, 20); // 2026-06-20

describe("normalizeCouponCode", () => {
  it("trims, uppercases and strips whitespace", () => {
    expect(normalizeCouponCode("  hg-ab cd ef ")).toBe("HG-ABCDEF");
  });
});

describe("generateCouponCode", () => {
  it("produces PREFIX-XXXXXX with only unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCouponCode("HG")).toMatch(
        /^HG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
      );
    }
  });
});

describe("computeCouponDiscount", () => {
  it("floors percentage discounts", () => {
    expect(computeCouponDiscount("pct", 20, 10000)).toBe(2000);
    expect(computeCouponDiscount("pct", 15, 3333)).toBe(499); // floor(499.95)
  });
  it("caps fixed discounts at the subtotal", () => {
    expect(computeCouponDiscount("fixed", 5000, 3000)).toBe(3000);
    expect(computeCouponDiscount("fixed", 5000, 8000)).toBe(5000);
  });
  it("returns 0 for an empty cart", () => {
    expect(computeCouponDiscount("pct", 15, 0)).toBe(0);
  });
});

describe("evaluateCoupon", () => {
  it("accepts an active coupon over the minimum", () => {
    const r = evaluateCoupon(coupon(), 30000, NOW);
    expect(r).toEqual({ ok: true, discountMinor: 4500 });
  });
  it("rejects an already-redeemed coupon", () => {
    const r = evaluateCoupon(
      coupon({ redeemedAt: "2026-06-01T00:00:00.000Z" }),
      30000,
      NOW,
    );
    expect(r.ok).toBe(false);
  });
  it("rejects an inactive coupon", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), 30000, NOW).ok).toBe(
      false,
    );
  });
  it("rejects an expired coupon", () => {
    const r = evaluateCoupon(
      coupon({ expiresAt: "2020-01-01T00:00:00.000Z" }),
      30000,
      NOW,
    );
    expect(r.ok).toBe(false);
  });
  it("rejects a cart under the minimum subtotal", () => {
    expect(
      evaluateCoupon(coupon({ minSubtotalMinor: 20000 }), 10000, NOW).ok,
    ).toBe(false);
  });
  it("honors a fixed coupon with no minimum", () => {
    const r = evaluateCoupon(
      coupon({ kind: "fixed", value: 5000, minSubtotalMinor: 0 }),
      3000,
      NOW,
    );
    expect(r).toEqual({ ok: true, discountMinor: 3000 });
  });
});

describe("couponStatus", () => {
  it("classifies redeemed / inactive / expired / active", () => {
    expect(
      couponStatus(coupon({ redeemedAt: "2026-06-01T00:00:00Z" }), NOW),
    ).toBe("redeemed");
    expect(couponStatus(coupon({ isActive: false }), NOW)).toBe("inactive");
    expect(
      couponStatus(coupon({ expiresAt: "2020-01-01T00:00:00Z" }), NOW),
    ).toBe("expired");
    expect(couponStatus(coupon(), NOW)).toBe("active");
  });
});

describe("birthdayMonth", () => {
  it("parses full and short dates, rejects junk", () => {
    expect(birthdayMonth("1990-05-20")).toBe(5);
    expect(birthdayMonth("05-20")).toBe(5);
    expect(birthdayMonth("1990-13-01")).toBeNull();
    expect(birthdayMonth("not-a-date")).toBeNull();
    expect(birthdayMonth("")).toBeNull();
  });
});
