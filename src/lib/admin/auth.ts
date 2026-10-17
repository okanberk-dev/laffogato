import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";

import bcrypt from "bcryptjs";

import { clearLoginLimit, clientIp, reserveLoginAttempt } from "./rate-limit";
import {
  ADMIN_ROLES,
  canAccess,
  landingPathFor,
  type AdminRole,
  type AdminSection,
} from "./roles";
import { has2FA, verifyToken as verify2FAToken } from "./twofa";
import {
  anyAdminUserExists,
  resolveAdminUser,
  verifyAdminPassword,
} from "./users";

const COOKIE_NAME = "laffogato_admin_session";
const PENDING_COOKIE_NAME = "laffogato_admin_pending_2fa";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const PENDING_MAX_AGE_SECONDS = 5 * 60;

const VALID_ROLES: AdminRole[] = ADMIN_ROLES;

export interface AdminSession {
  email: string;
  role: AdminRole;
  expiresAt: number;
}

/** What the signed cookie carries: the session plus the credential it was issued for. */
interface SignedSession extends AdminSession {
  fingerprint: string;
}

interface AdminUserRecord {
  email: string;
  password: string;
  role: AdminRole;
}

/**
 * A bcrypt hash of nothing anybody knows. Compared against when the database
 * has no row for the typed address, so "unknown email" and "wrong password"
 * cost the same wall-clock time - otherwise the login page answers, in
 * milliseconds, which addresses are real.
 */
const DUMMY_HASH =
  "$2a$10$invalidhashforuserenumprotection000000000000000000000";

/**
 * Resolves the list of admin users from env. Two sources:
 *   - ADMIN_USERS (JSON array of {email,password,role})
 *   - Legacy ADMIN_EMAIL + ADMIN_PASSWORD (role = "owner")
 * The two are merged with ADMIN_USERS taking precedence on conflicts.
 *
 * These are the BREAK-GLASS accounts. Day-to-day users live in `admin_users`
 * (see src/lib/admin/users.ts) and win on conflict; env stays so an owner who
 * loses panel access can still get in without a redeploy.
 */
function loadEnvAdminUsers(): AdminUserRecord[] {
  const out: AdminUserRecord[] = [];
  const raw = process.env.ADMIN_USERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const email = String((item as Record<string, unknown>).email ?? "")
            .trim()
            .toLowerCase();
          const password = String(
            (item as Record<string, unknown>).password ?? "",
          );
          const role = String(
            (item as Record<string, unknown>).role ?? "owner",
          ) as AdminRole;
          if (email && password && VALID_ROLES.includes(role)) {
            out.push({ email, password, role });
          }
        }
      }
    } catch {
      // ignore - fall back to single-user env below
    }
  }
  const fallbackEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const fallbackPassword = process.env.ADMIN_PASSWORD;
  if (
    fallbackEmail &&
    fallbackPassword &&
    !out.some((u) => u.email === fallbackEmail)
  ) {
    out.push({
      email: fallbackEmail,
      password: fallbackPassword,
      role: "owner",
    });
  }
  return out;
}

/**
 * The break-glass accounts' addresses and roles - never their passwords. For
 * the staff "new order" e-mail, which mails the roles Ayarlar names.
 */
export function listEnvAdminContacts(): { email: string; role: AdminRole }[] {
  return loadEnvAdminUsers().map(({ email, role }) => ({ email, role }));
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not configured - set it in .env.local",
    );
  }
  return secret;
}

/**
 * A short, keyed digest of the credential a session was issued for: the
 * bcrypt hash of a panel account, or the password of an env (break-glass)
 * account. It goes into the cookie and is compared against the account as it
 * is NOW on every request, so resetting an admin's password signs out every
 * session that was opened with the old one - including a stolen cookie.
 * Keyed with the session secret, so the cookie reveals nothing about the hash.
 */
function credentialFingerprint(source: "db" | "env", material: string): string {
  return createHmac("sha256", getSecret())
    .update(`fp|${source}|${material}`)
    .digest("hex")
    .slice(0, 24);
}

