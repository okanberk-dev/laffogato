import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";

/**
 * The service-role client - two jobs, both about a credential the member has
 * asked us to destroy: deleting the sign-in identity of a member who closed
 * their account (`DELETE /me`, docs/hukuk/hesap-silme), and retiring the old
 * password when they reset it (`resetPasswordWithToken`, and for a row that
 * was never linked, `linkIdentityAfterReset` via `findSupabaseIdentityByEmail`).
 *
 * The key bypasses every Supabase policy, so it is deliberately walled off
 * here instead of being handed to a general-purpose client:
 *   - `server-only`, and read from `process.env` with NO `NEXT_PUBLIC_`
 *     prefix, so it can never reach a browser or the app bundle;
 *   - the exports that use it (`deleteSupabaseIdentity`,
 *     `updateSupabasePassword`, `findSupabaseIdentityByEmail`) touch the auth
 *     admin API and nothing in the data schema - member records, orders and
 *     money stay in this project's own Postgres (docs/API-MOBILE.md §0).
 *     `hasServiceRole` reports presence only, never the value;
 *   - optional: without the variable the site behaves exactly as before, and
 *     the caller falls back to marking the identity closed instead.
 *
 * Do not widen this file. If something else ever needs elevated access, it
 * needs its own justification and its own review. The justification for the
 * second job: site and app share one identity (docs/AUTH-BRIDGE.md), and a
 * reset that changes only this project's bcrypt hash leaves the OLD password
 * opening the app. Whoever the member is resetting against would still be in.
 * Changing another user's password is `auth.admin` work by definition - the
 * member is not signed in at the time, that is the whole situation.
 *
 * The lookup is the second job's missing half, not a third job. The mirror
 * above can only write to an identity whose id the row carries, and a row the
 * one-time link attempt never managed to link (docs/AUTH-BRIDGE.md §3, the
 * "obfuscated user" answer) carries none - so the OLD password kept opening
 * the app after a reset here. Finding that identity by the address the member
 * has just proved they read is read-only, returns an id and one flag, and is
 * called from exactly one place.
 */

declare global {
  var __laffogatoSupabaseAdmin: SupabaseClient | undefined;
}

function serviceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

/**
 * Whether this deployment holds a service-role key. Presence only: the value
 * never leaves this module, and nothing that calls this can learn more than
 * the one bit.
 *
 * It exists because a missing key used to be invisible. Every job below
 * answers `skipped` without it and the site carries on, which is correct, but
 * the operator had no way to tell that from "working" short of reading the
 * Vercel dashboard - and the connector that audits this project cannot read
 * environment variables. The settings page shows this bit, and the skips are
 * now logged with their reason.
 */
export function hasServiceRole(): boolean {
  return serviceRoleKey() !== "";
}

