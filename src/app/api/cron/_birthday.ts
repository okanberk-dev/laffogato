import "server-only";

import {
  grantBirthdayCouponToday,
  type CustomerCoupon,
} from "@/lib/customer/coupons";
import { getDb } from "@/lib/db";
import { ensureCustomerUnsubToken } from "@/lib/email/campaigns";
import { sendBirthdayEmail } from "@/lib/email/send";
import { iysSendGate } from "@/lib/iys/gate";

/**
 * "Üyelere doğum gününde mail gidiyor mu?" - the operator's own question.
 * Until this ran, the answer was no: `sendBirthdayEmail` had been written and
 * tested and was called from nowhere, and the coupon it talks about was only
 * granted if the member happened to open laffogato.net/uye/hesap/promosyonlar
 * during their birthday month. An app-only member got neither.
 *
 * The three things every automated message in this codebase has to name:
 *
 *   • TETİKLEYİCİ - the daily cron (`vercel.json` → /api/cron/birthday,
 *     06:00 UTC = 09:00 Tuzla), matching the member's birthday against
 *     today's ISTANBUL calendar day. Not the server's: at 01:00 Tuzla the
 *     server is still on yesterday's date, and a birthday is a calendar fact
 *     where the member lives.
 *
 *   • İZİN SINIFI - the coupon and the message are NOT the same thing:
 *       - the coupon is an entitlement on the account, not a communication.
 *         Every active, verified member whose birthday is today gets it, so
 *         it is there whichever surface they look from (P6: the app's
 *         Kuponlarım screen never triggered the old lazy grant).
 *       - the mail is a celebration carrying a %20 offer. That is a
 *         commercial message under 6563 however warmly it is written, so it
 *         goes ONLY to a member whose `marketing` preference is on AND who
 *         has a consent record (`marketingConsentAt`), and it carries
 *         `List-Unsubscribe` - `dogum-gunu.html` is marked
 *         `data-commercial="1"`, so `renderEmail` refuses to build it without
 *         the way out. A member without consent still gets the coupon, in
 *         silence. Since 22 Oct 2026 the consent must also be registered in
 *         İYS (the audience's mail flag requires it), and no greeting goes
 *         out at all while the last İYS refusal check is older than three
 *         business days (src/lib/iys/gate.ts): the coupons are still
 *         granted, the mail is skipped and counted.
 *
 *   • IDEMPOTENCY - the coupon row itself. `grantBirthdayCouponToday`
 *     returns the coupon only when it wrote one (at most one per member per
 *     calendar year); `null` means this year's was already granted, and then
 *     no mail is sent. A second run of the cron, a retry, two regions, a
 *     manual call - all of them greet once. No separate ledger.
 *
 * 29 February: a leap-day member has no birthday in a common year, so on
 * 1 March of a common year "02-29" is added to the day list. The once-a-year
 * coupon check keeps that from doubling up in a leap year.
 */

/** One `birthday_greeting_audience` row. */
interface BirthdayRow {
  email: string;
  name: string;
  /** Marketing preference AND a consent record - the 6563 gate. */
  marketing: boolean;
}

export interface BirthdayRunResult {
  /** Istanbul calendar days matched, "AA-GG". Two only on 1 March, non-leap. */
  days: string[];
  /** Members whose birthday is today and who could be greeted or gifted. */
  candidates: number;
  /** Coupons actually written - i.e. members not already greeted this year. */
  granted: number;
  /** Messages handed to the provider. */
  mailed: number;
  /** Granted a coupon but not mailed: no marketing consent (or not in İYS). */
  skippedNoConsent: number;
  /** Granted a coupon but not mailed: the İYS refusal check is stale. */
  skippedIysCheck: number;
}

/** Wall-clock date in Tuzla, as `{ year, month, day }`. */
function istanbulDate(now: Date): { year: number; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { year: Number(get("year")), month: get("month"), day: get("day") };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The "AA-GG" days to greet today. Normally one; on 1 March of a common year
 * it also carries "02-29", which is the only day a leap-day member can be
 * greeted that year.
 */
export function birthdayDaysFor(now: Date): string[] {
  const { year, month, day } = istanbulDate(now);
  const days = [`${month}-${day}`];
  if (month === "03" && day === "01" && !isLeapYear(year)) days.push("02-29");
  return days;
}

/** "23 Eylül 2026" - the date `[SON_KULLANIM]` prints, on Tuzla's calendar. */
const EXPIRY_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function expiryLabel(coupon: CustomerCoupon): string {
  const ms = Date.parse(coupon.expiresAt);
  return Number.isFinite(ms) ? EXPIRY_FORMAT.format(new Date(ms)) : "";
}

async function birthdayAudience(days: string[]): Promise<BirthdayRow[]> {
  // `rpcRows`, not `rpc`: the function RETURNS TABLE.
  const { data, error } = await getDb().rpcRows<unknown>(
    "birthday_greeting_audience",
    { p_month_days: days },
  );
  if (error) {
    throw new Error(`birthday_greeting_audience: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
    marketing: row.marketing === true,
  }));
}

/**
 * Grant today's birthday coupons and greet the members who consented.
 *
 * One member's failure never stops the rest: a coupon that could not be
 * written, a token that could not be minted, a provider that refused - each
 * is logged with a masked address and the loop carries on. Mail delivery is
 * already best-effort inside `sendTemplate`.
 */
export async function runBirthdayGreetings(
  now: Date = new Date(),
): Promise<BirthdayRunResult> {
  const days = birthdayDaysFor(now);
  const { year } = istanbulDate(now);
  const audience = await birthdayAudience(days);
  // Fails closed: a gate that cannot be read sends no greeting, and the
  // coupons are granted all the same.
  let mayMail = false;
  try {
    mayMail = (await iysSendGate(now)).fresh;
  } catch (err) {
    console.error("[cron/birthday] İYS kontrolü okunamadı", err);
  }

  const result: BirthdayRunResult = {
    days,
    candidates: audience.length,
    granted: 0,
    mailed: 0,
    skippedNoConsent: 0,
    skippedIysCheck: 0,
  };

  for (const member of audience) {
    try {
      const coupon = await grantBirthdayCouponToday(member.email, year, now);
      // Already greeted this year - the idempotency key, and the reason no
      // second message goes out.
      if (!coupon) continue;
      result.granted += 1;

      if (!member.marketing) {
        // The gift is on the account; the celebration is a commercial
        // message and this member did not ask for those.
        result.skippedNoConsent += 1;
        continue;
      }
      if (!mayMail) {
        // The gift is on the account; the greeting is a commercial message
        // and İYS has not been checked for refusals recently enough.
        result.skippedIysCheck += 1;
        continue;
      }

      const unsubToken = await ensureCustomerUnsubToken(member.email);
      const sent = await sendBirthdayEmail({
        to: member.email,
        name: member.name,
        unsubToken,
        couponCode: coupon.code,
        expiresAt: expiryLabel(coupon),
      });
      if (sent) result.mailed += 1;
    } catch (err) {
      // KVKK: the address never reaches a log in full.
      console.error(`[cron/birthday] ${maskEmail(member.email)}`, err);
    }
  }

  return result;
}

/** `ed**@example.com` - enough to recognise a row, not enough to be one. */
function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  const local = address.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}${address.slice(at)}`;
}