function signToken(session: SignedSession): string {
  const payload = `${session.email}|${session.role}|${session.expiresAt}|${session.fingerprint}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function verifyToken(token: string): SignedSession | null {
  const parts = token.split("|");
  // Five segments (email|role|exp|fingerprint|sig). The four-segment tokens
  // issued before the fingerprint existed are refused, so every admin signs
  // in once after this deploy - the only way to make sessions that predate
  // it revocable.
  if (parts.length !== 5) return null;
  const [email, roleRaw, expiresAtStr, fingerprint, sig] = parts;
  const role = roleRaw as AdminRole;
  const expiresAt = Number(expiresAtStr);
  if (
    !email ||
    !fingerprint ||
    !VALID_ROLES.includes(role) ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now()
  ) {
    return null;
  }

  const expected = createHmac("sha256", getSecret())
    .update(`${email}|${role}|${expiresAt}|${fingerprint}`)
    .digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { email, role, expiresAt, fingerprint };
}

interface CurrentAccount {
  email: string;
  role: AdminRole;
  fingerprint: string;
}

/**
 * The account behind an address as it stands NOW - the same precedence the
 * login uses: an active panel row wins; an inactive or missing row falls back
 * to the env break-glass record; neither means no account.
 *
 * This is what makes a session revocable. The cookie used to be trusted on
 * its own for seven days: deactivating a user, demoting a manager to cashier
 * or resetting a password changed nothing until it expired.
 */
async function currentAccount(email: string): Promise<CurrentAccount | null> {
  const needle = email.trim().toLowerCase();
  let dbUser: Awaited<ReturnType<typeof resolveAdminUser>> = null;
  try {
    dbUser = await resolveAdminUser(needle);
  } catch (err) {
    // The env owner must still reach the panel while the database is down;
    // a panel account cannot be vouched for, so it falls through to null.
    console.error("[admin-auth] account lookup failed", err);
  }
  if (dbUser) {
    return {
      email: dbUser.email,
      role: dbUser.role,
      fingerprint: credentialFingerprint("db", dbUser.passwordHash),
    };
  }
  const env = loadEnvAdminUsers().find((u) => u.email === needle);
  if (env) {
    return {
      email: env.email,
      role: env.role,
      fingerprint: credentialFingerprint("env", env.password),
    };
  }
  return null;
}

/**
 * Equality whose timing says nothing about either value - including its
 * LENGTH. The early `length !== length` return this used to make answered a
 * wrong-length guess faster than a right-length one, which leaks how long the
 * env admin password is. Both sides are hashed to 32 bytes first, so
 * `timingSafeEqual` always compares equal-sized buffers.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const aDigest = createHash("sha256").update(a).digest();
  const bDigest = createHash("sha256").update(b).digest();
  return timingSafeEqual(aDigest, bDigest);
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  needs2FA?: boolean;
  /** Role of the signed-in account - the login page redirects on it. */
  role?: AdminRole;
  /**
   * Refused by the rate limiter, the credentials never checked. The login
   * action writes no `login_fail` audit row for these: an unauthenticated
   * caller hammering a locked key could otherwise fill `audit_logs`.
   */
  throttled?: boolean;
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<SignInResult> {
  const envUsers = loadEnvAdminUsers();

  const ip = await clientIp();

  // Counted BEFORE the credentials are checked (reserveLoginAttempt): a
  // burst sent in parallel used to pass the check all at once and get every
  // guess verified. A success clears the key below.
  // Per address across every account first (credential stuffing, password
  // spraying), then this address + account.
  const perAddress = await reserveLoginAttempt("admin-login-ip", ip, "*");
  const limit = perAddress.blocked
    ? perAddress
    : await reserveLoginAttempt("admin-login", ip, email);
  if (limit.blocked) {
    return {
      ok: false,
      throttled: true,
      error: `Çok fazla başarısız deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  const needle = email.trim().toLowerCase();

  // The database is asked first and wins: a role changed or an account
  // deactivated in the panel takes effect on the next login. A row that is not
  // active does NOT shadow the env record - env is the break-glass path, and
  // an owner locked out of the panel has to be able to get back in.
  const dbUser = await resolveAdminUser(needle);
  let matched: { email: string; role: AdminRole } | null = null;
  if (dbUser) {
    if (await verifyAdminPassword(dbUser, password)) {
      matched = { email: dbUser.email, role: dbUser.role };
    }
  } else {
    // Same cost as the bcrypt branch above, so the database's answer about
    // this address does not leak through the response time.
    await bcrypt.compare(password, DUMMY_HASH);
    // Run timingSafeEqual against every user so the per-request work is
    // constant regardless of whether an email exists.
    for (const u of envUsers) {
      const emailOk = constantTimeEqual(needle, u.email);
      const passOk = constantTimeEqual(password, u.password);
      if (emailOk && passOk) matched = { email: u.email, role: u.role };
    }
  }

  if (!matched && envUsers.length === 0 && !(await anyAdminUserExists())) {
    return {
      ok: false,
      error: "Admin kimlik bilgileri yapılandırılmamış (env eksik).",
    };
  }

  if (!matched) {
    // This attempt was already counted by the reservation above.
    if (limit.remaining === 0) {
      return {
        ok: false,
        error:
          "E-posta veya şifre hatalı. Çok fazla başarısız deneme - bir süre sonra tekrar dene.",
      };
    }
    return {
      ok: false,
      error:
        limit.remaining > 1
          ? `E-posta veya şifre hatalı. (${limit.remaining} hak kaldı.)`
          : "E-posta veya şifre hatalı. (Son hak - sonraki yanlış denemede kilitlenirsin.)",
    };
  }

  await clearLoginLimit("admin-login", ip, email);

  const cookieStore = await cookies();

  // If the account has 2FA enrolled, we don't issue the real session
  // cookie yet - we set a short-lived "pending" cookie and the login
  // page sends the user to /admin/iki-asama where they have to enter
  // the 6-digit code.
  if (await has2FA(matched.email)) {
    const pending = signPendingToken(matched);
    cookieStore.set(PENDING_COOKIE_NAME, pending, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PENDING_MAX_AGE_SECONDS,
    });
    return { ok: true, needs2FA: true, role: matched.role };
  }

  const account = await currentAccount(matched.email);
  if (!account) {
    return { ok: false, error: "Giriş başarısız." };
  }
  await setActiveSession(account, cookieStore);
  return { ok: true, role: account.role };
}

