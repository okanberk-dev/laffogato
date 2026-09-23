import "server-only";

import type { DbError } from "@/lib/db";

import {
  customerOrdersByEmail,
  expireStalePendingOrders,
  getMenuItem,
  getSettings,
  type AdminOrderStatus,
} from "@/lib/admin/store";
import { appendConsentChanges } from "@/lib/customer/consent-ledger";
import {
  getCustomerByEmail,
  updateCustomerProfile,
  updateNotificationPrefs,
  usualColumnValue,
  type CustomerUsual,
  type NotificationPrefs,
  type PublicCustomer,
} from "@/lib/customer/store";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import {
  subscribeNewsletter,
  unsubscribeNewsletterByEmail,
} from "@/lib/newsletter/store";
import {
  deleteSupabaseIdentity,
  type IdentityDeletion,
} from "@/lib/supabase/admin";

import { getInviteSummary } from "./invite";
import { getLoyalty } from "./loyalty";
import { istanbulClock } from "./venue";
import { toMe, type MeResponse } from "./me-mapper";
import { listMilestoneGrants } from "./milestones";
import { milestoneRoadmap, perksByTier } from "./milestones-core";

/**
 * `/me` behind the route handlers (docs/API-MOBILE.md §4): assembling the
 * response, applying a PATCH, and the account-deletion anonymisation the app
 * stores require.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** The full `/me` body for an authenticated member. */
export async function buildMe(customer: PublicCustomer): Promise<MeResponse> {
  const [loyalty, invite, grants, settings] = await Promise.all([
    getLoyalty(customer.email),
    getInviteSummary(customer),
    // The road map is an addition to /me, never a reason for it to fail: if
    // the milestone table cannot be read (a deploy ahead of its migration),
    // the road is left out and the rest of the member's page still loads.
    listMilestoneGrants(customer.email).catch((err: unknown) => {
      console.error("[me] milestone grants unavailable", err);
      return null;
    }),
    getSettings(),
  ]);
  return toMe(
    customer,
    {
      ...loyalty,
      // Karar 175: the road map of milestone gifts, and each tier's perks -
      // only those the server applies.
      ...(grants ? { milestones: milestoneRoadmap(loyalty.lifetimeStamps, grants) } : {}),
      perksByTier: perksByTier(settings.mobileApp.karaoke.oroDiscountPct),
    },
    invite,
  );
}

export interface MePatch {
  name?: string;
  phone?: string;
  birthday?: string;
  notificationPrefs?: Partial<NotificationPrefs>;
  /** `null` clears the usual; `undefined` leaves it alone. */
  usual?: CustomerUsual | null;
}

export type UpdateMeResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: "unknown_menu_item" | "not_found" };

/**
 * The caller's IP for the newsletter consent record: the one the route hands
 * over, else the request headers (this runs inside a route handler), else "".
 */
async function consentIp(given?: string): Promise<string> {
  if (given !== undefined) return given;
  try {
    const { clientIp } = await import("@/lib/admin/rate-limit");
    return await clientIp();
  } catch {
    return "";
  }
}

/**
 * Applies a `PATCH /me`. Profile fields go through the same store functions
 * the site's account page uses, so length limits and the KVKK consent
 * timestamp behave identically on both surfaces. A usual that points at a
 * menu item that no longer exists (or is inactive) is refused rather than
 * stored - it would fail at order time anyway.
 *
 * The `newsletter` toggle also lands on the bulletin list, exactly as the
 * site's account page does (`uye/actions.ts`): the app used to write only
 * the jsonb flag, so an app subscriber had no row there and therefore no
 * unsubscribe token - and campaign mail could not lawfully reach them.
 */
