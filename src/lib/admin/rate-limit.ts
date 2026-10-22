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
  | "newsletter-signup"
  | "newsletter-signup-ip"
  | "register-ip"
  | "password-reset-ip"
  | "verify-resend"
  | "admin-login-ip"
  | "customer-login-ip"
  | "staff-stamp"
  | "checkout-reopen"
  | "card-payment-ip"
  | "card-payment-order"
  | "table-lookup"
  | "checkout-start"
  | "card-delete"
  | "karaoke-hold"
  | "karaoke-guest-ip"
  | "account-deletion"
  | "push-device"
  | "invoice-download";

/** Failures allowed before a lockout, per purpose. */
const MAX_FAILS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  // The app registering or forgetting its push token (POST and DELETE
  // /api/mobile/v1/devices). Every call counts, keyed on the member: the app
  // calls it at sign-in, after a permission prompt, at sign-out and about
  // weekly, so twenty in five minutes is far past honest use and a loop
  // churning rows stops quickly.
  "push-device": 20,
  // Guessing a promo code is not guessing a password: a real customer
  // mistyping their own coupon must not be locked out of checkout, while
  // scripted enumeration still hits a wall quickly.
  "promo-preview": 15,
  // Every request costs an e-mail to somebody else's inbox, so this one counts
  // successes as well as failures. Keyed by the ADDRESS alone (any IP): keyed
  // by IP + address, a sender rotating source addresses could mail one member
  // a reset link five times a minute, indefinitely. Three links per address,
  // then half an hour.
  "password-reset": 3,
  // The mail-sending forms per SENDER, whatever address they target. The
  // per-address keys stop flooding ONE inbox; these stop one sender from
  // mailing a list of strangers - every message leaves under our domain and
  // counts against the mail provider's daily quota, which the order and reset
  // mails share.
  "password-reset-ip": 10,
  "newsletter-signup-ip": 5,
  // Web sign-up: each one mails a verification link to the typed address and
  // opens a Supabase identity, and a refused one ("already registered") says
  // whether an address has an account.
  "register-ip": 10,
  // "Doğrulama e-postasını yeniden gönder" for a signed-in, unverified
  // member: an account registered with a stranger's address could otherwise
  // re-send to that inbox in a loop.
  "verify-resend": 3,
  // Sign-ins from one address across ALL accounts. The per-account keys give
  // every address five tries at each e-mail, so one address could walk a
  // leaked e-mail/password list (credential stuffing) or spray one password
  // over every panel account and never meet a limit - and each refused admin
  // attempt writes a `login_fail` audit row. Every attempt counts, success
  // included: clearing on success would let an attacker reset the budget by
  // signing in to an account of their own between guesses.
  "admin-login-ip": 20,
  "customer-login-ip": 30,
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
  // A barista scanning from the app (POST /api/mobile/v1/staff/stamp). Only a
  // code that matched nothing counts: that is what typing guesses produces,
  // while a busy bar's expired or already-spent scans are honest mistakes.
  // Fifteen misses in five minutes is far past a slow camera and well short
  // of walking an 8-character code space.
  "staff-stamp": 15,
  // Reopening the POS for an app order that already exists (a repeated
  // `clientOrderId`, or POST /orders/{id}/payment). Not a credential: every
  // reopen is counted, success or not, because each one is a call to the
  // payment provider and a `payment_transactions` row. Keyed on the member,
  // not the IP. A member whose card was refused retries a handful of times;
  // a script looping on one pending order was an unbounded stream of POS
  // sessions opened from this merchant account.
  "checkout-reopen": 8,
  // The site's own card form (/odeme/paynkolay POST, docs/PAYNKOLAY.md §15).
  // A merchant page that forwards card numbers to the POS is what card
  // testers look for: they replay a stolen list through it to learn which
  // cards are live. Like every purpose here the window is WINDOW_MS (five
  // minutes, fixed from the first count), then the lockout below.
  // Per ORDER (reserved before the POS is asked, success or not): a member
  // whose bank says no retries two or three times; five per window leaves a
  // pending order useless as a testing slot. Per ADDRESS: only the POS's
  // refusals and errors count (recordLoginFailure). Counting successes too
  // locked a whole café Wi-Fi out after ten paying customers.
  "card-payment-order": 5,
  "card-payment-ip": 10,
  // A table code (`GET /api/mobile/v1/tables/{code}`, the `table` order
  // path) that matched nothing. A real QR always resolves, so only a miss
  // counts, per address: twenty in five minutes is far past a shaky camera
  // and far short of walking a 2^50 code space.
  "table-lookup": 20,
  // "Siparişi onayla ve öde" on /odeme (startCheckoutAction). Each press may
  // create an order - a stock and coupon claim, POS lookups for the
  // member's older unpaid orders - so every press is
  // counted, success or not. Keyed on the member, not the address, like
  // checkout-reopen: a declined card, a retry and a price confirmation are
  // three presses; ten in five minutes is a script.
  "checkout-start": 10,
  // Deleting a saved card from /odeme: two POS calls each (list, delete).
  "card-delete": 10,
  // A karaoke booking that waits for its payment holds the hour while it
  // waits (up to ~75 minutes, karaoke-time.ts), and the open-bookings cap of
  // two says nothing about how often one member makes and abandons them. So
  // each NEW unpaid hold is counted per member, in a day-long window, and a
  // paid one clears the count: someone who pays is never limited, someone
  // who keeps two four-hour blocks on hold without paying gets four of them
  // a day. Reopening the payment of an existing hold is `checkout-reopen`.
  "karaoke-hold": 4,
  // A booking without an account has no verified handle at all, so the
  // network it comes from is counted too: eight new guest holds per address
  // a day - a busy café Wi-Fi books far fewer evenings than that.
  "karaoke-guest-ip": 8,
  // /uye/hesap/sil: sending a deletion request and taking it back, per
  // member. Every press counts, success or not: an opened or withdrawn
  // request mails the team and the member, so a loop of the two would be a
  // stream of mail. Six a day is three changes of mind.
  "account-deletion": 6,
  // A member's e-Arşiv PDF (/uye/hesap/siparislerim/{no}/fatura): each
  // download asks Paraşüt two or three times, and its limit (10 requests in
  // 10 s) is the köşk's for invoicing too. Every download counts: ten per
  // member in five minutes, then five minutes off.
  "invoice-download": 10,
};