interface PendingAuthSession {
  email: string;
  role: AdminRole;
  expiresAt: number;
}

function signPendingToken(user: { email: string; role: AdminRole }): string {
  const expiresAt = Date.now() + PENDING_MAX_AGE_SECONDS * 1000;
  const payload = `pending|${user.email}|${user.role}|${expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function verifyPendingToken(token: string): PendingAuthSession | null {
  const parts = token.split("|");
  if (parts.length !== 5 || parts[0] !== "pending") return null;
  const [, email, roleRaw, expiresAtStr, sig] = parts;
  const role = roleRaw as AdminRole;
  const expiresAt = Number(expiresAtStr);
  if (
    !email ||
    !VALID_ROLES.includes(role) ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now()
  ) {
    return null;
  }
  const expected = createHmac("sha256", getSecret())
    .update(`pending|${email}|${role}|${expiresAt}`)
    .digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { email, role, expiresAt };
}

async function setActiveSession(
  account: CurrentAccount,
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const session: SignedSession = {
    email: account.email,
    role: account.role,
    expiresAt: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
    fingerprint: account.fingerprint,
  };
  cookieStore.set(COOKIE_NAME, signToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  cookieStore.delete(PENDING_COOKIE_NAME);
}

export async function getPendingSession(): Promise<PendingAuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PENDING_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyPendingToken(token);
  } catch {
    return null;
  }
}

export interface TwoFAResult {
  ok: boolean;
  error?: string;
  /** Role of the signed-in account - the 2FA step redirects on it. */
  role?: AdminRole;
}

export async function complete2FA(token: string): Promise<TwoFAResult> {
  const pending = await getPendingSession();
  if (!pending) {
    return { ok: false, error: "Oturum süresi doldu. Yeniden giriş yap." };
  }

  // A 6-digit code is a 1-in-a-million guess, and the pending cookie lives
  // long enough to try a great many of them. The password behind it is
  // already rate-limited; the second factor was not, which made it the
  // cheaper of the two to attack.
  //
  // Two budgets, both counted before the code is checked: this address +
  // account, and the account alone. The per-address one is what a person
  // mistyping meets; the account one stops an attacker who has the password
  // from rotating addresses to keep guessing six digits.
  const ip = await clientIp();
  const perAddress = await reserveLoginAttempt("admin-2fa", ip, pending.email);
  const perAccount = perAddress.blocked
    ? perAddress
    : await reserveLoginAttempt("admin-2fa-account", "*", pending.email);
  const limit = perAddress.blocked ? perAddress : perAccount;
  if (limit.blocked) {
    return {
      ok: false,
      error: `Çok fazla hatalı kod. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  if (!(await verify2FAToken(pending.email, token))) {
    return {
      ok: false,
      error:
        perAddress.remaining === 0 || perAccount.remaining === 0
          ? "Doğrulama kodu yanlış. Çok fazla hatalı kod - bir süre sonra tekrar dene."
          : "Doğrulama kodu yanlış.",
    };
  }

  // The account may have been deactivated or re-keyed in the five minutes
  // since the password step; the session is issued for it as it is now.
  const account = await currentAccount(pending.email);
  if (!account) {
    return { ok: false, error: "Oturum süresi doldu. Yeniden giriş yap." };
  }
  await clearLoginLimit("admin-2fa", ip, pending.email);
  await clearLoginLimit("admin-2fa-account", "*", pending.email);
  const cookieStore = await cookies();
  await setActiveSession(account, cookieStore);
  return { ok: true, role: account.role };
}

