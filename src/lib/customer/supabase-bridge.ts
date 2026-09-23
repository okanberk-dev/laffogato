import "server-only";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import { SITE } from "@/lib/seo/site";
import {
  findSupabaseIdentityByEmail,
  hasServiceRole,
  updateSupabasePassword,
  type PasswordSync,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { appendConsentChanges } from "./consent-ledger";
import { grantWelcomeCoupon } from "./coupons";
import {
  activatePendingNewsletter,
  getCustomerByEmail,
  toPublicCustomer,
  type Customer,
  type PublicCustomer,
} from "./store";
import {
  linkableUserId,
  normalizeEmail,
  planCustomerLink,
  shouldAttemptSupabaseLink,
  type SupabaseUserLike,
} from "./supabase-link-plan";

/**
 * The bridge between Supabase Auth (who you are) and `customers` (what you
 * have here). Supabase is identity only; the member record, orders and coupons
 * stay in this database (docs/API-MOBILE.md §0, docs/AUTH-BRIDGE.md).
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

async function fetchRaw(email: string): Promise<Customer | null> {
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "supabaseBridge.fetch");
  return (data as Customer | null) ?? null;
}

/**
 * Whether this Supabase user is the identity of an account that was closed.
 *
 * `deleteMe` keeps the id on the anonymised row precisely so this question can
 * be answered: it frees the e-mail, so the address lookup above finds nothing
 * and a still-live identity would otherwise open a brand-new membership —
 * with a fresh welcome coupon — for whoever still knows the old password.
 * Deleting the Supabase user itself is best-effort (see
 * `deleteSupabaseIdentity`); this is the record that does not depend on it.
 *
 * Deliberately narrowed to CLOSED rows. A member who changes their address in
 * Supabase keeps an active row under the old one, and matching that by id
 * would hand them a row this function's caller cannot then read back by
 * e-mail. Address changes stay "one membership per e-mail".
 */
async function identityRevoked(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("id")
    .eq("supabaseUserId", userId)
    .eq("isActive", false)
    .limit(1);
  checkErr(error, "supabaseBridge.revoked");
  return ((data as unknown[] | null) ?? []).length > 0;
}

export type EnsureCustomerResult =
  | { ok: true; customer: PublicCustomer; created: boolean }
  | {
      ok: false;
      reason: "account_disabled" | "missing_email" | "email_unconfirmed";
    };

/**
 * Finds — or creates — the `customers` row for a verified Supabase user and
 * returns its public view. One membership per e-mail: a member who signed up
 * on the site years ago and now installs the app lands on the same row.
 *
 * Throws on database failure (`DbUnreachableError` / `DbQueryError`) so the
 * caller can map an outage to 503 instead of silently creating nothing.
 */
export async function ensureCustomerForSupabaseUser(
  user: SupabaseUserLike,
): Promise<EnsureCustomerResult> {
  const email = normalizeEmail(user.email);
  if (!email) return { ok: false, reason: "missing_email" };
  return reconcile(email, user, false);
}

async function reconcile(
  email: string,
  user: SupabaseUserLike,
  retried: boolean,
): Promise<EnsureCustomerResult> {
  const now = new Date().toISOString();
  const existing = await fetchRaw(email);
  // Only worth asking when the address itself matched nothing: an existing row
  // already answers "disabled" on its own.
  const revoked = existing ? false : await identityRevoked(user.id);
  const plan = planCustomerLink(existing, user, now, undefined, revoked);
  const db = getDb();

  if (plan.action === "disabled") {
    return { ok: false, reason: "account_disabled" };
  }
  if (plan.action === "unconfirmed") {
    return { ok: false, reason: "email_unconfirmed" };
  }
  // Steady state, and every authenticated mobile request passes through it:
  // nothing is written, so `existing` IS the row the read-back below would
  // return. That read-back was a second identical `select * from customers`
  // on a pool of `max: 1` — it could not even overlap the first. The
  // deactivated and unconfirmed cases were refused above, which is what the
  // read-back's own `isActive` guard checks for.
  if (plan.action === "none" && existing) {
    return { ok: true, customer: toPublicCustomer(existing), created: false };
  }

  let created = false;
  if (plan.action === "create") {
    const { error } = await db.from(TABLES.customers).insert(plan.row);
    if (error) {
      // Unique violation: the app and the site created the row at the same
      // moment. The other write won — read it back and reconcile against it.
      if (error.code === "23505" && !retried) {
        return reconcile(email, user, true);
      }
      checkErr(error, "supabaseBridge.insert");
    }
    created = true;
    // The consent the member gave in the app's sign-up form (Supabase
    // metadata), into the history. No IP: this request is not where the
    // box was ticked.
    await appendConsentChanges(email, null, plan.row.notificationPrefs, {
      source: "app-signup",
      ip: "",
    });
  } else if (plan.action === "update") {
    const { error } = await db
      .from(TABLES.customers)
      .update(plan.patch)
      .eq("email", email);
    checkErr(error, "supabaseBridge.update");
  }

  if (plan.action !== "none" && plan.grantWelcome) {
    // Same moment and same rule as the site's own verification link:
    // idempotent, best-effort, never blocks sign-in.
    try {
      await grantWelcomeCoupon(email);
    } catch (err) {
      console.error("[coupons] welcome grant (supabase bridge) failed", err);
    }
    await activatePendingNewsletter(email);
  }

  const customer = await getCustomerByEmail(email);
  if (!customer) {
    // Only reachable if the row vanished between the write and the read.
    throw new Error("supabaseBridge: customer row missing after reconcile");
  }
  if (!customer.isActive) return { ok: false, reason: "account_disabled" };
  return { ok: true, customer, created };
}

export interface LinkByPasswordInput {
  email: string;
  password: string;
  name: string;
}

export type LinkByPasswordResult =
  | { attempted: false }
  | { attempted: true; supabaseUserId: string; error: string };

/** Where Supabase sends the member after they click its confirmation e-mail. */
export function supabaseEmailRedirectUrl(): string {
  return `${SITE.url}/uye/giris?dogrulandi=1`;
}

/**
 * One-time attempt to give a password-only (bcrypt) member a Supabase account
 * with the password they just proved they know.
 *
 * Runs after a successful site login or registration. Never blocks either: a
 * Supabase refusal, an address that already exists there, a network failure —
 * all are logged, the attempt is stamped on the row so it is not repeated, and
 * the member is signed in exactly as before. Skipped entirely when the row is
 * already linked or an attempt was made earlier (`shouldAttemptSupabaseLink`).
 *
 * The session Supabase may return (when "Confirm email" is off) is written to
 * the cookies by the server client, so the *next* site login already takes
 * the Supabase path.
 */
export async function linkCustomerToSupabase(
  input: LinkByPasswordInput,
): Promise<LinkByPasswordResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { attempted: false };
  const existing = await fetchRaw(email);
  if (!existing || !shouldAttemptSupabaseLink(existing)) {
    return { attempted: false };
  }

  let supabaseUserId = "";
  let errorText = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: { full_name: input.name.trim().slice(0, 100) },
        emailRedirectTo: supabaseEmailRedirectUrl(),
      },
    });
    if (error) {
      errorText = error.message;
    } else {
      supabaseUserId = linkableUserId(data.user);
    }
  } catch (err) {
    errorText = err instanceof Error ? err.message : String(err);
  }
  if (errorText) {
    // PII rule: never log the address itself.
    console.error(`[supabase] link attempt failed: ${errorText}`);
  }

  const now = new Date().toISOString();
  const patch: Partial<Customer> = {
    supabaseLinkAttemptedAt: now,
    updatedAt: now,
  };
  if (supabaseUserId) patch.supabaseUserId = supabaseUserId;
  const { error } = await getDb()
    .from(TABLES.customers)
    .update(patch)
    .eq("email", email);
  checkErr(error, "supabaseBridge.linkAttempt");
  return { attempted: true, supabaseUserId, error: errorText };
}

