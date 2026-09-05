import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";

import {
  checkLoginLimit,
  clearLoginLimit,
  clientIp,
  recordLoginFailure,
} from "./rate-limit";
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

interface AdminUserRecord {
  email: string;
  password: string;
  role: AdminRole;
}

/**
 * A bcrypt hash of nothing anybody knows. Compared against when the database
 * has no row for the typed address, so "unknown email" and "wrong password"
 * cost the same wall-clock time — otherwise the login page answers, in
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
      // ignore — fall back to single-user env below
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

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not configured — set it in .env.local",
    );
  }
  return secret;
}

function signToken(session: AdminSession): string {
  const payload = `${session.email}|${session.role}|${session.expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function verifyToken(token: string): AdminSession | null {
  const parts = token.split("|");
  // Back-compat: old tokens had 3 segments (email|exp|sig). New tokens
  // have 4 (email|role|exp|sig). Old tokens get rejected so users have
  // to sign in once after deploy.
  if (parts.length !== 4) return null;
  const [email, roleRaw, expiresAtStr, sig] = parts;
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
    .update(`${email}|${role}|${expiresAt}`)
    .digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { email, role, expiresAt };
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  needs2FA?: boolean;
  /** Role of the signed-in account — the login page redirects on it. */
  role?: AdminRole;
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<SignInResult> {
  const envUsers = loadEnvAdminUsers();

  const ip = await clientIp();

  // Block before checking creds so a brute-forcer can't drain the
  // password comparison loop while the bucket is full.
  const limit = await checkLoginLimit("admin-login", ip, email);
  if (limit.blocked) {
    return {
      ok: false,
      error: `Çok fazla başarısız deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  const needle = email.trim().toLowerCase();

  // The database is asked first and wins: a role changed or an account
  // deactivated in the panel takes effect on the next login. A row that is not
  // active does NOT shadow the env record — env is the break-glass path, and
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
    const after = await recordLoginFailure("admin-login", ip, email);
    if (after.blocked) {
      return {
        ok: false,
        error: `Çok fazla başarısız deneme. ${after.retryAfterSeconds} saniye sonra tekrar dene.`,
      };
    }
    return {
      ok: false,
      error:
        after.remaining > 1
          ? `E-posta veya şifre hatalı. (${after.remaining} hak kaldı.)`
          : "E-posta veya şifre hatalı. (Son hak — sonraki yanlış denemede kilitlenirsin.)",
    };
  }

  await clearLoginLimit("admin-login", ip, email);

  const cookieStore = await cookies();

  // If the account has 2FA enrolled, we don't issue the real session
  // cookie yet — we set a short-lived "pending" cookie and the login
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

  await setActiveSession(matched, cookieStore);
  return { ok: true, role: matched.role };
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
  user: { email: string; role: AdminRole },
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const session: AdminSession = {
    email: user.email,
    role: user.role,
    expiresAt: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
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
  const ip = await clientIp();
  const limit = await checkLoginLimit("admin-2fa", ip, pending.email);
  if (limit.blocked) {
    return {
      ok: false,
      error: `Çok fazla hatalı kod. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  if (!(await verify2FAToken(pending.email, token))) {
    const after = await recordLoginFailure("admin-2fa", ip, pending.email);
    return {
      ok: false,
      error: after.blocked
        ? `Çok fazla hatalı kod. ${after.retryAfterSeconds} saniye sonra tekrar dene.`
        : "Doğrulama kodu yanlış.",
    };
  }

  await clearLoginLimit("admin-2fa", ip, pending.email);
  const cookieStore = await cookies();
  await setActiveSession(pending, cookieStore);
  return { ok: true };
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

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function readSessionFromCookieValue(
  value: string | undefined,
): AdminSession | null {
  if (!value) return null;
  return verifyToken(value);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