export async function updateMe(
  customer: PublicCustomer,
  patch: MePatch,
  ctx: { ip?: string } = {},
): Promise<UpdateMeResult> {
  const email = customer.email;

  if (
    patch.name !== undefined ||
    patch.phone !== undefined ||
    patch.birthday !== undefined
  ) {
    const updated = await updateCustomerProfile(email, {
      name: patch.name ?? customer.name,
      phone: patch.phone ?? customer.phone,
      birthday: patch.birthday ?? customer.birthday,
    });
    if (!updated) return { ok: false, error: "not_found" };
  }

  if (patch.notificationPrefs) {
    const updated = await updateNotificationPrefs(
      email,
      {
        ...customer.notificationPrefs,
        ...patch.notificationPrefs,
      },
      { source: "app-account", ip: await consentIp(ctx.ip) },
    );
    if (!updated) return { ok: false, error: "not_found" };

    // Best-effort, like the site: the preference itself is already saved.
    const wantsNewsletter = patch.notificationPrefs.newsletter;
    try {
      if (wantsNewsletter === true) {
        // App members are Supabase-confirmed (auth refuses an unconfirmed
        // existing address), so this is normally a subscription on the spot;
        // an unverified row is stored pending like the website's.
        await subscribeNewsletter(
          email,
          patch.name ?? customer.name,
          "account",
          { at: new Date().toISOString(), ip: await consentIp(ctx.ip) },
          { confirmed: customer.emailVerified },
        );
      } else if (wantsNewsletter === false) {
        await unsubscribeNewsletterByEmail(email);
      }
    } catch (err) {
      console.error("[updateMe] bülten listesi güncellenemedi", err);
    }
  }

  if (patch.usual !== undefined) {
    if (patch.usual !== null) {
      const item = await getMenuItem(patch.usual.menuItemId);
      if (!item || !item.isActive) {
        return { ok: false, error: "unknown_menu_item" };
      }
    }
    const { error } = await getDb()
      .from(TABLES.customers)
      .update({
        usual: usualColumnValue(patch.usual),
        updatedAt: new Date().toISOString(),
      })
      .eq("email", email);
    checkErr(error, "updateMe.usual");
  }

  const fresh = await getCustomerByEmail(email);
  return fresh
    ? { ok: true, customer: fresh }
    : { ok: false, error: "not_found" };
}

/** Where an anonymised member's row points after `DELETE /me`. */
export function anonymizedEmail(customerId: string): string {
  return `deleted-${customerId}@anon.local`;
}

/**
 * Statuses that mean the member still has something running with us.
 *
 * Üyelik Sözleşmesi §14 promises that a closure request lands *after* an
 * order in flight, an unfinished return or an open dispute is settled - so
 * the API refuses rather than anonymising the buyer of an order the kitchen
 * is about to hand over. `paid` is on the list with the other three: it is
 * "Sipariş alındı", the most in-flight an order gets.
 */
export const IN_PROGRESS_ORDER_STATUSES: readonly AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
];

/**
 * Every place a member's e-mail is stored outside their own row.
 *
 * Kept as data so the set itself can be tested: forgetting a table here is a
 * silent privacy leak, not a crash. `orders` is the one that matters most -
 * the row is retained for the books, but its address must be rewritten,
 * because `deleteMe` frees the e-mail for re-registration and `GET /orders`
 * is keyed on it.
 *
 * `op` says what the row deserves. A record that exists only to serve the
 * member - a newsletter subscription - has no reason to survive them and is
 * deleted outright; everything the books or the operator still need is kept
 * with the address rewritten to the placeholder.
 */
