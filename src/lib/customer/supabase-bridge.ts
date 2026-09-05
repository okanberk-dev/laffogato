import "server-only";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import { SITE } from "@/lib/seo/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { grantWelcomeCoupon } from "./coupons";
import {
  getCustomerByEmail,
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
