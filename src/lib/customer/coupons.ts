import "server-only";

import { randomBytes } from "node:crypto";

import type { DbError } from "@/lib/db";

import { nextSeq } from "@/lib/db/counters";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  birthdayMonth,
  evaluateCoupon,
  normalizeCouponCode,
  type CouponKind,
  type CouponSource,
  type CustomerCoupon,
} from "./coupon-utils";

// Re-export the isomorphic helpers + types so existing server-side importers
// can keep pulling everything coupon-related from this module.
export {
  birthdayMonth,
  CAFE_ONLY_COUPON_MESSAGE,
  computeCouponDiscount,
  couponAllowedForKind,
  couponStatus,
  evaluateCoupon,
  isCafeOnlyCoupon,
  normalizeCouponCode,
} from "./coupon-utils";
export type {
  CouponEval,
  CouponKind,
  CouponSource,
  CouponStatus,
  CustomerCoupon,
} from "./coupon-utils";

// ─── Business parameters (single source of truth for auto-grants) ────────────

const WELCOME = {
  kind: "pct" as const,
  value: 15,
  minSubtotalMinor: 20000, // 200,00 ₺
  title: "Hoş geldin indirimi · %15",
  ttlDays: 30,
};

/**
 * `ttlDays` is not decoration: `dogum-gunu.html` and its plain-text twin both
 * print "7 gün geçerli" next to `[SON_KULLANIM]`. The coupon used to expire at
 * the end of the calendar month instead, so the member born on the 28th got
 * three days while the message promised seven, and the member born on the 2nd
 * got twenty-nine. Whoever changes this number changes the template too.
 */
const BIRTHDAY = {
  kind: "pct" as const,
  value: 20,
  minSubtotalMinor: 15000, // 150,00 ₺
  title: "Doğum günün kutlu olsun · %20",
  ttlDays: 7,
};

const SOURCE_PREFIX: Record<CouponSource, string> = {
  welcome: "HG", // hoş geldin
  birthday: "DG", // doğum günü
  loyalty: "SD", // sadakat
  manual: "HD", // hediye
  review: "DY", // değerlendirme
  invite: "DV", // davet
  milestone: "KT", // kilometre taşı (karar 175)
};

