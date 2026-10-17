import "server-only";

import { generateSecret, generateURI, verifySync } from "otplib";

import { getDb, TABLES } from "@/lib/db";

/**
 * TOTP enrollment, stored in Postgres.
 *
 * This used to be a module-scoped Map. On a single long-lived VM that works;
 * on Vercel every serverless instance starts with an empty one, so an admin
 * who enrolled was challenged on the instance that held their secret and waved
 * straight through on every other - the second factor was, in practice,
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
  /** Time step of the last accepted code; 0 = none yet (replay guard). */
  lastStep?: number | string;
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
 * How long a draft secret is shown again instead of being replaced. A draft
 * used to be minted on every render of the setup page, so a reload, a second
 * tab or a detour through the dashboard killed the QR already scanned and the
 * refusal blamed the phone's clock. Older than this, a draft that has been on
 * a screen nobody finished with is replaced.
 */
export const DRAFT_REUSE_MS = 15 * 60 * 1000;

function isFreshDraft(entry: TwoFARow, now: number): boolean {
  if (entry.enabled || !entry.secret) return false;
  const age = now - Date.parse(entry.updatedAt);
  // A minute of slack the other way: another instance's clock may run ahead.
  return Number.isFinite(age) && age > -60_000 && age < DRAFT_REUSE_MS;
}

function draftOf(
  email: string,
  issuer: string,
  secret: string,
): EnrollmentDraft {
  return { secret, otpauthUrl: generateURI({ issuer, label: email, secret }) };
}

/**
 * The pending secret for an admin and the `otpauth://` URL the QR code
 * encodes. A draft younger than DRAFT_REUSE_MS is returned as it is, so every
 * render of the page shows the QR the phone may already hold; otherwise a new
 * secret is written. The secret stays in draft state (enabled=false) until
 * `verifyAndEnable` succeeds, so a half-finished enrollment can never lock
 * someone out.
 *
 * Called by the setup page only, never from a "use server" file (every
 * export there is a public POST endpoint; tests/admin-2fa-enrollment.test.ts).
 */
export async function startEnrollment(
  email: string,
  issuer: string,
  now: number = Date.now(),
): Promise<EnrollmentDraft> {
  // Two rounds: a write that loses to a second tab reads that tab's draft.
  for (let round = 0; round < 2; round++) {
    const entry = await readEntry(email);
    // Never over an enabled enrollment: writing `enabled: false` would switch
    // 2FA off without the disable path's audit row. Turning it off is
    // `disable2FA`, deliberately.
    if (entry?.enabled) {
      throw new Error("twofa.startEnrollment: 2FA is already enabled");
    }
    if (entry && isFreshDraft(entry, now)) {
      return draftOf(email, issuer, entry.secret);
    }
    const secret = generateSecret();
    const at = new Date(now).toISOString();
    const sb = getDb();
    // Both writes are conditional, so neither can land on a row that was
    // enabled (or replaced by another tab) after it was read: a stale draft
    // is replaced only while it is still that draft; a missing row is
    // inserted only while it is still missing.
    const { data, error } = entry
      ? await sb
          .from(TABLES.admin2fa)
          .update({ secret, enrolledAt: "", updatedAt: at })
          .eq("email", keyOf(email))
          .eq("enabled", false)
          .eq("updatedAt", entry.updatedAt)
          .select("email")
      : await sb
          .from(TABLES.admin2fa)
          .upsert(
            {
              email: keyOf(email),
              secret,
              enabled: false,
              enrolledAt: "",
              updatedAt: at,
            },
            { onConflict: "email", ignoreDuplicates: true },
          )
          .select("email");
    if (error) throw new Error(`twofa.startEnrollment: ${error.message}`);
    if (((data as { email: string }[] | null) ?? []).length > 0) {
      return draftOf(email, issuer, secret);
    }
  }
  throw new Error("twofa.startEnrollment: the draft kept changing");
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

/**
 * The time step a code is valid for, or null when it is not a valid code for
 * this secret. ±30 s tolerance for clock drift.
 */
function matchedStep(secret: string, token: string): number | null {
  const cleaned = token.replace(/\D/g, "");
  if (cleaned.length !== 6) return null;
  try {
    const result = verifySync({ secret, token: cleaned, epochTolerance: 30 });
    if (!result.valid) return null;
    const step = (result as { timeStep?: number }).timeStep;
    return typeof step === "number" && Number.isFinite(step) ? step : null;
  } catch {
    return null;
  }
}

/**
 * Checks a code AND spends it.
 *
 * A code used to stay good for its whole step (up to 90 s with the drift
 * tolerance), however many times it was presented - one read over a shoulder
 * or out of a log was a second login. Now a code is accepted only for a step
 * LATER than the last one this admin used, and the check-and-set is a single
 * conditional UPDATE: two concurrent submissions of the same code cannot both
 * pass.
 */
export async function verifyToken(
  email: string,
  token: string,
): Promise<boolean> {
  const entry = await readEntry(email);
  if (!entry?.secret) return false;
  const step = matchedStep(entry.secret, token);
  if (step === null) return false;
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.admin2fa)
    .update({ lastStep: step })
    .eq("email", keyOf(email))
    .lt("lastStep", step)
    .select("email");
  if (error) throw new Error(`twofa.verifyToken: ${error.message}`);
  return ((data as { email: string }[] | null) ?? []).length > 0;
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