export async function cancelPending2FA(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_COOKIE_NAME);
}

/**
 * Server gate for admin sections. Call at the top of a page (or
 * server action) to enforce that the current session has access; on
 * deny it redirects to /admin (dashboard is the lowest-privilege page).
 */
export async function requireRole(
  section: AdminSection,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/giris");
  }
  if (!canAccess(section, session.role)) {
    // A role without dashboard access cannot be sent to /admin on denial: that
    // page would deny it too and the two redirects would bounce forever.
    redirect(`${landingPathFor(session.role)}?denied=1`);
  }
  return session;
}

export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * The signed-in admin, checked against the account as it is NOW: the cookie's
 * signature proves who it was issued to; the account decides whether that
 * still stands (active, same credential) and which role applies. A demoted
 * manager is a cashier on their next click, a deactivated user or a reset
 * password is signed out everywhere.
 *
 * Memoised per request (`cache`): the layout, the page and the audit logger
 * all ask, and each ask is a database read.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await sessionFromToken(token);
  } catch {
    return null;
  }
});

/** Exported for tests: signature first, then the account as it stands. */
export async function sessionFromToken(
  token: string,
): Promise<AdminSession | null> {
  const signed = verifyToken(token);
  if (!signed) return null;
  const account = await currentAccount(signed.email);
  if (!account || !constantTimeEqual(account.fingerprint, signed.fingerprint)) {
    return null;
  }
  return {
    email: account.email,
    role: account.role,
    expiresAt: signed.expiresAt,
  };
}

/**
 * Signature-only read for `proxy.ts`, which decides nothing but whether to
 * redirect a page view to the login screen. Authorisation - every page and
 * every server action - goes through getAdminSession / requireRole.
 */
export function readSessionFromCookieValue(
  value: string | undefined,
): AdminSession | null {
  if (!value) return null;
  const signed = verifyToken(value);
  return signed
    ? { email: signed.email, role: signed.role, expiresAt: signed.expiresAt }
    : null;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
