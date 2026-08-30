/**
 * Pure pieces of the mobile bearer check — no I/O, unit-tested directly.
 * The wiring (Supabase call, database) lives in `./auth.ts`.
 */

/**
 * Extracts the token from an `Authorization: Bearer <token>` header.
 *
 * Returns null for a missing header, a different scheme, an empty token, or
 * anything with whitespace inside the token — a JWT never contains any, and a
 * lenient parse here would only turn a malformed header into a confusing
 * "invalid token" further down.
 */
export function parseBearerToken(
  header: string | null | undefined,
): string | null {
  if (!header) return null;
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return null;
  const token = match[1];
  // Sanity bound: a real access token is a few hundred to a few thousand
  // bytes. Anything wildly larger is not one and need not reach the network.
  if (token.length < 16 || token.length > 8192) return null;
  return token;
}

export type AuthFailure = "unauthorized" | "unavailable";

/**
 * Turns an auth error from `supabase.auth.getUser(token)` into one of the two
 * outcomes a route can act on.
 *
 * Supabase answers a bad, expired or foreign token with a 4xx carrying a
 * status; a transport failure (the auth server unreachable, DNS, TLS) arrives
 * with no status at all, `0`, or a 5xx. The first is the caller's problem
 * (401); the second is ours (503) and must not be reported as "sign in again",
 * which would make an outage look like every member being logged out.
 */
export function classifyAuthError(
  error: { status?: number | null } | null | undefined,
): AuthFailure {
  const status = error?.status ?? undefined;
  if (status === undefined || status === 0 || status >= 500) {
    return "unavailable";
  }
  return "unauthorized";
}
