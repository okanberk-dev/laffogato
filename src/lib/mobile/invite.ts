import "server-only";

import type { DbError } from "@/lib/db";

import { customerOrdersByEmail } from "@/lib/admin/store";
import type { Customer } from "@/lib/customer/store";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { grantFreeDrinkCoupon } from "./free-drink";
import {
  abbreviateName,
  inviteCodeCandidate,
  isInviteCodeShape,
  normalizeInviteCode,
} from "./invite-code";
import { isCountedOrder } from "./loyalty-core";
import type { InvitePerson, InviteSummary } from "./me-mapper";

/**
 * Referral programme (docs/API-MOBILE.md §5).
 *
 * `customers.inviteCode` is the member's shareable code; `customers.invitedBy`
 * is the inviter's e-mail once a code has been claimed. Each claim is one
 * `invites` row: `pending` until the invitee's first paid order, `rewarded`
 * once both sides have received their free-drink coupon.
 */

export interface InviteRow {
  id: string;
  code: string;
  inviterEmail: string;
  inviteeEmail: string;
  status: "pending" | "joined" | "rewarded";
  createdAt: string;
  rewardedAt: string;
  /** The coupon each side received, "" until granted (a retry skips it). */
  inviteeCouponId?: string;
  inviterCouponId?: string;
}

function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

type CustomerIdentity = Pick<
  Customer,
  "id" | "email" | "name" | "inviteCode" | "invitedBy"
>;

async function fetchIdentity(email: string): Promise<CustomerIdentity | null> {
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("id, email, name, inviteCode, invitedBy")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "invite.fetchIdentity");
  const row = data as Partial<CustomerIdentity> | null;
  if (!row || !row.id) return null;
  return {
    id: row.id,
    email: row.email ?? email,
    name: row.name ?? "",
    inviteCode: row.inviteCode ?? "",
    invitedBy: row.invitedBy ?? "",
  };
}

const MAX_CODE_ATTEMPTS = 25;

/**
 * Returns the member's invite code, generating and persisting one on first
 * use. The write is guarded on `inviteCode = ''` so two concurrent requests
 * cannot each assign a different code; a unique-index collision with another
 * member's code reseeds the digits and tries again.
 */
export async function ensureInviteCode(
  customer: Pick<Customer, "id" | "email" | "name" | "inviteCode">,
): Promise<string> {
  if (customer.inviteCode) return customer.inviteCode;
  const email = normalizeEmail(customer.email);
  const db = getDb();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = inviteCodeCandidate(customer.name, customer.id, attempt);
    const { data, error } = await db
      .from(TABLES.customers)
      .update({ inviteCode: code, updatedAt: new Date().toISOString() })
      .eq("email", email)
      .eq("inviteCode", "")
      .select("id");
    if (error) {
      if (error.code === "23505") continue; // taken by another member
      checkErr(error, "ensureInviteCode");
    }
    if (((data as { id: string }[] | null) ?? []).length > 0) return code;
    // Zero rows: a concurrent request assigned the code first - read it.
    const current = await fetchIdentity(email);
    if (current?.inviteCode) return current.inviteCode;
    if (!current) throw new Error("ensureInviteCode: customer row missing");
  }
  throw new Error("ensureInviteCode: could not find a free code");
}

async function listInvitesBy(inviterEmail: string): Promise<InviteRow[]> {
  const { data, error } = await getDb()
    .from(TABLES.invites)
    .select("*")
    .eq("inviterEmail", inviterEmail)
    .order("createdAt", { ascending: false });
  checkErr(error, "listInvitesBy");
  return (data as InviteRow[] | null) ?? [];
}

