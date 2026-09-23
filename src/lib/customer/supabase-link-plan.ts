import type { Customer } from "./store";

/**
 * Pure decision logic for linking a Supabase Auth user to a `customers` row.
 *
 * No I/O here on purpose: `supabase-bridge.ts` fetches and writes, this file
 * decides — and the decision is what the unit tests pin down. The rule set is
 * docs/API-MOBILE.md §0 ("customers satırı e-postayla eşleşir; yoksa
 * oluşturulur") plus docs/AUTH-BRIDGE.md.
 */

/** The subset of a Supabase `User` the link needs. */
export interface SupabaseUserLike {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/** Same rule as `normalizeEmail` in `./store.ts`: trim + invariant lower-case. */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function metaString(
  meta: Record<string, unknown> | null | undefined,
  key: string,
  max: number,
): string {
  const v = meta?.[key];
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** `user_metadata.full_name` (the app's sign-up field), with `name` as fallback. */
export function displayNameOf(user: SupabaseUserLike): string {
  return (
    metaString(user.user_metadata, "full_name", 100) ||
    metaString(user.user_metadata, "name", 100)
  );
}

export function phoneOf(user: SupabaseUserLike): string {
  return metaString(user.user_metadata, "phone", 30);
}

/** An ISO-8601 instant, or "" when the metadata holds anything else. */
function metaInstant(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const raw = metaString(meta, key, 40);
  if (!raw) return "";
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

/**
 * When the member ticked the membership-agreement / KVKK box at sign-up.
 *
 * The app writes `terms_accepted_at` into the Supabase user's metadata as it
 * creates the account. If it is absent the field stays empty: an unproven
 * consent is worse than a missing one, because the row would then claim an
 * agreement nobody can show. `verifiedAt`-style back-fill happens on the
 * site, where the member ticks the same box in the register form.
 */
export function termsAcceptedAtOf(user: SupabaseUserLike): string {
  return metaInstant(user.user_metadata, "terms_accepted_at");
}

/** Commercial-message opt-in (6563 sayılı Kanun); separate and optional. */
export function marketingConsentAtOf(user: SupabaseUserLike): string {
  return metaInstant(user.user_metadata, "marketing_consent_at");
}

/** A `customers` insert — `usual` is left off so the column default applies. */
export type CustomerInsertRow = Omit<Customer, "usual">;

export type LinkPlan =
  | { action: "create"; row: CustomerInsertRow; grantWelcome: boolean }
  | { action: "update"; patch: Partial<Customer>; grantWelcome: boolean }
  | { action: "none" }
  | { action: "disabled" }
  /** An existing member, but Supabase has not confirmed this address yet. */
  | { action: "unconfirmed" };

export function newCustomerId(now: Date = new Date()): string {
  return `cst-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decides what the database needs so that `user` and `existing` describe the
 * same member.
 *
 * - No row → create one. Password-less (`passwordHash: ""`): the site signs
 *   such a member in through Supabase, never through bcrypt. Consent is
 *   copied from the token's metadata — what the member actually ticked —
 *   rather than assumed from the fact that an account is being created.
 * - Row exists but deactivated → `disabled`; nothing is written.
 * - Row exists → record the Supabase id when missing, and promote the
 *   verification flag when Supabase has confirmed the address (that is the
 *   same proof the site's own link tests). Empty name / phone are filled from
 *   the token's metadata; a name the member typed on the site is never
 *   overwritten.
 *
 * `grantWelcome` is true whenever this plan is the moment the address becomes
 * verified — the site grants its welcome coupon at verification, and the
 * bridge mirrors that (idempotently) rather than inventing a second rule.
 *
 * `identityRevoked` says the Supabase user signing in is the one a closed
 * account was linked to; nothing is written and nothing is granted.
 */
export function planCustomerLink(
  existing: Customer | null,
  user: SupabaseUserLike,
  now: string,
  id: string = newCustomerId(),
  identityRevoked = false,
): LinkPlan {
  const email = normalizeEmail(user.email);
  const confirmed = !!user.email_confirmed_at;

  // This identity belonged to an account the member closed. `DELETE /me`
  // frees the e-mail, so the row no longer matches on address and the branch
  // below would happily open a NEW membership — welcome coupon included — for
  // whoever still holds the old password. Deletion of the Supabase user is
  // best-effort (it needs a service-role key); the closed row is the record
  // that survives either way.
  if (identityRevoked) return { action: "disabled" };

  if (!existing) {
    const marketingConsentAt = marketingConsentAtOf(user);
    return {
      action: "create",
      grantWelcome: confirmed,
      row: {
        id,
        email,
        name: displayNameOf(user),
        phone: phoneOf(user),
        passwordHash: "",
        birthday: "",
        addresses: [],
        wishlist: [],
        notificationPrefs: {
          orderUpdates: true,
          marketing: !!marketingConsentAt,
          newsletter: false,
        },
        emailVerified: confirmed,
        verifyToken: "",
        verifyExpires: "",
        verifiedAt: confirmed ? now : "",
        resetToken: "",
        resetExpires: "",
        isActive: true,
        termsAcceptedAt: termsAcceptedAtOf(user),
        marketingConsentAt,
        supabaseUserId: user.id,
        // Born in Supabase: there is no site password to be newer than the
        // identity, and the row's empty hash agrees with that.
        passwordMirroredAt: "",
        supabaseLinkAttemptedAt: now,
        inviteCode: "",
        invitedBy: "",
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  if (existing.isActive === false) return { action: "disabled" };

  // Defence in depth against the dashboard's "Confirm email" switch: a
  // Supabase user who has not proven the address must not be handed the
  // orders, addresses and coupons of the member who registered it here.
  // A fresh row (above) is theirs to create; an existing one is not —
  // unless it is already bound to this very identity. That is the row they
  // created themselves a request ago: refusing it locked every unconfirmed
  // newcomer out of their own account from the second request on. Nothing
  // is verified for them here (`confirmed` stays false below), so orders
  // and the welcome coupon still wait for the address.
  const ownRow = !!user.id && (existing.supabaseUserId ?? "") === user.id;
  if (!confirmed && !ownRow) return { action: "unconfirmed" };

  const patch: Partial<Customer> = {};
  if ((existing.supabaseUserId ?? "") !== user.id) {
    patch.supabaseUserId = user.id;
    patch.supabaseLinkAttemptedAt = now;
  }
  let grantWelcome = false;
  if (confirmed && !existing.emailVerified) {
    patch.emailVerified = true;
    patch.verifiedAt = existing.verifiedAt || now;
    patch.verifyToken = "";
    patch.verifyExpires = "";
    grantWelcome = true;
  }
  if (!existing.name?.trim()) {
    const name = displayNameOf(user);
    if (name) patch.name = name;
  }
  if (!existing.phone?.trim()) {
    const phone = phoneOf(user);
    if (phone) patch.phone = phone;
  }

  if (Object.keys(patch).length === 0) return { action: "none" };
  patch.updatedAt = now;
  return { action: "update", patch, grantWelcome };
}

/**
 * Whether a legacy (bcrypt) member should get a one-time Supabase sign-up
 * attempt at login. Once is the whole point: a failed attempt is recorded and
 * never retried, so an address Supabase refuses does not cost a network call
 * on every sign-in.
 */
export function shouldAttemptSupabaseLink(
  customer: Pick<Customer, "supabaseUserId" | "supabaseLinkAttemptedAt">,
): boolean {
  return !customer.supabaseUserId && !customer.supabaseLinkAttemptedAt;
}

/**
 * The Supabase user id to record after `signUp`, or "" when there is none to
 * trust. With "Confirm email" on, Supabase answers a sign-up for an address
 * that already exists with an obfuscated user — a random id and an empty
 * `identities` list — so that the endpoint cannot be used to enumerate
 * members. Recording that id would tie the row to a user that does not exist.
 */
export function linkableUserId(
  user: { id: string; identities?: unknown[] | null } | null | undefined,
): string {
  if (!user?.id) return "";
  if (!Array.isArray(user.identities) || user.identities.length === 0) {
    return "";
  }
  return user.id;
}