export const ANON_SWEEPS: ReadonlyArray<{
  table: string;
  column: string;
  caseInsensitive?: boolean;
  op?: "update" | "delete";
  patch: (anon: string) => Record<string, unknown>;
}> = [
  {
    table: TABLES.orders,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon }),
  },
  {
    table: TABLES.loyaltyStamps,
    column: "customerEmail",
    patch: (anon) => ({ customerEmail: anon }),
  },
  {
    table: TABLES.customerCoupons,
    column: "customerEmail",
    patch: (anon) => ({ customerEmail: anon, isActive: false }),
  },
  {
    table: TABLES.karaokeReservations,
    column: "customerEmail",
    patch: (anon) => ({ customerEmail: anon, customerName: "" }),
  },
  {
    table: TABLES.invites,
    column: "inviteeEmail",
    patch: (anon) => ({ inviteeEmail: anon }),
  },
  {
    table: TABLES.invites,
    column: "inviterEmail",
    patch: (anon) => ({ inviterEmail: anon }),
  },
  {
    // Every app order writes the buyer's e-mail as the actor of its stock
    // moves, so the admin's stock ledger kept naming a closed account.
    table: TABLES.stockMoves,
    column: "actor",
    caseInsensitive: true,
    patch: (anon) => ({ actor: anon }),
  },
  {
    // The bulletin list is not a book entry: it holds the address, the name
    // and the consent evidence for messages that will never be sent again.
    // Anonymising it would leave a subscription nobody owns; the row goes.
    // The withdrawal itself is recorded on the member row (marketingConsentAt
    // cleared, every notification pref off).
    table: TABLES.newsletterSubscribers,
    column: "email",
    caseInsensitive: true,
    op: "delete",
    patch: () => ({}),
  },
  {
    // The till QR tokens kept the address until some later till scan
    // happened to run `purgeStale` - and an unexpired one could still be
    // redeemed for the closed account. Anonymised like the rest, and expired
    // on the spot: the till reads `expiresAt <= now` as expired, and the next
    // purge removes the row (`expiresAt < cutoff`).
    table: TABLES.counterTokens,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon, expiresAt: "" }),
  },
  {
    // Milestone gifts (karar 175) are keyed on the address, and `/me` and the
    // inbox read them back by it. Left alone, whoever next registered the
    // address was told "10 kahve oldu! ... kuponlarına eklendi" about a coupon
    // that went to the closed account (and was deactivated with it). The
    // placeholder is unique per customer, so the (member, milestone) key
    // cannot collide.
    table: TABLES.customerMilestoneRewards,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon }),
  },
  {
    // "Bu yorumu bildir" reports: the reported words stay for the operator's
    // review until the ninety-day sweep, but no longer point at the address.
    table: TABLES.falReports,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon }),
  },
  {
    // fA'L's R12 consent (karar 177) is read back by the address. Left alone,
    // whoever next registered it would be treated as having agreed to send
    // their photo abroad - a consent somebody else gave. Closing the account
    // is also a withdrawal: `revokedAt` starts the three years the proof is
    // kept for (Veri Saklama ve İmha Politikası), under the placeholder.
    table: TABLES.featureConsents,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon, revokedAt: new Date().toISOString() }),
  },
  {
    // fA'L's usage record: the next owner of the address must not inherit
    // today's count against the daily limit.
    table: TABLES.falReadings,
    column: "customerEmail",
    caseInsensitive: true,
    patch: (anon) => ({ customerEmail: anon }),
  },
];

/**
 * A booking the member will not come to. Anonymising it alone left the room
 * held on the karaoke board for a nameless, uncontactable guest, so the future
 * ones are cancelled first - while the rows still carry the real address.
 */
async function cancelFutureKaraoke(email: string, now: Date): Promise<void> {
  // Today at the venue. `toISOString()` is UTC, so from 00:00 to 03:00 in
  // Tuzla this also cancelled yesterday's bookings - nights already sung.
  const today = istanbulClock(now).date;
  const { error } = await getDb()
    .from(TABLES.karaokeReservations)
    .update({ status: "cancelled", updatedAt: now.toISOString() })
    .eq("customerEmail", email.trim().toLowerCase())
    .gte("date", today)
    .neq("status", "cancelled");
  if (error)
    console.error(`[deleteMe] karaoke cancel failed: ${error.message}`);
}

/** `%` and `_` are LIKE wildcards; an address may legitimately contain both. */
function likeLiteral(raw: string): string {
  return raw.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * The failed-login counters keyed on this address.
 *
 * `bucketKey` in `@/lib/admin/rate-limit` is `purpose::ip::email`, so the row
 * carries the member's address AND the IP they were last seen from. It is a
 * throttle, not evidence: a closed account has nothing left to throttle, and
 * the address is about to belong to somebody else.
 */
async function purgeAuthAttempts(email: string): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.authAttempts)
    .delete()
    .ilike("key", `%::${likeLiteral(email.trim().toLowerCase())}`);
  if (error)
    console.error(`[deleteMe] auth attempt purge failed: ${error.message}`);
}