/** The `/me.invite` block: the member's code and who used it. */
export async function getInviteSummary(
  customer: Pick<Customer, "id" | "email" | "name" | "inviteCode">,
): Promise<InviteSummary> {
  const email = normalizeEmail(customer.email);
  const [code, invites] = await Promise.all([
    ensureInviteCode(customer),
    listInvitesBy(email),
  ]);

  const names = new Map<string, string>();
  if (invites.length > 0) {
    const { data, error } = await getDb()
      .from(TABLES.customers)
      .select("email, name")
      .in(
        "email",
        invites.map((i) => normalizeEmail(i.inviteeEmail)),
      );
    checkErr(error, "getInviteSummary.names");
    for (const row of (data as { email: string; name: string }[] | null) ??
      []) {
      names.set(normalizeEmail(row.email), row.name ?? "");
    }
  }

  // Only the first INVITE_REWARD_CAP settlements pay the inviter
  // (`rewardInviteOnFirstPaidOrder` counts the rewarded rows before granting),
  // and settlement order is `rewardedAt`. So the same ordering says here which
  // people actually earned this member a coffee - the rest were cap-dropped
  // and used to show "+1 kahve" for a coupon that never existed.
  const settled = invites
    .filter((i) => i.status === "rewarded")
    .sort((a, b) =>
      (a.rewardedAt || a.createdAt).localeCompare(b.rewardedAt || b.createdAt),
    )
    .slice(0, INVITE_REWARD_CAP)
    .map((i) => i.id);
  const paid = new Set(settled);

  const people: InvitePerson[] = invites.map((i) => ({
    name: abbreviateName(names.get(normalizeEmail(i.inviteeEmail)) ?? ""),
    status: i.status === "pending" ? "pending" : "joined",
    at: i.rewardedAt || i.createdAt,
    rewarded: paid.has(i.id),
  }));
  return {
    code,
    invited: invites.length,
    joined: invites.filter((i) => i.status !== "pending").length,
    earned: paid.size,
    people,
  };
}

export type ClaimInviteError =
  | "invalid_code"
  | "own_code"
  | "already_claimed"
  | "has_orders";

export type ClaimInviteResult =
  | { ok: true }
  | { ok: false; error: ClaimInviteError };

/**
 * `POST /invite/claim`: binds a member to the inviter whose code they typed.
 * Only an account with no order yet may claim, and only once; the unique
 * index on `invites."inviteeEmail"` enforces the "once" under concurrency.
 */
export async function claimInvite(
  email: string,
  rawCode: string,
): Promise<ClaimInviteResult> {
  const claimer = normalizeEmail(email);
  const code = normalizeInviteCode(rawCode);
  if (!claimer || !isInviteCodeShape(code)) {
    return { ok: false, error: "invalid_code" };
  }

  const db = getDb();
  const { data, error } = await db
    .from(TABLES.customers)
    .select("email")
    .eq("inviteCode", code)
    .maybeSingle();
  checkErr(error, "claimInvite.inviter");
  const inviter = normalizeEmail((data as { email?: string } | null)?.email);
  if (!inviter) return { ok: false, error: "invalid_code" };
  if (inviter === claimer) return { ok: false, error: "own_code" };

  const me = await fetchIdentity(claimer);
  if (!me) return { ok: false, error: "invalid_code" };
  if (me.invitedBy) return { ok: false, error: "already_claimed" };
  // A cancelled or still-unpaid checkout is not a first order: only a counted
  // one closes the window for claiming a code.
  if ((await customerOrdersByEmail(claimer)).some(isCountedOrder)) {
    return { ok: false, error: "has_orders" };
  }

  const seq = await nextSeq("inv");
  const row: InviteRow = {
    id: `inv-${String(seq).padStart(6, "0")}`,
    code,
    inviterEmail: inviter,
    inviteeEmail: claimer,
    status: "pending",
    createdAt: new Date().toISOString(),
    rewardedAt: "",
  };
  const ins = await db.from(TABLES.invites).insert(row);
  if (ins.error) {
    if (ins.error.code === "23505") {
      return { ok: false, error: "already_claimed" };
    }
    checkErr(ins.error, "claimInvite.insert");
  }

  const upd = await db
    .from(TABLES.customers)
    .update({ invitedBy: inviter, updatedAt: new Date().toISOString() })
    .eq("email", claimer);
  checkErr(upd.error, "claimInvite.link");
  return { ok: true };
}

/**
 * Settles the invitee's pending invite on their first paid order: one
 * free-drink coupon each for inviter and invitee. Called from `onOrderPaid`.
 *
 * The status flip is a guarded UPDATE (`pending` → `rewarded`), so a repeated
 * webhook - or two orders paid at the same moment - rewards exactly once.
 */
