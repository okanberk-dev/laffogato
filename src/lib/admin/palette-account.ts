import "server-only";

import { createHmac } from "node:crypto";

/**
 * The key the palette's "Son açılanlar" are stored under in the browser
 * (admin UI v2, UI-6): 16 hex of an HMAC-SHA256 of the account's e-mail,
 * keyed with ADMIN_SESSION_SECRET. Two accounts on one köşk tablet never
 * read each other's list, and what the page carries says nothing about who
 * is signed in: without the secret the key cannot be tied to an address.
 * The input is labelled, so the digest is of no use as any other token the
 * secret signs. "" (recents off) when the secret is missing, which
 * getAdminSession would already have refused.
 */
export function paletteAccountKey(email: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(`palette-recents|${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}