/** Redacted payloads keep the shape a jsonb column expects. */
export function redactedPayload(at: string): Record<string, unknown> {
  return { redacted: true, redactedAt: at };
}

/**
 * The provider's own callback bodies for this member's orders.
 *
 * `payment_transactions.raw` is whatever the POS posted - buyer name, address,
 * masked card, IP - stored verbatim for the audit trail and never read back by
 * this codebase. The fiscal record is the order and its invoice; the
 * reconciliation record is `provider`, `providerRef`, `status` and
 * `amountMinor`, all of which stay. The payload itself has no reason to
 * outlive the account, so it is emptied.
 */
async function redactPaymentPayloads(
  orderIds: readonly string[],
  at: string,
): Promise<void> {
  const db = getDb();
  // `in` lists go into one statement; chunked so a long history cannot build a
  // query with thousands of bind parameters.
  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100);
    const { error } = await db
      .from(TABLES.paymentTransactions)
      .update({ raw: redactedPayload(at) })
      .in("orderId", chunk);
    if (error)
      console.error(`[deleteMe] payment redaction failed: ${error.message}`);
  }
}

/** The Supabase user this row is linked to, or "" when it never was. */
async function linkedIdentityId(email: string): Promise<string> {
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("supabaseUserId")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error(`[deleteMe] identity lookup failed: ${error.message}`);
    return "";
  }
  return ((data as { supabaseUserId?: string } | null)?.supabaseUserId ?? "")
    .toString()
    .trim();
}

export type DeleteMeResult =
  | { ok: true; identity: IdentityDeletion }
  | { ok: false; error: "orders_in_progress"; count: number };

/**
 * `DELETE /me`: the member row stays (orders reference it, and invoices must
 * be kept for the statutory period) but every personal field is blanked and
 * the account is closed. The e-mail is replaced with a unique placeholder so
 * the address can register again later; the invite code is released.
 *
 * Refused, not queued, while an order is in flight - Üyelik Sözleşmesi §14 and
 * the `hesap-silme` document both say the closure waits for it, and the member
 * would otherwise lose sight of an order they have already paid for.
 *
 * The sign-in identity goes too: `deleteSupabaseIdentity` removes the Supabase
 * user when the deployment holds a service-role key, so the old password stops
 * working and a genuinely new sign-up gets a genuinely new account. Where the
 * key is absent the identity survives, and `supabaseUserId` is deliberately
 * LEFT on the closed row - `ensureCustomerForSupabaseUser` reads it as "this
 * identity belonged to a closed account" and refuses, instead of opening a
 * fresh membership (welcome coupon included) for whoever still knows the
 * password.
 */
