import "server-only";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { appendConsentChanges } from "./consent-ledger";

/**
 * A member's way out of commercial mail without logging in.
 *
 * `newsletter_subscribers` always had a token; a member who consented at
 * sign-up (site or app) did not, so a campaign to members could not carry the
 * one-click link 6563 and RFC 8058 both require. `customers."unsubToken"`
 * closes that gap, and this module spends it.
 *
 * Whichever store a token belongs to, BOTH end up off for that address: the
 * two consent registers used to drift (a subscriber-list unsubscribe left the
 * account's `marketing` flag on, and vice versa), which is the failure the
 * law actually punishes - a person who said no and kept receiving mail.
 *
 * Order and shipping mail are untouched: they are not subject to consent.
 *
 * Deliberately imports nothing from `@/lib/newsletter/store` - that module
 * imports this one, and the bulletin row is a one-line update here.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

type PrefsRow = Record<string, unknown> | null | undefined;

/** Both commercial preferences off; the order-mail preference as it was. */
function commercialOff(current: PrefsRow) {
  return {
    orderUpdates: current?.orderUpdates !== false,
    marketing: false,
    newsletter: false,
  };
}

/**
 * Switches a member's commercial preferences off by address and clears the
 * consent stamp. Returns false when no member row exists for the address.
 * Used after a subscriber-list unsubscribe so the account agrees with it.
 */
export async function disableCustomerMarketingByEmail(
  rawEmail: string,
): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return false;
  const db = getDb();
  const { data, error } = await db
    .from(TABLES.customers)
    .select("id, notificationPrefs")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "disableCustomerMarketingByEmail.select");
  if (!data) return false;
  const row = data as { id: string; notificationPrefs?: PrefsRow };
  const off = commercialOff(row.notificationPrefs);
  const { error: updErr } = await db
    .from(TABLES.customers)
    .update({
      notificationPrefs: off,
      marketingConsentAt: "",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", row.id);
  checkErr(updErr, "disableCustomerMarketingByEmail.update");
  await appendConsentChanges(email, row.notificationPrefs, off, {
    source: "newsletter-unsubscribe",
  });
  return true;
}

/** The bulletin row for the same address, if any, goes passive too. */
async function deactivateNewsletterRow(email: string): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.newsletterSubscribers)
    .update({ isActive: false, unsubscribedAt: new Date().toISOString() })
    .eq("email", email)
    .eq("isActive", true);
  checkErr(error, "unsubscribeCustomerByToken.newsletter");
}

/**
 * Spends a member unsubscribe token: `marketing` and `newsletter` off,
 * `marketingConsentAt` cleared, the token itself cleared in the same write so
 * a link works once. Returns the address, or `null` for an unknown or
 * already-spent token.
 */
export async function unsubscribeCustomerByToken(
  rawToken: string,
): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const db = getDb();
  const { data, error } = await db
    .from(TABLES.customers)
    .select("id, email, notificationPrefs")
    .eq("unsubToken", token)
    .maybeSingle();
  checkErr(error, "unsubscribeCustomerByToken.select");
  if (!data) return null;
  const row = data as {
    id: string;
    email: string;
    notificationPrefs?: PrefsRow;
  };

  // Conditioned on the token still being there, so two clicks racing the
  // same link cannot both report success.
  const off = commercialOff(row.notificationPrefs);
  const { data: spent, error: updErr } = await db
    .from(TABLES.customers)
    .update({
      notificationPrefs: off,
      marketingConsentAt: "",
      unsubToken: "",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("unsubToken", token)
    .select("email");
  checkErr(updErr, "unsubscribeCustomerByToken.update");
  const rows = (spent as { email: string }[] | null) ?? [];
  if (rows.length === 0) return null;

  const email = String(rows[0].email).trim().toLowerCase();
  await appendConsentChanges(email, row.notificationPrefs, off, {
    source: "unsubscribe-link",
  });
  try {
    await deactivateNewsletterRow(email);
  } catch (err) {
    // The member's own row is already off; the bulletin row is best-effort.
    console.error(
      "[unsubscribeCustomerByToken] bülten satırı kapatılamadı",
      err,
    );
  }
  return email;
}

/**
 * A refusal the person made on İYS itself, read from İYS's consent list on
 * /admin/iys (src/lib/iys/store.ts). The law has the sender honour it like
 * any other refusal, so it is applied the way the unsubscribe link applies
 * one: the member's `marketing` and `newsletter` off, the consent stamp
 * cleared, a ledger row per purpose that changed (source `iys`), and the
 * address's bulletin row off.
 *
 * The ledger row carries no IP and no browser: the refusal was not made
 * from this request, which is the operator's import. Returns which stores
 * changed; both false when the address had nothing switched on here.
 */
export async function applyIysRefusal(
  rawEmail: string,
): Promise<{ member: boolean; subscriber: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { member: false, subscriber: false };
  const db = getDb();
  const { data, error } = await db
    .from(TABLES.customers)
    .select("id, notificationPrefs, marketingConsentAt")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "applyIysRefusal.select");
  let member = false;
  if (data) {
    const row = data as {
      id: string;
      notificationPrefs?: PrefsRow;
      marketingConsentAt?: string;
    };
    const prefs = row.notificationPrefs;
    const wasOn =
      prefs?.marketing === true ||
      prefs?.newsletter === true ||
      Boolean(row.marketingConsentAt);
    if (wasOn) {
      const off = commercialOff(prefs);
      const { error: updErr } = await db
        .from(TABLES.customers)
        .update({
          notificationPrefs: off,
          marketingConsentAt: "",
          updatedAt: new Date().toISOString(),
        })
        .eq("id", row.id);
      checkErr(updErr, "applyIysRefusal.update");
      await appendConsentChanges(email, prefs, off, {
        source: "iys",
        ip: "",
      });
      member = true;
    }
  }
  const { data: rows, error: subErr } = await db
    .from(TABLES.newsletterSubscribers)
    .update({ isActive: false, unsubscribedAt: new Date().toISOString() })
    .eq("email", email)
    .eq("isActive", true)
    .select("id");
  checkErr(subErr, "applyIysRefusal.newsletter");
  const subscriber = ((rows as unknown[] | null) ?? []).length > 0;
  return { member, subscriber };
}
