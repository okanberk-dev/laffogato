// Pure rules of the cafe tables (QR on the table → /masa/<code>). NO
// "server-only", NO database: the panel, the public page, the mobile API and
// the order path all read the same functions, and tests call them directly.

import { randomBytes } from "node:crypto";

/**
 * Crockford base32: digits and upper-case letters without I, L, O and U, so a
 * code read off a printed card cannot be mistaken for another one.
 */
export const TABLE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Ten symbols = 50 bits. The code is not a secret (it is printed on a table)
 * but it must not be guessable from another one: a sequential "MASA-07" would
 * let anyone order "to table 8" from home. At 2^50 a guesser needs ~10^15
 * tries per hit, and the lookup endpoint counts misses on top of that.
 */
export const TABLE_CODE_LENGTH = 10;

/** Display names: what staff call the table ("Bahçe 3", "Pencere önü"). */
export const TABLE_NAME_MAX = 40;

/**
 * The public URL a table's QR opens. Hard-coded to the APEX host on purpose:
 * the code is printed and laminated, so it must survive any change of
 * `NEXT_PUBLIC_SITE_URL`, a preview deployment, or a www/apex flip. The apex
 * is also the host the app's universal-link association is served from.
 */
export const TABLE_URL_BASE = "https://laffogato.net/masa/";

/**
 * A fresh code, unbiased: 32 divides 256, so `byte % 32` is fair, but the
 * fair-modulo guard is kept (as in `src/lib/mobile/counter.ts`) so the
 * alphabet can change without silently skewing the distribution.
 */
export function generateTableCode(
  random: (n: number) => Uint8Array = randomBytes,
): string {
  const fair = 256 - (256 % TABLE_CODE_ALPHABET.length);
  let out = "";
  while (out.length < TABLE_CODE_LENGTH) {
    for (const byte of random(TABLE_CODE_LENGTH)) {
      if (byte >= fair) continue;
      out += TABLE_CODE_ALPHABET[byte % TABLE_CODE_ALPHABET.length];
      if (out.length === TABLE_CODE_LENGTH) break;
    }
  }
  return out;
}

/**
 * What a typed or scanned code becomes before it is looked up: trimmed, upper
 * case, spaces and hyphens dropped, and Crockford's look-alikes folded
 * (O → 0, I and L → 1). Anything that is not then exactly ten symbols of the
 * alphabet is `null` - never looked up, never echoed back.
 */
export function normalizeTableCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const folded = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (folded.length !== TABLE_CODE_LENGTH) return null;
  for (const ch of folded) {
    if (!TABLE_CODE_ALPHABET.includes(ch)) return null;
  }
  return folded;
}

/** `https://laffogato.net/masa/<code>` - the QR payload and the copy link. */
export function tableUrl(code: string): string {
  return `${TABLE_URL_BASE}${code}`;
}

/** A table name as stored: trimmed, inner whitespace collapsed; null if unusable. */
export function normalizeTableName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > TABLE_NAME_MAX) return null;
  return name;
}
