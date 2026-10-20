import "server-only";

import { createHash } from "node:crypto";

/**
 * Which session a poll cursor was handed to (the new-order bell, the nav
 * badges, the order list's count): the first 12 hex digits of the session
 * cookie's SHA-256.
 *
 * A cursor stands for "this session's account was re-read under this
 * change marker and still had the section". The change markers move when
 * an account is written (change-marker.ts), so a session revoked after its
 * cursor is re-read on its next poll. One revoked BEFORE the marker was
 * made could still carry a cursor someone else's session was handed; bound
 * to the cookie, that cursor answers "nothing changed" to no other cookie,
 * and the account decides (rule 30).
 *
 * The digest says nothing usable about the cookie (whose signature is an
 * HMAC under the session secret) and nothing about who it belongs to: no
 * address goes into an address bar or a log.
 */
export function sessionBinding(cookieValue: string | undefined): string {
  if (!cookieValue) return "";
  return createHash("sha256").update(cookieValue).digest("hex").slice(0, 12);
}