/**
 * What `linkIdentityAfterReset` did. Everything except `linked` leaves the row
 * exactly as the reset left it, which is today's behaviour: the site's new
 * password is the only one this project vouches for.
 */
export type ResetLinkOutcome =
  /** Found, linked, and the new password sent (see `password`). */
  | "linked"
  /** The row already carries an id; the reset itself mirrored to it. */
  | "already_linked"
  /** No active row under this address. */
  | "no_row"
  /** No service-role key: nothing looked up, nothing written. */
  | "skipped"
  /** Supabase has no password identity under this address. */
  | "none"
  /** There is one, but Supabase never saw the address confirmed. */
  | "unconfirmed"
  /** That identity is already recorded on another row (a closed account). */
  | "claimed"
  | "ambiguous"
  | "lookup_failed"
  /** Somebody linked the row between our read and our write. */
  | "raced";

export interface ResetLinkResult {
  outcome: ResetLinkOutcome;
  /** Only when a password write was attempted. */
  password?: PasswordSync;
}

/** Whether any row, closed or open, already names this identity. */
async function identityClaimed(userId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("id")
    .eq("supabaseUserId", userId)
    .limit(1);
  checkErr(error, "supabaseBridge.claimed");
  return ((data as unknown[] | null) ?? []).length > 0;
}

