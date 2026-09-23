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
  | "admin-2fa-account"
  | "promo-preview"
  | "password-reset"
  | "unsubscribe"
  | "newsletter-signup";

/** Failures allowed before a lockout, per purpose. */
const MAX_FAILS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  // Guessing a promo code is not guessing a password: a real customer
  // mistyping their own coupon must not be locked out of checkout, while
  // scripted enumeration still hits a wall quickly.
  "promo-preview": 15,
  // Every request costs an e-mail to somebody else's inbox, so this one counts
  // successes as well as failures - five links per address per five minutes.
  "password-reset": 5,
  // The one-click unsubscribe route (RFC 8058 POST). Its "failure" is a
  // token that matched nothing - unknown or already spent; a valid opt-out
  // never counts, because the POST comes from the mail provider's shared
  // servers, not the person's device, and opt-outs from one provider cluster
  // right after a campaign. Twenty dead tokens per IP per five minutes is
  // far beyond what a mail client's button produces and well short of what a
  // flood does; each one still costs up to three queries on the shared pool.
  unsubscribe: 20,
  // The same TOTP account from ANY address. The per-IP key above lets an
  // attacker who has the password rotate addresses and keep guessing six
  // digits; this key is the account itself, so the guesses add up wherever
  // they come from. Ten per window, then a quarter of an hour.
  "admin-2fa-account": 10,
  // The footer bulletin form sends a confirmation mail to whatever address
  // is typed. Three per address per window, counted on success too (like
  // password-reset), so the form cannot be used to flood someone's inbox.
  "newsletter-signup": 3,
};

/** Lockout length per purpose; LOCKOUT_MS unless listed. */
const LOCKOUT_MS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  "admin-2fa-account": 15 * 60 * 1000,
  "newsletter-signup": 15 * 60 * 1000,
};

function lockoutMs(purpose: AuthPurpose): number {
  return LOCKOUT_MS_BY_PURPOSE[purpose] ?? LOCKOUT_MS;
}

/**
 * The client's address from a set of request headers: the first hop in
 * `x-forwarded-for` is the client; Vercel also sets `x-real-ip`. Empty when
 * neither is present (local development).
 */
export function clientIpFrom(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() ?? "";
}

/**
 * The caller's IP as the edge saw it, read from the ambient request. Empty
 * when it cannot be had - callers that store it as evidence keep the blank
 * rather than writing a placeholder, and the rate-limit key buckets it.
 */
export async function clientIp(): Promise<string> {
  try {
    return clientIpFrom(await headers());
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
  // `rpcRows`, not `rpc`: the function RETURNS TABLE, and the scalar form
  // hands back a record string - `blocked` was never true and the "N hakkın
  // kaldı" message counted NaN.
  const { data, error } = await sb.rpcRows<AttemptRow>("record_auth_failure", {
    p_key: bucketKey(purpose, ip, identity),
    p_now: new Date(now).toISOString(),
    p_window_ms: WINDOW_MS,
    p_max_fails: maxFails(purpose),
    p_lockout_ms: lockoutMs(purpose),
  });
  if (error) {
    console.error("[rate-limit] record failed", error);
    return OPEN;
  }
  const row = data?.[0];
  if (!row) return OPEN;
  return statusFrom(row.failedCount, row.lockedUntil, now, purpose);
}

/**
 * Counts THIS attempt before the credential is checked, and says whether it
 * may go ahead.
 *
 * The old sequence was check → verify → record a failure. N requests sent at
 * once all passed the check before any failure was written, so a burst of a
 * thousand TOTP guesses was a thousand guesses whatever the counter said, and
 * a right one anywhere in the burst signed in. `reserve_auth_attempt` does the
 * whole decision in one statement under the key's row lock: refused while
 * locked out (and not counted), otherwise counted, and the attempt that
 * reaches the cap is the last one let through. A success then clears the key
 * with `clearLoginLimit`, exactly as before.
 *
 * `remaining` is how many more attempts are left if this one fails (0: this
 * was the last).
 */
export async function reserveLoginAttempt(
  purpose: AuthPurpose,
  ip: string,
  identity: string,
): Promise<RateLimitStatus> {
  const now = Date.now();
  const { data, error } = await getDb().rpc<{
    allowed: boolean;
    remaining: number;
    lockedUntil: string;
  }>("reserve_auth_attempt", {
    p_key: bucketKey(purpose, ip, identity),
    p_now: new Date(now).toISOString(),
    p_window_ms: WINDOW_MS,
    p_max_fails: maxFails(purpose),
    p_lockout_ms: lockoutMs(purpose),
  });
  // Same stance as checkLoginLimit: a limiter that cannot reach the database
  // must not lock everyone out; the credential check behind it still runs.
  if (error || !data) {
    if (error) console.error("[rate-limit] reserve failed", error);
    return OPEN;
  }
  if (!data.allowed) {
    const until = Date.parse(data.lockedUntil);
    return {
      blocked: true,
      retryAfterSeconds: Number.isFinite(until)
        ? Math.max(1, Math.ceil((until - now) / 1000))
        : Math.ceil(lockoutMs(purpose) / 1000),
      remaining: 0,
    };
  }
  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, Number(data.remaining)),
  };
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
