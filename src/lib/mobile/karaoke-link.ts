import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { SITE } from "@/lib/seo/site";

import { isKaraokeRef } from "./karaoke-ref";
import { karaokeEndInstant } from "./karaoke-time";

/**
 * The signed link that lets someone without an account (and a member, from
 * the same e-mail) open their karaoke booking and cancel it (operator, 16 Eki
 * 2026: "üyeliksiz de yapabilsinler").
 *
 * `krk-00042` is sequential, so the id alone proves nothing: the link carries
 * an HMAC over the id, the address the booking's mail goes to and an expiry
 * (the end of the booked block). Change any of the three and the signature no
 * longer holds; a booking whose address was anonymised (account closure)
 * stops opening for good.
 *
 * Where it is handed out - and where it is NOT:
 *
 * - the confirmation and cancellation e-mails (the address owner's inbox);
 * - an httpOnly cookie set by the booking form itself, so the payment return
 *   lands on the booking for the browser that made it.
 *
 * Never by `/odeme/donus`: that POST comes from the bank without a cookie and
 * can be forged for any id (CLAUDE.md rule 29), so a link minted there would
 * be a link for whoever asked.
 *
 * The page lives at `/rezervasyon`, not under `/karaoke`: the app claims the
 * `/karaoke` path prefix as an Android App Link, and a guest who has the app
 * installed would be dropped on a screen that cannot show this booking.
 */

const DOMAIN = "karaoke-link|v1";
const TOKEN_RE = /^(krk-\d{1,12})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

/** The cookie the booking form sets; httpOnly, Lax, scoped to the page. */
export const KARAOKE_LINK_COOKIE = "laffogato_karaoke_link";
export const KARAOKE_LINK_PATH = "/rezervasyon";

function secret(): string {
  const value =
    process.env.KARAOKE_LINK_SECRET ||
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) {
    // Fail closed: an unsigned or weakly signed link would open bookings
    // (names, phone numbers) to anyone counting ids.
    throw new Error(
      "KARAOKE_LINK_SECRET (ya da CUSTOMER_SESSION_SECRET / ADMIN_SESSION_SECRET) en az 32 karakter olmalı.",
    );
  }
  return value;
}

/** The address a booking's mail goes to - and so the one the link binds. */
export function karaokeRecipient(r: {
  contactEmail?: string;
  customerEmail: string;
}): string {
  return (r.contactEmail?.trim() || r.customerEmail).trim().toLowerCase();
}

function mac(id: string, email: string, exp: number, key: string): Buffer {
  return createHmac("sha256", key)
    .update(`${DOMAIN}|${id}|${email}|${exp}`)
    .digest();
}

export interface KaraokeLinkTarget {
  id: string;
  date: string;
  startHour: number;
  hours: number;
  contactEmail?: string;
  customerEmail: string;
}

/** `krk-00042.<exp>.<sig>`: valid until the booked block ends. */
export function signKaraokeLink(r: KaraokeLinkTarget, key = secret()): string {
  const exp = Math.floor(karaokeEndInstant(r).getTime() / 1000);
  const sig = mac(r.id, karaokeRecipient(r), exp, key).toString("base64url");
  return `${r.id}.${exp}.${sig}`;
}

/** The absolute URL a mail prints. */
export function karaokeLinkUrl(r: KaraokeLinkTarget): string {
  return `${SITE.url}${KARAOKE_LINK_PATH}?t=${encodeURIComponent(signKaraokeLink(r))}`;
}

/** Which booking a token names - NOT a proof; `verifyKaraokeLink` is. */
export function karaokeLinkId(token: string | null | undefined): string | null {
  const m = TOKEN_RE.exec(token ?? "");
  return m && isKaraokeRef(m[1]) ? m[1] : null;
}

/**
 * True when `token` was signed for exactly this booking and address and has
 * not expired. Constant-time on the signature.
 */
export function verifyKaraokeLink(
  token: string | null | undefined,
  r: KaraokeLinkTarget,
  now: Date = new Date(),
  key = secret(),
): boolean {
  const m = TOKEN_RE.exec(token ?? "");
  if (!m || m[1] !== r.id) return false;
  const exp = Number(m[2]);
  if (!Number.isSafeInteger(exp) || exp * 1000 <= now.getTime()) return false;
  // The expiry must be the one this booking's own end gives: a token cannot
  // stretch its life by naming a later instant (it would not verify anyway,
  // but this keeps the rule readable).
  if (exp !== Math.floor(karaokeEndInstant(r).getTime() / 1000)) return false;
  const given = Buffer.from(m[3], "base64url");
  const expected = mac(r.id, karaokeRecipient(r), exp, key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
