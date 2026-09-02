import "server-only";

import { grantCoupon, type CustomerCoupon } from "@/lib/customer/coupons";

/**
 * The free-drink coupon (docs/API-MOBILE.md §5). One definition for both
 * paths that hand it out — a full stamp card and a settled invite — so the
 * two rewards cannot drift apart.
 */
export const FREE_DRINK_REWARD = {
  kind: "fixed" as const,
  valueMinor: 28000,
  title: "Ücretsiz içecek",
  minSubtotalMinor: 0,
  ttlDays: 90,
};

export function freeDrinkExpiry(nowMs: number): string {
  return new Date(
    nowMs + FREE_DRINK_REWARD.ttlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export async function grantFreeDrinkCoupon(
  email: string,
  source: "loyalty" | "invite",
): Promise<CustomerCoupon> {
  return grantCoupon({
    email,
    kind: FREE_DRINK_REWARD.kind,
    value: FREE_DRINK_REWARD.valueMinor,
    minSubtotalMinor: FREE_DRINK_REWARD.minSubtotalMinor,
    title: FREE_DRINK_REWARD.title,
    source,
    expiresAt: freeDrinkExpiry(Date.now()),
  });
}
