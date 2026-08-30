import "server-only";

import type { DbError } from "@/lib/db";

import { getMenuItem } from "@/lib/admin/store";
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

import { getInviteSummary } from "./invite";
import { getLoyalty } from "./loyalty";
import { toMe, type MeResponse } from "./me-mapper";

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
  const [loyalty, invite] = await Promise.all([
    getLoyalty(customer.email),
    getInviteSummary(customer),
  ]);
  return toMe(customer, loyalty, invite);
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
 * Applies a `PATCH /me`. Profile fields go through the same store functions
 * the site's account page uses, so length limits and the KVKK consent
 * timestamp behave identically on both surfaces. A usual that points at a
 * menu item that no longer exists (or is inactive) is refused rather than
 * stored — it would fail at order time anyway.
 */
export async function updateMe(
  customer: PublicCustomer,
  patch: MePatch,
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
    const updated = await updateNotificationPrefs(email, {
      ...customer.notificationPrefs,
      ...patch.notificationPrefs,
    });
    if (!updated) return { ok: false, error: "not_found" };
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
 * `DELETE /me`: the member row stays (orders reference it, and invoices must
 * be kept for the statutory period) but every personal field is blanked and
 * the account is closed. The e-mail is replaced with a unique placeholder so
 * the address can register again later; the invite code is released.
 *
 * The Supabase user is not deleted here — that needs a service-role key,
 * which the site does not hold (docs/API-MOBILE.md §0). The app signs the
 * session out; a later sign-in with the same address starts a fresh row.
 */
/**
 * Every place a member's e-mail is stored outside their own row.
 *
 * Kept as data so the set itself can be tested: forgetting a table here is a
 * silent privacy leak, not a crash. `orders` is the one that matters most —
 * the row is retained for the books, but its address must be rewritten,
 * because `deleteMe` frees the e-mail for re-registration and `GET /orders`
 * is keyed on it.
 */
export const ANON_SWEEPS: ReadonlyArray<{
  table: string;
  column: string;
  caseInsensitive?: boolean;
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
];

export async function deleteMe(customer: PublicCustomer): Promise<void> {
  const now = new Date().toISOString();
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
      passwordHash: "",
      verifyToken: "",
      verifyExpires: "",
      resetToken: "",
      resetExpires: "",
      supabaseUserId: "",
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

  // The same address sits in the loyalty ledger, the invite graph, the
  // karaoke book, the coupon table — and on every order.
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
      const q = db.from(sweep.table).update(sweep.patch(anon));
      // `ilike`, not `eq`, where the column is written with whatever case the
      // caller captured — `customerOrdersByEmail` reads orders that way too,
      // and an `eq` sweep would leave `Ayse@…` behind for `ayse@…` to inherit.
      return sweep.caseInsensitive
        ? q.ilike(
            sweep.column,
            customer.email.replace(/[%_]/g, (c) => `\\${c}`),
          )
        : q.eq(sweep.column, customer.email);
    },
  );

  for (const sweep of sweeps) {
    const res = await sweep;
    if (res.error)
      console.error(`[deleteMe] sweep failed: ${res.error.message}`);
  }
}