// ─── Pure helpers (no DB - unit-tested directly) ─────────────────────────────

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Ambiguous characters (0/O/1/I) intentionally omitted for hand-typed codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(prefix: string): string {
  const bytes = randomBytes(6);
  let body = "";
  for (let i = 0; i < 6; i++)
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${prefix}-${body}`;
}

/** `now + days`, as the ISO instant a coupon row stores. */
function expiryISO(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ─── DB layer ────────────────────────────────────────────────────────────────

function checkErr(error: DbError | null, ctx: string): void {
  // An empty code means the request never reached Postgres, so it is classified
  // as unreachable rather than as a rejected query. See src/lib/db/health.ts.
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** All coupons owned by a member, newest first. */
export async function listCustomerCoupons(
  email: string,
): Promise<CustomerCoupon[]> {
  const owner = normalizeEmail(email);
  if (!owner) return [];
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .select("*")
    .eq("customerEmail", owner)
    .order("createdAt", { ascending: false });
  checkErr(error, "listCustomerCoupons");
  return (data as CustomerCoupon[] | null) ?? [];
}

export interface CouponApplyResult {
  ok: boolean;
  /** True when a coupon with this code belongs to the member (valid or not). */
  found: boolean;
  error?: string;
  coupon?: CustomerCoupon;
  discountMinor?: number;
}

/**
 * Look up a personal coupon by code and validate it for this member + subtotal.
 * `found:false` means "not this member's coupon" - the caller may then fall
 * back to a global promo code with the same string.
 */
export async function applyCustomerCoupon(
  code: string,
  email: string,
  subtotalMinor: number,
): Promise<CouponApplyResult> {
  const needle = normalizeCouponCode(code);
  const owner = normalizeEmail(email);
  if (!needle || !owner) return { ok: false, found: false };
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .select("*")
    .eq("code", needle)
    .maybeSingle();
  checkErr(error, "applyCustomerCoupon");
  const coupon = data as CustomerCoupon | null;
  if (!coupon || normalizeEmail(coupon.customerEmail) !== owner) {
    return { ok: false, found: false };
  }
  const result = evaluateCoupon(coupon, subtotalMinor, Date.now());
  if (!result.ok)
    return { ok: false, found: true, error: result.error, coupon };
  return { ok: true, found: true, coupon, discountMinor: result.discountMinor };
}

/**
 * Atomically mark a coupon redeemed - a single guarded UPDATE that only flips
 * an unredeemed, active coupon owned by this member. Returns true only when WE
 * were the writer that claimed it (single-use safe under concurrency).
 */
export async function redeemCustomerCoupon(
  code: string,
  email: string,
  orderNo: number,
): Promise<boolean> {
  const needle = normalizeCouponCode(code);
  const owner = normalizeEmail(email);
  if (!needle || !owner) return false;
  const now = new Date().toISOString();
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .update({ redeemedAt: now, redeemedOrderNo: orderNo, updatedAt: now })
    .eq("code", needle)
    .eq("customerEmail", owner)
    .eq("redeemedAt", "")
    .eq("isActive", true)
    .select("id");
  checkErr(error, "redeemCustomerCoupon");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/**
 * Hands a single-use coupon back to its owner.
 *
 * A coupon is claimed when the order is created, before payment. If that order
 * is then cancelled - the customer abandoned the POS page, the card was
 * declined - the coupon was simply gone. This reverses the claim, but only for
 * the order that took it, so an unrelated redemption is never undone.
 */
export async function releaseCustomerCoupon(
  code: string,
  email: string,
  orderNo: number,
): Promise<boolean> {
  const needle = normalizeCouponCode(code);
  const owner = normalizeEmail(email);
  if (!needle || !owner) return false;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .update({
      redeemedAt: "",
      redeemedOrderNo: 0,
      updatedAt: new Date().toISOString(),
    })
    .eq("code", needle)
    .eq("customerEmail", owner)
    .eq("redeemedOrderNo", orderNo)
    .select("id");
  checkErr(error, "releaseCustomerCoupon");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

export interface GrantCouponInput {
  email: string;
  kind: CouponKind;
  value: number;
  minSubtotalMinor?: number;
  title?: string;
  source?: CouponSource;
  /** ISO-8601 expiry, "" = never. */
  expiresAt?: string;
  /** Explicit code; auto-generated from the source prefix when omitted. */
  code?: string;
}

/** Create + persist a coupon for a member. Retries once on a code collision. */
export async function grantCoupon(
  input: GrantCouponInput,
): Promise<CustomerCoupon> {
  const email = normalizeEmail(input.email);
  const source = input.source ?? "manual";
  const seq = await nextSeq("cpn");
  const now = new Date().toISOString();
  const coupon: CustomerCoupon = {
    id: `cpn-${String(seq).padStart(4, "0")}`,
    customerEmail: email,
    code: input.code
      ? normalizeCouponCode(input.code)
      : generateCouponCode(SOURCE_PREFIX[source]),
    title: input.title ?? "",
    kind: input.kind,
    value: Math.round(input.value),
    minSubtotalMinor: Math.max(0, Math.round(input.minSubtotalMinor ?? 0)),
    source,
    expiresAt: input.expiresAt ?? "",
    redeemedAt: "",
    redeemedOrderNo: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const sb = getDb();
  const { error } = await sb.from(TABLES.customerCoupons).insert(coupon);
  if (error) {
    // Unique-code collision → regenerate once (only for auto codes).
    if (error.code === "23505" && !input.code) {
      coupon.code = generateCouponCode(SOURCE_PREFIX[source]);
      const retry = await sb.from(TABLES.customerCoupons).insert(coupon);
      checkErr(retry.error, "grantCoupon.retry");
    } else {
      throw new Error(`grantCoupon: ${error.message}`);
    }
  }
  return coupon;
}

/** True when the member already has a coupon from the given source. */
async function hasCouponFromSource(
  email: string,
  source: CouponSource,
): Promise<boolean> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .select("id")
    .eq("customerEmail", normalizeEmail(email))
    .eq("source", source)
    .limit(1);
  checkErr(error, "hasCouponFromSource");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/** Idempotent welcome coupon - granted once, on e-mail verification. */
export async function grantWelcomeCoupon(
  email: string,
): Promise<CustomerCoupon | null> {
  const owner = normalizeEmail(email);
  if (!owner) return null;
  if (await hasCouponFromSource(owner, "welcome")) return null;
  return grantCoupon({
    email: owner,
    kind: WELCOME.kind,
    value: WELCOME.value,
    minSubtotalMinor: WELCOME.minSubtotalMinor,
    title: WELCOME.title,
    source: "welcome",
    expiresAt: expiryISO(new Date(), WELCOME.ttlDays),
  });
}

async function hasBirthdayCouponThisYear(
  email: string,
  year: number,
): Promise<boolean> {
  const sb = getDb();
  // ISO-8601 text sorts lexicographically, so a string >= "YYYY-01-01" works.
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .select("id")
    .eq("customerEmail", normalizeEmail(email))
    .eq("source", "birthday")
    .gte("createdAt", `${year}-01-01`)
    .limit(1);
  checkErr(error, "hasBirthdayCouponThisYear");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

/**
 * The grant itself, shared by both doors below.
 *
 * `hasBirthdayCouponThisYear` is the whole idempotency key: one birthday
 * coupon per member per calendar year. That single check covers every way the
 * cron can run twice (a retry, two regions, a manual call), and it is also
 * what makes 29 February safe - a leap-day member greeted on 1 March in a
 * common year cannot be greeted again on the 29th of the next leap year's
 * February within the same year, because there is only ever one 29 February
 * per year and the check is per year, not per date.
 */
async function grantBirthdayCouponOnce(
  owner: string,
  year: number,
  now: Date,
): Promise<CustomerCoupon | null> {
  if (await hasBirthdayCouponThisYear(owner, year)) return null;
  return grantCoupon({
    email: owner,
    kind: BIRTHDAY.kind,
    value: BIRTHDAY.value,
    minSubtotalMinor: BIRTHDAY.minSubtotalMinor,
    title: BIRTHDAY.title,
    source: "birthday",
    expiresAt: expiryISO(now, BIRTHDAY.ttlDays),
  });
}

/**
 * The daily cron's grant: the caller has already matched the member's
 * birthday against today's Istanbul calendar day (`birthday_greeting_audience`
 * does the AA-GG comparison in SQL), so all that is left here is the once-a-
 * year guard and the row.
 *
 * Returns the coupon when one was written and `null` when the member already
 * had this year's - which is exactly the signal the cron needs: grant a coupon
 * and greet, or stay quiet. No second bookkeeping table.
 */
export async function grantBirthdayCouponToday(
  email: string,
  year: number,
  now: Date = new Date(),
): Promise<CustomerCoupon | null> {
  const owner = normalizeEmail(email);
  if (!owner) return null;
  return grantBirthdayCouponOnce(owner, year, now);
}

/**
 * The web backstop: grant the coupon when the member happens to open the
 * promotions page during their birthday MONTH. Kept for the member whose
 * birthday fell before the cron existed (or on a day the cron did not run);
 * the cron is the real trigger and normally gets there first, in which case
 * the once-a-year check makes this a no-op.
 *
 * The month is deliberately wider than the cron's day - a page visit is not
 * a schedule - but the coupon it writes is the same one, seven days from the
 * moment it is granted, so both doors match what the mail says.
 */
export async function maybeGrantBirthdayCoupon(
  email: string,
  birthday: string,
): Promise<CustomerCoupon | null> {
  const owner = normalizeEmail(email);
  const month = birthdayMonth(birthday ?? "");
  if (!owner || !month) return null;
  const now = new Date();
  // The venue's calendar, as the cron reads it (`istanbulDate` in
  // api/cron/_birthday.ts): on Vercel `getMonth()` is UTC, so from 00:00 to
  // 03:00 on the 1st the site still thought it was last month.
  // formatToParts, not format().split("-"): a locale's pattern can change
  // between ICU releases, and a silent NaN here would stop every grant.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const part = (type: "year" | "month") =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = part("year");
  const mm = part("month");
  if (mm !== month) return null;
  return grantBirthdayCouponOnce(owner, year, now);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** All coupons for a member (admin detail view), newest first. */
export async function adminListCustomerCoupons(
  email: string,
): Promise<CustomerCoupon[]> {
  return listCustomerCoupons(email);
}

/** Hard-delete a coupon by id. Returns true when a row was removed. */
export async function revokeCustomerCoupon(id: string): Promise<boolean> {
  if (!id) return false;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customerCoupons)
    .delete()
    .eq("id", id)
    .select("id");
  checkErr(error, "revokeCustomerCoupon");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}
