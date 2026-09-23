import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";

/**
 * The service-role client — two jobs, both about a credential the member has
 * asked us to destroy: deleting the sign-in identity of a member who closed
 * their account (`DELETE /me`, docs/hukuk/hesap-silme), and retiring the old
 * password when they reset it (`resetPasswordWithToken`).
 *
 * The key bypasses every Supabase policy, so it is deliberately walled off
 * here instead of being handed to a general-purpose client:
 *   - `server-only`, and read from `process.env` with NO `NEXT_PUBLIC_`
 *     prefix, so it can never reach a browser or the app bundle;
 *   - the only export that uses it is `deleteSupabaseIdentity`, which touches
 *     `auth.admin` and nothing in the data schema — member records, orders and
 *     money stay in this project's own Postgres (docs/API-MOBILE.md §0);
 *   - optional: without the variable the site behaves exactly as before, and
 *     the caller falls back to marking the identity closed instead.
 *
 * Do not widen this file. If something else ever needs elevated access, it
 * needs its own justification and its own review. The justification for the
 * second job: site and app share one identity (docs/AUTH-BRIDGE.md), and a
 * reset that changes only this project's bcrypt hash leaves the OLD password
 * opening the app. Whoever the member is resetting against would still be in.
 * Changing another user's password is `auth.admin` work by definition — the
 * member is not signed in at the time, that is the whole situation.
 */

declare global {
  var __laffogatoSupabaseAdmin: SupabaseClient | undefined;
}

function serviceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
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
 * make sure it can no longer open a membership here — see the closed-row check
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
 * failure is loud in the log because it leaves a live old credential — the
 * operator's move is to have them reset again once auth is reachable.
 *
 * `skipped` covers both a deployment with no service-role key and a member
 * who has no Supabase identity to update; neither is an error.
 */
export type PasswordSync = "updated" | "skipped" | "failed";

export async function updateSupabasePassword(
  userId: string,
  password: string,
): Promise<PasswordSync> {
  if (!userId.trim() || !password) return "skipped";
  const admin = getSupabaseAdminClient();
  if (!admin) return "skipped";
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
