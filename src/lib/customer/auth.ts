import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

import { publicRead } from "@/lib/db/health";

import { getCustomerByEmail, type PublicCustomer } from "./store";

const COOKIE_NAME = "laffogato_customer_session";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 gün

export interface CustomerSession {
  email: string;
  expiresAt: number;
}

function getSecret(): string {
  const secret =
    process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET (veya yedek ADMIN_SESSION_SECRET) tanımlı değil.",
    );
  }
  return secret;
}

function signToken(session: CustomerSession): string {
  const payload = `${session.email}|${session.expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

function verifyToken(token: string): CustomerSession | null {
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now())
    return null;
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

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const c = jar.get(COOKIE_NAME);
  if (!c?.value) return null;
  return verifyToken(c.value);
}

export async function getActiveCustomer(): Promise<PublicCustomer | null> {
  const session = await getCustomerSession();
  if (!session) return null;
  // Fails CLOSED when the database is unreachable: the visitor is treated as
  // logged out rather than the page erroring. Nothing is granted by this path —
  // every action that matters re-checks the account server-side.
  const customer = await publicRead("getActiveCustomer", null, () =>
    getCustomerByEmail(session.email),
  );
  // A deactivated account is treated as logged-out everywhere (login is also
  // blocked in verifyCustomerLogin) — this closes the live-session gap so a
  // member deactivated mid-session can no longer place orders or view account.
  if (!customer || !customer.isActive) return null;
  return customer;
}

export async function setActiveCustomerSession(email: string): Promise<void> {
  const expiresAt = Date.now() + COOKIE_MAX_AGE_SECONDS * 1000;
  const token = signToken({ email, expiresAt });
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function requireCustomer(): Promise<PublicCustomer> {
  const c = await getActiveCustomer();
  if (!c) redirect("/uye/giris");
  return c;
}
