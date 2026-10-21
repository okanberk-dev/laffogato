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
 *     `updateSupabasePassword`, `findSupabaseIdentityByEmail`,
 *     `keepSupabaseAwake`) touch the auth admin API and nothing in the data
 *     schema - member records, orders and money stay in this project's own
 *     Postgres (docs/API-MOBILE.md §0).
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
 *
 * The keep-alive is the one export not about a member, and it is here because
 * the key may be read nowhere else. A free-plan Supabase project pauses after
 * 7 days without database activity, and a paused project refuses every
 * sign-in, the app's and the site's. The daily cron asks the auth admin API
 * for one page of one user and throws the answer away unread: read-only, no
 * member data kept or logged. On Supabase Pro it is not needed.
 *
 * Which key (20 Oct 2026). Supabase replaces the legacy `service_role` JWT
 * with secret keys (`sb_secret_...`) and deprecates the legacy keys by the
 * end of 2026 (https://supabase.com/docs/guides/api/api-keys). Both grant
 * the same service role. `SUPABASE_SECRET_KEY` is read first; the legacy
 * `SUPABASE_SERVICE_ROLE_KEY` only when the new one is unset, empty or
 * blank. A secret key is not a JWT, so the direct calls below send it on
 * `apikey` only (`adminHeaders`); supabase-js handles its own calls with
 * either key (docs/AUTH-BRIDGE.md §1, which records what was verified).
 */

declare global {
  var __laffogatoSupabaseAdmin:
    | { key: string; client: SupabaseClient }
    | undefined;
}

/** The skip logs' reason: no key under either name. */
export const NO_SECRET_KEY =
  "neither SUPABASE_SECRET_KEY nor SUPABASE_SERVICE_ROLE_KEY is set";

/**
 * What a key may hold: printable ASCII without spaces, as every Supabase key
 * (a JWT, an `sb_...` key) does. A value pasted across two lines, or with a
 * control character inside, cannot travel in a header: undici refuses it with
 * an error that repeats the whole value, and supabase-js hands that message
 * back as `error.message`.
 */
const KEY_SHAPE = /^[\x21-\x7E]+$/;

/** Variables already reported as unusable, so each is said once. */
const unusableReported = new Set<string>();

/** One variable's key, trimmed; "" when unset, blank or unusable. */
function keyFrom(
  name: "SUPABASE_SECRET_KEY" | "SUPABASE_SERVICE_ROLE_KEY",
): string {
  const value = (process.env[name] ?? "").trim();
  if (!value || KEY_SHAPE.test(value)) return value;
  if (!unusableReported.has(name)) {
    unusableReported.add(name);
    // The name and the reason, never the value.
    console.warn(
      `[supabase] ${name} ignored: it holds a line break, a space or a control character no key can have`,
    );
  }
  return "";
}

/**
 * The service key this deployment holds, or "" for none: the new secret key
 * first, the legacy service-role JWT when the new one is absent (or
 * unusable, which counts as absent: it could never authenticate). The value
 * never leaves this module.
 */
function serviceKey(): string {
  return keyFrom("SUPABASE_SECRET_KEY") || keyFrom("SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * What a failure may say in a log: its class and, for an API answer, the
 * HTTP status. Never its message: a fetch or SDK error can carry the request
 * headers' values, the key among them.
 */
function failureTag(err: unknown): string {
  if (!err || typeof err !== "object") return "error";
  const e = err as { name?: unknown; status?: unknown };
  const name =
    typeof e.name === "string" && /^[A-Za-z]{1,40}$/.test(e.name)
      ? e.name
      : "Error";
  const status =
    typeof e.status === "number" && Number.isInteger(e.status)
      ? ` HTTP ${e.status}`
      : "";
  return `${name}${status}`;
}

/**
 * Supabase's new key formats, the same test supabase-js applies
 * (`isNewApiKey`, @supabase/supabase-js 2.117.1 src/lib/fetch.ts). Neither is
 * a JWT.
 */
function isOpaqueKey(key: string): boolean {
  return key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
}

/**
 * Headers for a direct call to the auth admin API.
 *
 * A secret key travels on `apikey` and nowhere else: "Send publishable and
 * secret keys on the apikey header, not on Authorization: Bearer"
 * (https://supabase.com/docs/guides/api/api-keys), "pass in the user's JWT,
 * or leave the header empty" (Supabase's API key announcement,
 * github.com/orgs/supabase/discussions/29260). The gateway gives such a
 * request the service role. The legacy key IS a JWT and keeps the bearer
 * GoTrue reads its role from, exactly the pair supabase-js sends with it.
 */
function adminHeaders(key: string): Record<string, string> {
  return isOpaqueKey(key)
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

/**
 * Whether this deployment holds a service key, the new secret key or the
 * legacy service-role JWT. Presence only: the value never leaves this module,
 * and nothing that calls this can learn more than the one bit.
 *
 * It exists because a missing key used to be invisible. Every job below
 * answers `skipped` without it and the site carries on, which is correct, but
 * the operator had no way to tell that from "working" short of reading the
 * Vercel dashboard - and the connector that audits this project cannot read
 * environment variables. The settings page shows this bit, and the skips are
 * now logged with their reason.
 */
export function hasServiceRole(): boolean {
  return serviceKey() !== "";
}

/**
 * One client per key. supabase-js 2.117.1 takes either format: it sends the
 * key as `apikey` and as the auth client's bearer, which Supabase accepts for
 * a new key only because the two values match exactly (the announcement's
 * backward-compatibility rule). No session is kept or refreshed: this client
 * never signs anyone in, it only carries the key (Supabase's server-side
 * admin example sets the same two options; detectSessionInUrl has no URL to
 * read on a server).
 */
function getSupabaseAdminClient(): SupabaseClient | null {
  const key = serviceKey();
  if (!key) return null;
  const cached = global.__laffogatoSupabaseAdmin;
  if (cached?.key === key) return cached.client;
  const client = createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  global.__laffogatoSupabaseAdmin = { key, client };
  return client;
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
 * How long a closure waits for Supabase to delete the identity. supabase-js
 * sets no limit, and this is the last step of `deleteMe`: a Supabase that
 * took the connection and never answered held an already anonymised closure
 * until the platform killed the function (DELETE /me allows 15 s, the
 * panel's customer page 30 s), so the caller never got to report it.
 */
export const IDENTITY_DELETE_TIMEOUT_MS = 4_000;

/**
 * Deletes a Supabase Auth user. Never throws: account closure has already
 * happened in our own database by the time this runs, and it must not be
 * undone by an auth-service outage. No answer within
 * {@link IDENTITY_DELETE_TIMEOUT_MS} is `failed`: the closed row keeps
 * `supabaseUserId`, so the identity still cannot open a membership.
 */
export async function deleteSupabaseIdentity(
  userId: string,
): Promise<IdentityDeletion> {
  if (!userId.trim()) return "skipped";
  const admin = getSupabaseAdminClient();
  if (!admin) return "skipped";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answer = await Promise.race([
      admin.auth.admin.deleteUser(userId),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), IDENTITY_DELETE_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    if (answer === "timeout") {
      console.error(
        `[supabase] identity delete timed out after ${IDENTITY_DELETE_TIMEOUT_MS} ms`,
      );
      return "failed";
    }
    if (answer.error) {
      // PII rule: neither the id nor the address; key rule: not the message.
      console.error(
        `[supabase] identity delete failed: ${failureTag(answer.error)}`,
      );
      return "failed";
    }
    return "deleted";
  } catch (err) {
    console.error(`[supabase] identity delete threw: ${failureTag(err)}`);
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
      `[supabase] password sync skipped: ${NO_SECRET_KEY}, the previous password still opens the app`,
    );
    return "skipped";
  }
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) {
      // PII rule: neither the id, the address nor the password; key rule:
      // not the message.
      console.error(`[supabase] password sync failed: ${failureTag(error)}`);
      return "failed";
    }
    return "updated";
  } catch (err) {
    console.error(`[supabase] password sync threw: ${failureTag(err)}`);
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
 * Headers: `adminHeaders`, the service key on `apikey`, plus the bearer only
 * for the legacy JWT key. Never throws. PII rule: nothing about the address or
 * the id is logged, nor the key.
 */
export async function findSupabaseIdentityByEmail(
  email: string,
): Promise<IdentityLookup> {
  const needle = email.trim().toLowerCase();
  if (!needle.includes("@")) return { status: "none" };
  const key = serviceKey();
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
        headers: adminHeaders(key),
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
    console.error(`[supabase] identity lookup threw: ${failureTag(err)}`);
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

/**
 * What the daily keep-alive ping got. `skipped` is the same supported
 * configuration as everywhere in this file (no key); `failed` is Supabase not
 * answering within {@link KEEPALIVE_TIMEOUT_MS}, or answering with an error.
 */
export type SupabaseKeepalive = "ok" | "failed" | "skipped";

/** A healthy answer takes well under a second; the cron has more jobs to run. */
export const KEEPALIVE_TIMEOUT_MS = 5_000;

/**
 * Touches the Supabase project's Postgres once, so a free-plan project never
 * pauses for inactivity (Supabase pauses one after 7 days without database
 * activity; Pro does not).
 *
 * Why this call: it has to reach the database, and `/auth/v1/health` does
 * not. No table of ours is guaranteed to exist in Supabase (our data lives in
 * our own Postgres, docs/API-MOBILE.md §0), so a PostgREST `select` has
 * nothing safe to read. GoTrue's admin user list is a `select` on
 * `auth.users`, read-only, the same endpoint and headers
 * `findSupabaseIdentityByEmail` already uses, and needs no new dependency.
 * One user per page, and that user's record is never read. The cron records
 * the outcome in our own Postgres (src/lib/admin/supabase-keepalive.ts), so
 * a key Supabase stops accepting turns the owner's dashboard line amber.
 *
 * Never throws: it runs inside the daily cron beside jobs it must not take
 * down. Logs the HTTP status or the error's class only, never its message
 * (it can repeat the key), the key, the response body or anything about a
 * member.
 */
export async function keepSupabaseAwake(): Promise<SupabaseKeepalive> {
  const key = serviceKey();
  if (!key) {
    console.warn(
      `[supabase] keep-alive skipped: ${NO_SECRET_KEY}, a free-plan project pauses after 7 quiet days`,
    );
    return "skipped";
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`,
      {
        headers: adminHeaders(key),
        cache: "no-store",
        signal: AbortSignal.timeout(KEEPALIVE_TIMEOUT_MS),
      },
    );
    // The status is the whole answer; the body is one member's record.
    void res.body?.cancel().catch(() => {});
    if (!res.ok) {
      console.error(`[supabase] keep-alive failed: HTTP ${res.status}`);
      return "failed";
    }
    return "ok";
  } catch (err) {
    console.error(`[supabase] keep-alive threw: ${failureTag(err)}`);
    return "failed";
  }
}