/**
 * Counting window per purpose; WINDOW_MS (five minutes) unless listed. A
 * credential guess is a burst, so five minutes catches it; an abandoned
 * karaoke hold is a slow cycle, so its window is a day.
 */
const WINDOW_MS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  "karaoke-hold": 24 * 60 * 60 * 1000,
  "karaoke-guest-ip": 24 * 60 * 60 * 1000,
  "account-deletion": 24 * 60 * 60 * 1000,
};

function windowMs(purpose: AuthPurpose): number {
  return WINDOW_MS_BY_PURPOSE[purpose] ?? WINDOW_MS;
}

/** Lockout length per purpose; LOCKOUT_MS unless listed. */
const LOCKOUT_MS_BY_PURPOSE: Partial<Record<AuthPurpose, number>> = {
  "karaoke-hold": 12 * 60 * 60 * 1000,
  "karaoke-guest-ip": 12 * 60 * 60 * 1000,
  "account-deletion": 12 * 60 * 60 * 1000,
  "invoice-download": 5 * 60 * 1000,
  "admin-2fa-account": 15 * 60 * 1000,
  "newsletter-signup": 15 * 60 * 1000,
  "checkout-reopen": 10 * 60 * 1000,
  "checkout-start": 10 * 60 * 1000,
  "card-delete": 10 * 60 * 1000,
  "card-payment-order": 30 * 60 * 1000,
  "card-payment-ip": 60 * 60 * 1000,
  "newsletter-signup-ip": 60 * 60 * 1000,
  "password-reset": 30 * 60 * 1000,
  "password-reset-ip": 30 * 60 * 1000,
  "register-ip": 30 * 60 * 1000,
  "verify-resend": 15 * 60 * 1000,
  "admin-login-ip": 15 * 60 * 1000,
  "customer-login-ip": 15 * 60 * 1000,
  "table-lookup": 15 * 60 * 1000,
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
  /**
   * The counter could not be reached, so nothing was counted. Most callers
   * go on (a limiter that is down must not lock every member out); a
   * credential check that can afford to wait reads this and stops.
   */
  uncounted?: true;
}

const OPEN: RateLimitStatus = {
  blocked: false,
  retryAfterSeconds: 0,
  remaining: MAX_FAILS,
};

/** OPEN, marked as not counted: what an unreachable limiter answers. */
const UNCOUNTED: RateLimitStatus = { ...OPEN, uncounted: true };

/**
 * The address a budget is kept for. IPv4 as it came; IPv6 cut to its /64.
 *
 * A single host is routinely handed a whole /64 (every VPS, most home and
 * mobile lines), so keying on the full IPv6 address gave an attacker 2^64
 * fresh budgets for the price of one: the admin login, the 2FA step and the
 * mail-sending forms could be retried without limit by changing the last
 * four groups. One /64 is one subscriber, which is what a per-address budget
 * means to count. IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is read as the IPv4.
 *
 * Only the KEY changes: the IP stored as consent evidence (`clientIp()`) is
 * untouched.
 */
export function rateLimitAddress(ip: string): string {
  const raw = ip.trim().toLowerCase();
  if (!raw.includes(":")) return raw;
  // Strip brackets and a zone index ("fe80::1%eth0") before parsing.
  const addr = raw.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped =
    /^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (mapped) return mapped[1];
  const halves = addr.split("::");
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return raw;
  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return raw;
  return `${groups
    .slice(0, 4)
    .map((g) => g.padStart(4, "0"))
    .join(":")}::/64`;
}

function bucketKey(purpose: AuthPurpose, ip: string, identity: string): string {
  return `${purpose}::${rateLimitAddress(ip) || "unknown"}::${identity.trim().toLowerCase()}`;
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
  const stale = !started || now - started > windowMs(purpose);
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
    p_window_ms: windowMs(purpose),
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
    p_window_ms: windowMs(purpose),
    p_max_fails: maxFails(purpose),
    p_lockout_ms: lockoutMs(purpose),
  });
  // Same stance as checkLoginLimit: a limiter that cannot reach the database
  // must not lock everyone out; the credential check behind it still runs,
  // unless the caller reads `uncounted` (the panel's sign-in does).
  if (error || !data) {
    if (error) console.error("[rate-limit] reserve failed", error);
    return UNCOUNTED;
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