function getSupabaseAdminClient(): SupabaseClient | null {
  const key = serviceRoleKey();
  if (!key) return null;
  if (!global.__laffogatoSupabaseAdmin) {
    global.__laffogatoSupabaseAdmin = createClient(SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return global.__laffogatoSupabaseAdmin;
}

/**
 * What happened to the identity of a closed account.
 *
 * `skipped` is not a failure: a deployment without the key is a supported
 * configuration. It does mean the identity is still alive, so the caller must
 * make sure it can no longer open a membership here - see the closed-row check
 * in `@/lib/customer/supabase-bridge`.
 */
export type IdentityDeletion = "deleted" | "skipped" | "failed";

/**
 * Deletes a Supabase Auth user. Never throws: account closure has already
 * happened in our own database by the time this runs, and it must not be
 * undone by an auth-service outage.
 */
export async function deleteSupabaseIdentity(
  userId: string,
): Promise<IdentityDeletion> {
  if (!userId.trim()) return "skipped";
  const admin = getSupabaseAdminClient();
  if (!admin) return "skipped";
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      // PII rule: the id, never the address.
      console.error(`[supabase] identity delete failed: ${error.message}`);
      return "failed";
    }
    return "deleted";
  } catch (err) {
    console.error(
      `[supabase] identity delete threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "failed";
  }
}

/**
 * Points a member's Supabase password at the one they just chose here.
 *
 * Never throws, and never blocks the reset: a member who cannot get back into
 * their account at all is worse off than one whose app password lags. A
 * failure is loud in the log because it leaves a live old credential - the
 * operator's move is to have them reset again once auth is reachable.
 *
 * `skipped` covers both a deployment with no service-role key and a member
 * who has no Supabase identity to update; neither is an error to the caller.
 * The first one is logged all the same: it means the password the member has
 * just replaced still opens the app, and that is the one fact the operator
 * could not otherwise see.
 */
export type PasswordSync = "updated" | "skipped" | "failed";

export async function updateSupabasePassword(
  userId: string,
  password: string,
): Promise<PasswordSync> {
  if (!userId.trim() || !password) return "skipped";
  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.warn(
      "[supabase] password sync skipped: SUPABASE_SERVICE_ROLE_KEY is not set, the previous password still opens the app",
    );
    return "skipped";
  }
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) {
      // PII rule: the id, never the address or the password.
      console.error(`[supabase] password sync failed: ${error.message}`);
      return "failed";
    }
    return "updated";
  } catch (err) {
    console.error(
      `[supabase] password sync threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "failed";
  }
}

/**
 * What a lookup by address found.
 *
 * `skipped` is the same supported configuration as above (no key). `failed`
 * is Supabase not answering, or answering with something we cannot read.
 * `ambiguous` is more than one password identity for the one address, which
 * GoTrue should never hold; linking either would be a guess, so neither is.
 */
export type IdentityLookup =
  | { status: "found"; id: string; confirmed: boolean }
  | { status: "none" }
  | { status: "ambiguous" }
  | { status: "skipped" }
  | { status: "failed" };

/** One page is plenty for one address; the loop exists for pathological data. */
const LOOKUP_PAGE_SIZE = 100;
const LOOKUP_MAX_PAGES = 5;
/** A member is waiting on the reset form while this runs. */
const LOOKUP_TIMEOUT_MS = 5_000;

interface AdminUserRow {
  id?: unknown;
  email?: unknown;
  email_confirmed_at?: unknown;
  is_sso_user?: unknown;
  is_anonymous?: unknown;
}

function isExactPasswordIdentity(user: AdminUserRow, needle: string): boolean {
  return (
    typeof user.email === "string" &&
    user.email.trim().toLowerCase() === needle &&
    // An SSO identity may share the address and has no password to set; an
    // anonymous one has no address at all.
    user.is_sso_user !== true &&
    user.is_anonymous !== true
  );
}

/**
 * Finds the Supabase Auth user registered under exactly this address.
 *
 * supabase-js's `auth.admin.listUsers` takes only a page and a page size, so
 * matching an address through it means walking the whole user list. GoTrue's
 * own `GET /admin/users` also takes `filter`, which it applies as
 * `email LIKE %filter% OR full_name ILIKE %filter%` - the endpoint the
 * Supabase dashboard's search box uses. That is a SUBSTRING match, and `_` in
 * an address is a LIKE wildcard, so every row is re-checked here for exact,
 * case-insensitive equality before it counts.
 *
 * Headers are the ones supabase-js itself sends to the auth API with this key
 * (`apikey` and a bearer), so the call authenticates exactly as
 * `updateUserById` does. Never throws. PII rule: nothing about the address or
 * the id is logged.
 */
export async function findSupabaseIdentityByEmail(
  email: string,
): Promise<IdentityLookup> {
  const needle = email.trim().toLowerCase();
  if (!needle.includes("@")) return { status: "none" };
  const key = serviceRoleKey();
  if (!key) return { status: "skipped" };

  const matches: AdminUserRow[] = [];
  try {
    for (let page = 1; page <= LOOKUP_MAX_PAGES; page++) {
      const query = new URLSearchParams({
        page: String(page),
        per_page: String(LOOKUP_PAGE_SIZE),
        filter: needle,
      });
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?${query}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`[supabase] identity lookup failed: HTTP ${res.status}`);
        return { status: "failed" };
      }
      const body: unknown = await res.json();
      const users =
        body &&
        typeof body === "object" &&
        Array.isArray((body as { users?: unknown }).users)
          ? (body as { users: AdminUserRow[] }).users
          : null;
      if (!users) {
        console.error("[supabase] identity lookup failed: unexpected response");
        return { status: "failed" };
      }
      for (const user of users) {
        if (isExactPasswordIdentity(user, needle)) matches.push(user);
      }
      if (users.length < LOOKUP_PAGE_SIZE) break;
      if (page === LOOKUP_MAX_PAGES) {
        // Five full pages of partial matches: the exact one may be on a page
        // we did not read, so "none" would be a claim we cannot back.
        console.error("[supabase] identity lookup failed: too many partial matches");
        return { status: "failed" };
      }
    }
  } catch (err) {
    console.error(
      `[supabase] identity lookup threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { status: "failed" };
  }

  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) {
    console.error("[supabase] identity lookup ambiguous: more than one identity for one address");
    return { status: "ambiguous" };
  }
  const [match] = matches;
  const id = typeof match.id === "string" ? match.id.trim() : "";
  if (!id) {
    console.error("[supabase] identity lookup failed: identity without an id");
    return { status: "failed" };
  }
  return {
    status: "found",
    id,
    confirmed:
      typeof match.email_confirmed_at === "string" &&
      match.email_confirmed_at.trim() !== "",
  };
}