/**
 * A site password reset, for a member whose row was never linked to their
 * Supabase identity.
 *
 * `resetPasswordWithToken` mirrors the new password to the id the row
 * carries. A row the one-time link attempt could not link (Supabase already
 * had the address and answered with an obfuscated user, docs/AUTH-BRIDGE.md
 * §3) carries none, so the reset changed only the bcrypt hash - and the OLD
 * password went on opening the app, which is the credential a reset exists to
 * kill. This finds the identity by address, links it, and writes the new
 * password there too.
 *
 * Why the address is enough here and nowhere else: the member has just spent
 * a reset link mailed to it, which is the same proof Supabase's own
 * confirmation link tests. That is also why only a CONFIRMED identity is
 * linked. An unconfirmed one proves nothing about who created it, it cannot
 * sign in anyway, and linking it would make the site's sign-in treat
 * Supabase's "e-posta doğrulanmadı" refusal as final for this member
 * (`supabaseHoldsLatestPassword`), locking them out of the site too.
 *
 * An identity already named on another row is left alone: after an account
 * closure that kept its identity (no key at the time, or a failed delete),
 * the closed row's id is what refuses it (`identityRevoked`), and moving it
 * onto a new row would undo that.
 *
 * Order: the password goes first, the link second, and the link write is
 * conditioned on the row still being unlinked. If the process dies between
 * the two, Supabase holds the member's NEW password and the row is merely
 * still unlinked - the next app sign-in links it. `passwordMirroredAt` is
 * stamped only on a confirmed write, as `recordPasswordMirror` does.
 *
 * Inert without the service-role key: not even the row is read. Throws only
 * on a database failure; the caller must not let that undo the reset.
 */
export async function linkIdentityAfterReset(
  email: string,
  password: string,
): Promise<ResetLinkResult> {
  if (!hasServiceRole()) return { outcome: "skipped" };
  const address = normalizeEmail(email);
  if (!address || !password) return { outcome: "no_row" };

  const existing = await fetchRaw(address);
  if (!existing || existing.isActive === false) return { outcome: "no_row" };
  if ((existing.supabaseUserId ?? "").trim()) {
    return { outcome: "already_linked" };
  }

  const lookup = await findSupabaseIdentityByEmail(address);
  switch (lookup.status) {
    case "skipped":
      return { outcome: "skipped" };
    case "none":
      return { outcome: "none" };
    case "ambiguous":
      return { outcome: "ambiguous" };
    case "failed":
      return { outcome: "lookup_failed" };
    case "found":
      break;
  }
  // PII rule for every line below: neither the address nor the id.
  if (!lookup.confirmed) {
    console.warn(
      "[supabase] reset link skipped: the identity under this address is unconfirmed",
    );
    return { outcome: "unconfirmed" };
  }
  if (await identityClaimed(lookup.id)) {
    console.warn(
      "[supabase] reset link skipped: the identity is already recorded on another row",
    );
    return { outcome: "claimed" };
  }

  const sync = await updateSupabasePassword(lookup.id, password);
  const now = new Date().toISOString();
  const { data: written, error } = await getDb()
    .from(TABLES.customers)
    .update({
      supabaseUserId: lookup.id,
      supabaseLinkAttemptedAt: existing.supabaseLinkAttemptedAt || now,
      passwordMirroredAt: sync === "updated" ? now : "",
      updatedAt: now,
    })
    .eq("id", existing.id)
    .eq("supabaseUserId", "")
    .select("id");
  checkErr(error, "supabaseBridge.resetLink");
  if (((written as { id: string }[] | null) ?? []).length === 0) {
    console.warn("[supabase] reset link skipped: the row was linked meanwhile");
    return { outcome: "raced", password: sync };
  }
  return { outcome: "linked", password: sync };
}
