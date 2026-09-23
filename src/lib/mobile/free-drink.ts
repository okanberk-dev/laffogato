import "server-only";

import { getSettings } from "@/lib/admin/store";
import { grantCoupon, type CustomerCoupon } from "@/lib/customer/coupons";

import { DEFAULT_MOBILE_APP_CONFIG } from "./app-config";
import { freeDrinkRewardFor, type FreeDrinkReward } from "./loyalty-core";

/**
 * The free-drink coupon (docs/API-MOBILE.md §5). One definition for both
 * paths that hand it out - a full stamp card and a settled invite - so the
 * two rewards cannot drift apart.
 *
 * The value, title and shelf life are the operator's
 * (`settings."mobileApp".loyalty`, /admin/mobil/ayarlar); this constant is
 * the built-in default, kept for callers and tests that reason about the
 * reward without a settings row.
 */
export const FREE_DRINK_REWARD: FreeDrinkReward = freeDrinkRewardFor(
  DEFAULT_MOBILE_APP_CONFIG.loyalty,
);

/** The reward as currently configured. */
export async function currentFreeDrinkReward(): Promise<FreeDrinkReward> {
  const { mobileApp } = await getSettings();
  return freeDrinkRewardFor(mobileApp.loyalty);
}

export function freeDrinkExpiry(
  nowMs: number,
  ttlDays: number = FREE_DRINK_REWARD.ttlDays,
): string {
  return new Date(nowMs + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Grants the coupon to `email`. `reward` lets a caller that has already read
 * the settings (the redeem path) pass them on; without it the live rules are
 * read here, so the invite path picks up the configured value too.
 */
export async function grantFreeDrinkCoupon(
  email: string,
  source: "loyalty" | "invite",
  reward?: FreeDrinkReward,
): Promise<CustomerCoupon> {
  const r = reward ?? (await currentFreeDrinkReward());
  return grantCoupon({
    email,
    kind: r.kind,
    value: r.valueMinor,
    minSubtotalMinor: r.minSubtotalMinor,
    title: r.title,
    source,
    expiresAt: freeDrinkExpiry(Date.now(), r.ttlDays),
  });
}
