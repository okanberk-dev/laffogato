import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  checkLoginLimit,
  clearLoginLimit,
  recordLoginFailure,
} from "./rate-limit";
import { canAccess, type AdminRole, type AdminSection } from "./roles";

const COOKIE_NAME = "laffogato_admin_session";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const VALID_ROLES: AdminRole[] = ["owner", "manager", "staff"];

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
 * Resolves the list of admin users from env. Two sources:
 *   - ADMIN_USERS (JSON array of {email,password,role})
 *   - Legacy ADMIN_EMAIL + ADMIN_PASSWORD (role = "owner")
 * The two are merged with ADMIN_USERS taking precedence on conflicts.
 */
function loadAdminUsers(): AdminUserRecord[] {
  const out: AdminUserRecord[] = [];
  const raw = process.env.ADMIN_USERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const email = String(
            (item as Record<string, unknown>).email ?? "",
          ).trim().toLowerCase();
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
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<SignInResult> {
  const users = loadAdminUsers();
  if (users.length === 0) {
    return {
      ok: false,
      error: "Admin kimlik bilgileri yapılandırılmamış (env eksik).",
    };
  }

  const ip = await getClientIp();

  // Block before checking creds so a brute-forcer can't drain the
  // password comparison loop while the bucket is full.
  const limit = checkLoginLimit(ip, email);
  if (limit.blocked) {
    return {
      ok: false,
      error: `Çok fazla başarısız deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  const needle = email.trim().toLowerCase();
  // Run timingSafeEqual against every user so the per-request work is
  // constant regardless of whether an email exists.
  let matched: AdminUserRecord | null = null;
  for (const u of users) {
    const emailOk = constantTimeEqual(needle, u.email);
    const passOk = constantTimeEqual(password, u.password);
    if (emailOk && passOk) matched = u;
  }
  if (!matched) {
    const after = recordLoginFailure(ip, email);
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

  clearLoginLimit(ip, email);

  const session: AdminSession = {
    email: matched.email,
    role: matched.role,
    expiresAt: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

/**
 * Server gate for admin sections. Call at the top of a page (or
 * server action) to enforce that the current session has access; on
 * deny it redirects to /admin (dashboard is the lowest-privilege page).
 */
export async function requireRole(section: AdminSection): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/giris");
  }
  if (!canAccess(section, session.role)) {
    redirect("/admin?denied=1");
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
