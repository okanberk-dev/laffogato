// Pure, isomorphic coupon helpers — NO "server-only", NO node:crypto, NO DB.
// Safe to import from client components (e.g. the admin coupon panel) as well
// as the server-only data layer in `./coupons`.

export type CouponKind = "pct" | "fixed";

/** Where a coupon came from — drives the code prefix + member-facing copy. */
export type CouponSource =
  | "welcome" // auto on e-mail verification
  | "birthday" // auto during the member's birthday month
  | "loyalty" // reward (admin/automation)
  | "manual" // hand-granted by an admin
  | "review" // reward for leaving a review (phase 2)
  | "invite"; // referral reward — inviter and invitee (mobile app)

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
      error: `Bu kupon için en az ${(coupon.minSubtotalMinor / 100).toFixed(2)} ₺ alışveriş gerek.`,
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
