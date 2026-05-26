import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "laffogato_admin_session";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface AdminSession {
  email: string;
  expiresAt: number;
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
  const payload = `${session.email}|${session.expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function verifyToken(token: string): AdminSession | null {
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  const expected = createHmac("sha256", getSecret())
    .update(`${email}|${expiresAt}`)
    .digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { email, expiresAt };
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

export async function signInAdmin(
  email: string,
  password: string,
): Promise<SignInResult> {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return {
      ok: false,
      error: "Admin kimlik bilgileri yapılandırılmamış (env eksik).",
    };
  }

  const emailOk = constantTimeEqual(
    email.trim().toLowerCase(),
    expectedEmail.trim().toLowerCase(),
  );
  const passOk = constantTimeEqual(password, expectedPassword);

  if (!emailOk || !passOk) {
    return { ok: false, error: "E-posta veya şifre hatalı." };
  }

  const session: AdminSession = {
    email: expectedEmail.toLowerCase(),
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
