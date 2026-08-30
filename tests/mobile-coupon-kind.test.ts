import { describe, expect, it } from "vitest";

import {
  CAFE_ONLY_COUPON_MESSAGE,
  couponAllowedForKind,
  isCafeOnlyCoupon,
} from "@/lib/customer/coupons";
import { promoPreviewBodySchema } from "@/lib/mobile/order-schema";

/**
 * The rule used to live twice: enforced when the order was placed, forgotten
 * in the preview. A member with a free-drink reward and a bag of beans in the
 * basket was shown the discount and then charged full price.
 */
describe("cafe-only coupons", () => {
  it("marks the two sources that buy a drink", () => {
    expect(isCafeOnlyCoupon({ source: "loyalty" })).toBe(true);
    expect(isCafeOnlyCoupon({ source: "invite" })).toBe(true);
  });

  it("leaves money-off coupons alone", () => {
    for (const source of ["welcome", "birthday", "manual", "review"] as const) {
      expect(isCafeOnlyCoupon({ source }), source).toBe(false);
      expect(couponAllowedForKind({ source }, "shop"), source).toBe(true);
    }
    expect(isCafeOnlyCoupon(null)).toBe(false);
    expect(isCafeOnlyCoupon({})).toBe(false);
  });

  it("spends a drink coupon on a cafe basket and nowhere else", () => {
    expect(couponAllowedForKind({ source: "loyalty" }, "cafe")).toBe(true);
    expect(couponAllowedForKind({ source: "loyalty" }, "shop")).toBe(false);
  });

  it("refuses rather than promises when the basket kind is unknown", () => {
    // Matches what the till already did with an absent kind: refusing a
    // spendable coupon is recoverable, promising a dropped one is not.
    expect(couponAllowedForKind({ source: "invite" }, undefined)).toBe(false);
  });

  it("says why, in Turkish", () => {
    expect(CAFE_ONLY_COUPON_MESSAGE).toContain("kafe");
  });

  it("lets the standalone promo preview carry the basket kind", () => {
    const withKind = promoPreviewBodySchema.safeParse({
      code: "LAF-ODUL",
      subtotalMinor: 32000,
      kind: "shop",
    });
    expect(withKind.success).toBe(true);
    // Older builds that do not send it still parse.
    expect(
      promoPreviewBodySchema.safeParse({ code: "X", subtotalMinor: 1 }).success,
    ).toBe(true);
    expect(
      promoPreviewBodySchema.safeParse({
        code: "X",
        subtotalMinor: 1,
        kind: "karaoke",
      }).success,
    ).toBe(false);
  });
});