/**
 * A cafe order whose GOODS come to less than this does not settle an invite
 * (docs/REWARDS.md §2, docs/API-MOBILE.md §5). Goods only, never the courier
 * fee (operator, 14 Eki 2026, W1-05): a ₺100 latte with a ₺55 courier is a
 * ₺100 order, not a ₺155 one.
 */
export const INVITE_MIN_ORDER_MINOR = 15000;

/**
 * What the member paid for the goods: the total less the courier/shipping
 * fee. The discount is already out of `totalMinor`, so a coupon that brings
 * the goods under the minimum also keeps the invite pending.
 */
export function inviteQualifyingMinor(order: {
  totalMinor: number;
  shippingMinor: number;
}): number {
  return Math.max(
    0,
    Math.round(order.totalMinor) - Math.max(0, Math.round(order.shippingMinor)),
  );
}
/** How many settled invites may reward one inviter, ever. */
export const INVITE_REWARD_CAP = 5;

export async function rewardInviteOnFirstPaidOrder(
  inviteeEmail: string,
  order: {
    kind?: string;
    totalMinor: number;
    /** Courier or shipping fee inside `totalMinor`; never counts (W1-05). */
    shippingMinor: number;
    discountMinor?: number;
  },
): Promise<boolean> {
  const invitee = normalizeEmail(inviteeEmail);
  if (!invitee) return false;
  // Only a paid cafe order of real size counts: a ₺25 pickup, or a shop
  // parcel, must not turn into two ₺280 drinks.
  const paidMinor = inviteQualifyingMinor(order);
  if ((order.kind ?? "shop") !== "cafe" || paidMinor < INVITE_MIN_ORDER_MINOR) {
    return false;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLES.invites)
    .update({ status: "rewarded", rewardedAt: now })
    .eq("inviteeEmail", invitee)
    .eq("status", "pending")
    .select("id, inviterEmail, inviteeCouponId, inviterCouponId");
  checkErr(error, "rewardInvite.flip");
  const won =
    (data as
      | Pick<
          InviteRow,
          "id" | "inviterEmail" | "inviteeCouponId" | "inviterCouponId"
        >[]
      | null) ?? [];
  if (won.length === 0) return false;
  const invite = won[0];

  // The flip is the mutex, so it has to happen first - but until both coupons
  // exist it is also the only record that the reward is owed. If a grant
  // throws, the row goes back to `pending` so the next webhook retry settles
  // it again; leaving it `rewarded` lost the free drinks for good, because the
  // guarded UPDATE then matches nothing. Each coupon is recorded on the row
  // as soon as it exists, so that retry grants only what is still missing:
  // re-granting both handed the invitee a second drink whenever the
  // inviter's grant was the one that failed.
  const recordGrant = async (
    column: "inviteeCouponId" | "inviterCouponId",
    couponId: string,
  ) => {
    const { error: recErr } = await db
      .from(TABLES.invites)
      .update({ [column]: couponId })
      .eq("id", invite.id);
    checkErr(recErr, "rewardInvite.record");
  };
  try {
    if (!invite.inviteeCouponId) {
      const coupon = await grantFreeDrinkCoupon(invitee, "invite");
      await recordGrant("inviteeCouponId", coupon.id);
    }
    const inviter = normalizeEmail(invite.inviterEmail);
    if (inviter && !invite.inviterCouponId) {
      const { data: rewarded, error: countErr } = await db
        .from(TABLES.invites)
        .select("id")
        .eq("inviterEmail", inviter)
        .eq("status", "rewarded");
      checkErr(countErr, "rewardInvite.count");
      const settled = ((rewarded as { id: string }[] | null) ?? []).length;
      if (settled <= INVITE_REWARD_CAP) {
        const coupon = await grantFreeDrinkCoupon(inviter, "invite");
        await recordGrant("inviterCouponId", coupon.id);
      } else {
        console.warn(
          `[invite] reward cap reached for inviter, invitee still rewarded`,
        );
      }
    }
  } catch (err) {
    const undo = await db
      .from(TABLES.invites)
      .update({ status: "pending", rewardedAt: "" })
      .eq("id", invite.id)
      .eq("status", "rewarded");
    if (undo.error) {
      console.error(
        `[invite] could not re-open ${invite.id} after a failed grant`,
        undo.error,
      );
    }
    throw err;
  }
  return true;
}
