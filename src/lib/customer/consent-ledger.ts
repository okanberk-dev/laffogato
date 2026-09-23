import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * The append-only consent ledger (`customer_consents`) behind a member's
 * commercial preferences.
 *
 * `customers."notificationPrefs"` stays the read model - the campaign
 * audience and `/me` read it, nothing reads the ledger to decide who gets
 * mail. The ledger is the HISTORY the read model cannot keep: every change of
 * `marketing` or `newsletter`, with where it came from, the member's IP and
 * browser/app string when they made it, and the text version a grant refers
 * to - what the Ticari Elektronik İleti ve İYS Aydınlatması says is recorded
 * for every consent. A withdrawal used to
 * clear `marketingConsentAt` and leave nothing; the published Veri Saklama ve
 * İmha Politikası promises a "ret kaydı" for three years.
 *
 * Every writer of those two flags calls `appendConsentChanges` after its own
 * write succeeded (`tests/consent-ledger.test.ts` finds them by source):
 * site sign-up, the app's first sign-in (Supabase bridge), the site's account
 * page, PATCH /me, the member unsubscribe link, the bulletin unsubscribe link
 * that also switches the member off, the admin customer form, and account
 * closure.
 *
 * Best-effort by design: the preference change has already happened when
 * this runs, and a withdrawal must never fail because its history could not
 * be written. A failed append is logged loudly (address masked) instead.
 */

export const CONSENT_PURPOSES = ["marketing", "newsletter"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type ConsentSource =
  | "site-signup"
  | "app-signup"
  | "site-account"
  | "app-account"
  | "unsubscribe-link"
  | "newsletter-unsubscribe"
  | "admin"
  | "account-deletion";

/**
 * What a grant refers to: the Ticari Elektronik İleti ve İYS Aydınlatması,
 * which carries no revision date of its own and so is issued under the
 * contract set's (`LEGAL_UPDATED`). Withdrawals record ''.
 */
export const COMMERCIAL_CONSENT_TEXT_VERSION = `ticari-elektronik-ileti@${LEGAL_UPDATED}`;

type Flags = Partial<Record<ConsentPurpose, unknown>> | null | undefined;

export interface ConsentChange {
  purpose: ConsentPurpose;
  granted: boolean;
}

/** The purposes whose flag differs between the two states; pure. */
export function consentChanges(before: Flags, after: Flags): ConsentChange[] {
  const out: ConsentChange[] = [];
  for (const purpose of CONSENT_PURPOSES) {
    const was = before?.[purpose] === true;
    const now = after?.[purpose] === true;
    if (was !== now) out.push({ purpose, granted: now });
  }
  return out;
}

function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  return `${address.slice(0, Math.min(2, at))}***${address.slice(at)}`;
}

/** The request's IP, or '' outside a request (cron, script, test). */
async function requestIp(): Promise<string> {
  try {
    const { clientIp } = await import("@/lib/admin/rate-limit");
    return await clientIp();
  } catch {
    return "";
  }
}

/** The request's User-Agent (browser, or the app's own), or ''. */
async function requestUserAgent(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("user-agent") ?? "";
  } catch {
    return "";
  }
}

export interface ConsentContext {
  source: ConsentSource;
  /**
   * The member's IP. Omitted: read from the request. Pass '' where the
   * request is not the member's own act (an admin edit, a sign-in that
   * copies a consent given earlier in the app); the User-Agent then stays
   * '' too.
   */
  ip?: string;
  /** Omitted: read from the request, unless `ip` was given as ''. */
  userAgent?: string;
  now?: Date;
}

/**
 * Appends one row per purpose whose flag changed. Returns how many rows were
 * written (0 when nothing changed or the write failed).
 */
export async function appendConsentChanges(
  rawEmail: string,
  before: Flags,
  after: Flags,
  ctx: ConsentContext,
): Promise<number> {
  const email = rawEmail.trim().toLowerCase();
  const changes = consentChanges(before, after);
  if (!email || changes.length === 0) return 0;

  const ip = (ctx.ip ?? (await requestIp())).slice(0, 64);
  const userAgent = (
    ctx.userAgent ?? (ctx.ip === "" ? "" : await requestUserAgent())
  ).slice(0, 300);
  const createdAt = (ctx.now ?? new Date()).toISOString();
  const rows = changes.map((change) => ({
    customerEmail: email,
    purpose: change.purpose,
    granted: change.granted,
    source: ctx.source,
    ip,
    userAgent,
    textVersion: change.granted ? COMMERCIAL_CONSENT_TEXT_VERSION : "",
    createdAt,
  }));
  try {
    const { error } = await getDb()
      .from(TABLES.customerConsents)
      .insert(rows);
    if (error) throw new Error(error.message);
    return rows.length;
  } catch (err) {
    console.error(
      `[consent-ledger] YAZILAMADI ${maskEmail(email)} ${ctx.source}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return 0;
  }
}
