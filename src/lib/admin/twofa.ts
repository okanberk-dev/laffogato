import "server-only";

import { generateSecret, generateURI, verifySync } from "otplib";

import { getDb, TABLES } from "@/lib/db";

/**
 * TOTP enrollment, stored in Postgres.
 *
 * This used to be a module-scoped Map. On a single long-lived VM that works;
 * on Vercel every serverless instance starts with an empty one, so an admin
 * who enrolled was challenged on the instance that held their secret and waved
 * straight through on every other — the second factor was, in practice,
 * optional, and it failed OPEN.
 *
 * The secret never leaves the server: enrollment renders the otpauth:// URL
 * once, and verification happens here.
 */

interface TwoFARow {
  email: string;
  secret: string;
  enabled: boolean;
  enrolledAt: string;
  updatedAt: string;
}

function keyOf(email: string): string {
  return email.trim().toLowerCase();
}

async function readEntry(email: string): Promise<TwoFARow | null> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.admin2fa)
    .select("*")
    .eq("email", keyOf(email))
    .maybeSingle();
  if (error) throw new Error(`twofa.read: ${error.message}`);
  return (data as TwoFARow | null) ?? null;
}

/**
 * Whether this admin must present a second factor.
 *
 * Throws rather than returning false when the database cannot be reached: a
 * storage failure must not silently downgrade the login to one factor.
 */
export async function has2FA(email: string): Promise<boolean> {
  const entry = await readEntry(email);
  return Boolean(entry?.enabled);
}

export interface EnrollmentDraft {
  secret: string;
  otpauthUrl: string;
}

/**
 * Generates a fresh pending secret for an admin and returns the `otpauth://`
 * URL the QR code encodes. The secret stays in draft state (enabled=false)
 * until `verifyAndEnable` succeeds, so a half-finished enrollment can never
 * lock someone out.
 */
export async function startEnrollment(
  email: string,
  issuer: string,
): Promise<EnrollmentDraft> {
  const secret = generateSecret();
  const now = new Date().toISOString();
  const sb = getDb();
  const { error } = await sb.from(TABLES.admin2fa).upsert(
    {
      email: keyOf(email),
      secret,
      enabled: false,
      enrolledAt: "",
      updatedAt: now,
    },
    { onConflict: "email" },
  );
  if (error) throw new Error(`twofa.startEnrollment: ${error.message}`);
  return { secret, otpauthUrl: generateURI({ issuer, label: email, secret }) };
}

/** Drops a draft. An already-enabled enrollment is left alone. */
export async function cancelEnrollment(email: string): Promise<void> {
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.admin2fa)
    .delete()
    .eq("email", keyOf(email))
    .eq("enabled", false);
  if (error) throw new Error(`twofa.cancelEnrollment: ${error.message}`);
}

export async function disable2FA(email: string): Promise<void> {
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.admin2fa)
    .delete()
    .eq("email", keyOf(email));
  if (error) throw new Error(`twofa.disable2FA: ${error.message}`);
}

export async function verifyToken(
  email: string,
  token: string,
): Promise<boolean> {
  const entry = await readEntry(email);
  if (!entry?.secret) return false;
  const cleaned = token.replace(/\D/g, "");
  if (cleaned.length !== 6) return false;
  try {
    // ±30s tolerance for clock drift.
    const result = verifySync({
      secret: entry.secret,
      token: cleaned,
      epochTolerance: 30,
    });
    return result.valid;
  } catch {
    return false;
  }
}

export async function verifyAndEnable(
  email: string,
  token: string,
): Promise<boolean> {
  if (!(await verifyToken(email, token))) return false;
  const now = new Date().toISOString();
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.admin2fa)
    .update({ enabled: true, enrolledAt: now, updatedAt: now })
    .eq("email", keyOf(email));
  if (error) throw new Error(`twofa.verifyAndEnable: ${error.message}`);
  return true;
}
