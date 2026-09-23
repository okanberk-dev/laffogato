// Pure, isomorphic coupon helpers - NO "server-only", NO node:crypto, NO DB.
// Safe to import from client components (e.g. the admin coupon panel) as well
// as the server-only data layer in `./coupons`.

import { priceLabel } from "@/lib/utils/format";

export type CouponKind = "pct" | "fixed";

/** Where a coupon came from - drives the code prefix + member-facing copy. */
export type CouponSource =
  | "welcome" // auto on e-mail verification
  | "birthday" // auto during the member's birthday month
  | "loyalty" // reward (admin/automation)
  | "manual" // hand-granted by an admin
  | "review" // reward for leaving a review (phase 2)
  | "invite" // referral reward - inviter and invitee (mobile app)
  | "milestone"; // a lifetime-stamp milestone gift (karar 175)

/**
 * Sources whose coupon buys a DRINK, not money off anything.
 *
 * A loyalty reward is the sixth coffee and a referral reward is a drink for
 * bringing a friend. Spent on a shop basket the same coupon would take ₺280
 * off a bag of beans, which is not what either was granted for.
 *
 * Exported as one predicate on purpose: the rule lived twice - enforced at
 * checkout and forgotten in the preview - so the basket screen promised a
 * discount the till then refused, and the member was charged full price.
 */
const CAFE_ONLY_SOURCES: ReadonlySet<string> = new Set<CouponSource>([
  "loyalty",
  "invite",
  // A milestone gift is a drink or a dessert from the cafe menu.
  "milestone",
]);

export function isCafeOnlyCoupon(
  coupon: { source?: CouponSource } | null | undefined,
): boolean {
  return !!coupon?.source && CAFE_ONLY_SOURCES.has(coupon.source);
}

/** Whether `coupon` may be spent on a basket of this kind. */
export function couponAllowedForKind(
  coupon: { source?: CouponSource } | null | undefined,
  kind: "cafe" | "shop" | undefined,
): boolean {
  if (!isCafeOnlyCoupon(coupon)) return true;
  // An unknown kind is treated as a shop basket: refusing a drink coupon the
  // member could have spent is recoverable, promising one that the till drops
  // is not.
  return kind === "cafe";
}

/** Why a cafe-only coupon was refused, in the member's language. */
export const CAFE_ONLY_COUPON_MESSAGE =
  "Bu kupon kafe siparişlerinde geçerli. Mağaza siparişinde kullanılamıyor.";

export interface CustomerCoupon {
  id: string;
  /** Normalized (lowercase) owner e-mail. */
  customerEmail: string;
  /** Globally-unique, uppercase code entered at checkout. */
  code: string;
  title: string;
  kind: CouponKind;
  /** Percentage (1-100) when `pct`, else minor units (kuruş). */
  value: number;
  minSubtotalMinor: number;
  source: CouponSource;
  /** ISO-8601, "" = never expires. */
  expiresAt: string;
  /** ISO-8601, "" = not yet used (single-use). */
  redeemedAt: string;
  redeemedOrderNo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Discount a coupon yields on a given subtotal, capped at the subtotal. */
export function computeCouponDiscount(
  kind: CouponKind,
  value: number,
  subtotalMinor: number,
): number {
  if (subtotalMinor <= 0) return 0;
  let d =
    kind === "pct"
      ? Math.floor((subtotalMinor * value) / 100)
      : Math.min(value, subtotalMinor);
  if (d < 0) d = 0;
  if (d > subtotalMinor) d = subtotalMinor;
  return d;
}

export type CouponEval =
  | { ok: true; discountMinor: number }
  | { ok: false; error: string };

/** Validate a coupon against a subtotal at a point in time (pure). */
export function evaluateCoupon(
  coupon: CustomerCoupon,
  subtotalMinor: number,
  nowMs: number,
): CouponEval {
  if (!coupon.isActive) return { ok: false, error: "Bu kupon kapalı." };
  if (coupon.redeemedAt) {
    return { ok: false, error: "Bu kupon zaten kullanıldı." };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < nowMs) {
    return { ok: false, error: "Kuponun süresi doldu." };
  }
  if (subtotalMinor < coupon.minSubtotalMinor) {
    return {
      ok: false,
      error: `Bu kupon için en az ${priceLabel(coupon.minSubtotalMinor)} alışveriş gerek.`,
    };
  }
  const discountMinor = computeCouponDiscount(
    coupon.kind,
    coupon.value,
    subtotalMinor,
  );
  if (discountMinor <= 0) {
    return { ok: false, error: "Kupon bu sepete indirim sağlamıyor." };
  }
  return { ok: true, discountMinor };
}

export type CouponStatus = "active" | "redeemed" | "expired" | "inactive";

/** Derived status for member/admin display (pure). */
export function couponStatus(c: CustomerCoupon, nowMs: number): CouponStatus {
  if (c.redeemedAt) return "redeemed";
  if (!c.isActive) return "inactive";
  if (c.expiresAt && new Date(c.expiresAt).getTime() < nowMs) return "expired";
  return "active";
}

/** Month (1-12) from a "YYYY-MM-DD" or "MM-DD" birthday, else null (pure). */
export function birthdayMonth(birthday: string): number | null {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (full) {
    const mo = Number(full[2]);
    return mo >= 1 && mo <= 12 ? mo : null;
  }
  const short = /^(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (short) {
    const mo = Number(short[1]);
    return mo >= 1 && mo <= 12 ? mo : null;
  }
  return null;
}
