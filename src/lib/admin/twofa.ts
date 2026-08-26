import "server-only";

import { generateSecret, generateURI, verifySync } from "otplib";

/**
 * In-memory TOTP secret store keyed by lowercased email. Each admin can
 * have at most one enrolled authenticator at a time.
 *
 * Swap the body for a row in `admin_2fa`
 * keyed by user_id. Interface stays the same.
 */

interface TwoFAEntry {
  secret: string;
  enabled: boolean;
  enrolledAt?: string;
}

const store = new Map<string, TwoFAEntry>();

function keyOf(email: string): string {
  return email.trim().toLowerCase();
}

export function has2FA(email: string): boolean {
  const e = store.get(keyOf(email));
  return Boolean(e?.enabled);
}

export interface EnrollmentDraft {
  secret: string;
  otpauthUrl: string;
}

/**
 * Generates a fresh pending secret for an admin. Returns the
 * `otpauth://` URL that the QR code encodes. The secret stays in
 * draft state (enabled=false) until verifyAndEnable() succeeds.
 */
export function startEnrollment(
  email: string,
  issuer: string,
): EnrollmentDraft {
  const secret = generateSecret();
  store.set(keyOf(email), { secret, enabled: false });
  const otpauthUrl = generateURI({ issuer, label: email, secret });
  return { secret, otpauthUrl };
}

export function cancelEnrollment(email: string): void {
  const entry = store.get(keyOf(email));
  if (entry && !entry.enabled) store.delete(keyOf(email));
}

export function disable2FA(email: string): void {
  store.delete(keyOf(email));
}

export function verifyToken(email: string, token: string): boolean {
  const entry = store.get(keyOf(email));
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

export function verifyAndEnable(email: string, token: string): boolean {
  if (!verifyToken(email, token)) return false;
  const entry = store.get(keyOf(email));
  if (!entry) return false;
  entry.enabled = true;
  entry.enrolledAt = new Date().toISOString();
  return true;
}