export async function deleteMe(
  customer: PublicCustomer,
): Promise<DeleteMeResult> {
  const at = new Date();
  const now = at.toISOString();

  // Reclaim the member's own abandoned checkouts before counting them: a
  // pending_payment row nobody swept would otherwise block the closure
  // for good.
  try {
    await expireStalePendingOrders();
  } catch (err) {
    console.error("[deleteMe] expiring stale pending orders failed", err);
  }
  const orders = await customerOrdersByEmail(customer.email);
  const inProgress = orders.filter((o) =>
    IN_PROGRESS_ORDER_STATUSES.includes(o.status),
  );
  if (inProgress.length > 0) {
    return {
      ok: false,
      error: "orders_in_progress",
      count: inProgress.length,
    };
  }

  const identityId = await linkedIdentityId(customer.email);
  await cancelFutureKaraoke(customer.email, at);
  const { error } = await getDb()
    .from(TABLES.customers)
    .update({
      email: anonymizedEmail(customer.id),
      name: "",
      phone: "",
      birthday: "",
      addresses: [],
      wishlist: [],
      notificationPrefs: {
        orderUpdates: false,
        marketing: false,
        newsletter: false,
      },
      marketingConsentAt: "",
      // The campaign-mail unsubscribe link must not outlive the account.
      unsubToken: "",
      passwordHash: "",
      verifyToken: "",
      verifyExpires: "",
      resetToken: "",
      resetExpires: "",
      // supabaseUserId is NOT cleared - see the note above: it is the record
      // that this identity belongs to a closed account.
      // The saved-card key points at cards held by the provider. A closed
      // account keeps none of it, and re-registering the address must not
      // hand the next person the previous member's cards.
      cardUserKey: "",
      inviteCode: "",
      invitedBy: "",
      usual: usualColumnValue(null),
      isActive: false,
      updatedAt: now,
    })
    .eq("email", customer.email);
  checkErr(error, "deleteMe");

  // "Pazarlama izni geri alınmış sayılır" (hesap-silme §5): the withdrawal
  // goes into the consent history under the address it was given for. That
  // history is one of the records the same document keeps after closure
  // ("elektronik ileti onay kayıtları"), for the published three years.
  await appendConsentChanges(
    customer.email,
    customer.notificationPrefs,
    { marketing: false, newsletter: false },
    { source: "account-deletion", now: at },
  );

  // The same address sits in the loyalty ledger, the invite graph, the
  // karaoke book, the coupon table - and on every order.
  //
  // Orders are KEPT (fiscal retention) but their address is rewritten to the
  // same placeholder. Leaving the live address on them was a leak, not a
  // retention policy: `deleteMe` frees the e-mail for re-registration and
  // `listAppOrders` keys on it, so whoever next signed up with that address
  // was handed the deleted member's order history, delivery addresses
  // included. The placeholder is unique per customer id, so the operator can
  // still group a closed member's orders for the books.
  //
  // Best-effort per table: a failure here must not leave the account itself
  // un-anonymised.
  const anon = anonymizedEmail(customer.id);
  const db = getDb();
  const sweeps: Array<PromiseLike<{ error: DbError | null }>> = ANON_SWEEPS.map(
    (sweep) => {
      const q =
        sweep.op === "delete"
          ? db.from(sweep.table).delete()
          : db.from(sweep.table).update(sweep.patch(anon));
      // `ilike`, not `eq`, where the column is written with whatever case the
      // caller captured - `customerOrdersByEmail` reads orders that way too,
      // and an `eq` sweep would leave `Ayse@…` behind for `ayse@…` to inherit.
      return sweep.caseInsensitive
        ? q.ilike(sweep.column, likeLiteral(customer.email))
        : q.eq(sweep.column, customer.email);
    },
  );

  for (const sweep of sweeps) {
    const res = await sweep;
    if (res.error)
      console.error(`[deleteMe] sweep failed: ${res.error.message}`);
  }

  await purgeAuthAttempts(customer.email);
  await redactPaymentPayloads(
    orders.map((o) => o.id),
    now,
  );

  const identity = await deleteSupabaseIdentity(identityId);
  if (identity === "skipped") logIdentitySkip(identityId);
  return { ok: true, identity };
}

/**
 * Says out loud why a closed account's sign-in identity was left in place.
 *
 * `skipped` is a supported outcome (the closed row still refuses the identity,
 * see `ensureCustomerForSupabaseUser`), but it used to be silent - and a
 * deployment without the service-role key skips EVERY deletion, leaving the
 * e-mail and name in Supabase, with nothing on any screen or log to say so.
 * PII rule: neither the address nor the id is written, only the reason.
 */
function logIdentitySkip(identityId: string): void {
  // `deleteSupabaseIdentity` skips for exactly two reasons: no id to delete,
  // or no key to delete it with.
  const reason = identityId
    ? "SUPABASE_SERVICE_ROLE_KEY is not set, the identity stays in Supabase"
    : "the row was never linked to a Supabase identity";
  console.warn(`[deleteMe] identity skipped: ${reason}`);
}
