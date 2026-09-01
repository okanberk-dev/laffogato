import "server-only";

import { headers } from "next/headers";

import { getDb } from "@/lib/db";

/**
 * Sliding-window failure limiter for every credential check.
 *
 * The counter lives in Postgres, not in a module-scoped Map. The Map version
 * gave each serverless instance its own budget, so an attacker got five
 * attempts per cold start rather than five in total, and a lockout evaporated
 * the moment traffic landed on a different instance.
 *
 * Keys are namespaced by purpose (`admin-login`, `customer-login`, `admin-2fa`)
 * so the three do not share a budget, and by IP + identity so one attacker
 * cannot lock a real user out by guessing at their email from elsewhere.
 *
 * Defaults: 5 failures inside 5 minutes triggers a 1-minute lockout.
 */

const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILS = 5;
const LOCKOUT_MS = 60 * 1000;

export type AuthPurpose =
  | "admin-login"
  | "customer-login"
  | "admin-2fa"
  | "promo-preview";

/** Failures allowed before a lockout, per purpose. */
const MAX_FAILS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  // Guessing a promo code is not guessing a password: a real customer
  // mistyping their own coupon must not be locked out of checkout, while
  // scripted enumeration still hits a wall quickly.
  "promo-preview": 15,
};

/**
 * The caller's IP as the edge saw it. The first hop in `x-forwarded-for` is
 * the client; Vercel also sets `x-real-ip`. Empty when neither is present
 * (local development) — callers that store it as evidence keep the blank
 * rather than writing a placeholder, and the rate-limit key buckets it.
 */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return h.get("x-real-ip")?.trim() ?? "";
  } catch {
    return "";
  }
}

export interface RateLimitStatus {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

const OPEN: RateLimitStatus = {
  blocked: false,
  retryAfterSeconds: 0,
  remaining: MAX_FAILS,
};

function bucketKey(purpose: AuthPurpose, ip: string, identity: string): string {
  return `${purpose}::${ip || "unknown"}::${identity.trim().toLowerCase()}`;
}

function maxFails(purpose: AuthPurpose): number {
  return MAX_FAILS_BY_PURPOSE[purpose] ?? MAX_FAILS;
}

function statusFrom(
  failedCount: number,
  lockedUntil: string,
  now: number,
  purpose: AuthPurpose,
): RateLimitStatus {
  const until = lockedUntil ? Date.parse(lockedUntil) : 0;
  if (Number.isFinite(until) && until > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((until - now) / 1000),
      remaining: 0,
    };
  }
  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxFails(purpose) - failedCount),
  };
}

interface AttemptRow {
  failedCount: number;
  firstFailedAt: string;
  lockedUntil: string;
}

export async function checkLoginLimit(
  purpose: AuthPurpose,
  ip: string,
  identity: string,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const sb = getDb();
  const { data, error } = await sb
    .from("auth_attempts")
    .select("*")
    .eq("key", bucketKey(purpose, ip, identity))
    .maybeSingle();
  // A limiter that cannot reach the database must not lock everyone out of
  // their own site; the credential check behind it still has to pass.
  if (error) {
    console.error("[rate-limit] check failed", error);
    return OPEN;
  }
  const row = data as AttemptRow | null;
  if (!row) return OPEN;

  // A window that has fully expired is not a partial count any more.
  const started = row.firstFailedAt ? Date.parse(row.firstFailedAt) : 0;
  const stale = !started || now - started > WINDOW_MS;
  return statusFrom(stale ? 0 : row.failedCount, row.lockedUntil, now, purpose);
}

export async function recordLoginFailure(
  purpose: AuthPurpose,
  ip: string,
  identity: string,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const sb = getDb();
  const { data, error } = await sb.rpc("record_auth_failure", {
    p_key: bucketKey(purpose, ip, identity),
    p_now: new Date(now).toISOString(),
    p_window_ms: WINDOW_MS,
    p_max_fails: maxFails(purpose),
    p_lockout_ms: LOCKOUT_MS,
  });
  if (error) {
    console.error("[rate-limit] record failed", error);
    return OPEN;
  }
  const row = (Array.isArray(data) ? data[0] : data) as AttemptRow | undefined;
  if (!row) return OPEN;
  return statusFrom(row.failedCount, row.lockedUntil, now, purpose);
}

/** Clears the counter after a successful authentication. */
export async function clearLoginLimit(
  purpose: AuthPurpose,
  ip: string,
  identity: string,
): Promise<void> {
  const sb = getDb();
  const { error } = await sb
    .from("auth_attempts")
    .delete()
    .eq("key", bucketKey(purpose, ip, identity));
  if (error) console.error("[rate-limit] clear failed", error);
}
