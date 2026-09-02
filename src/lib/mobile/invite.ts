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
    // Zero rows: a concurrent request assigned the code first — read it.
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

  const people: InvitePerson[] = invites.map((i) => ({
    name: abbreviateName(names.get(normalizeEmail(i.inviteeEmail)) ?? ""),
    status: i.status === "pending" ? "pending" : "joined",
    at: i.rewardedAt || i.createdAt,
  }));
  return {
    code,
    invited: invites.length,
    joined: invites.filter((i) => i.status !== "pending").length,
    earned: invites.filter((i) => i.status === "rewarded").length,
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
  if ((await customerOrdersByEmail(claimer)).length > 0) {
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
 * webhook — or two orders paid at the same moment — rewards exactly once.
 */
/** A cafe order below this does not settle an invite (docs/REWARDS.md §2). */
export const INVITE_MIN_ORDER_MINOR = 15000;
/** How many settled invites may reward one inviter, ever. */
export const INVITE_REWARD_CAP = 5;

export async function rewardInviteOnFirstPaidOrder(
  inviteeEmail: string,
  order: { kind?: string; totalMinor: number; discountMinor?: number },
): Promise<boolean> {
  const invitee = normalizeEmail(inviteeEmail);
  if (!invitee) return false;
  // Only a paid cafe order of real size counts: a ₺25 pickup, or a shop
  // parcel, must not turn into two ₺280 drinks.
  const paidMinor = order.totalMinor;
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
    .select("id, inviterEmail");
  checkErr(error, "rewardInvite.flip");
  const won = (data as { id: string; inviterEmail: string }[] | null) ?? [];
  if (won.length === 0) return false;

  await grantFreeDrinkCoupon(invitee, "invite");
  const inviter = normalizeEmail(won[0].inviterEmail);
  if (inviter) {
    const { data: rewarded, error: countErr } = await db
      .from(TABLES.invites)
      .select("id")
      .eq("inviterEmail", inviter)
      .eq("status", "rewarded");
    checkErr(countErr, "rewardInvite.count");
    const settled = ((rewarded as { id: string }[] | null) ?? []).length;
    if (settled <= INVITE_REWARD_CAP) {
      await grantFreeDrinkCoupon(inviter, "invite");
    } else {
      console.warn(
        `[invite] reward cap reached for inviter, invitee still rewarded`,
      );
    }
  }
  return true;
}
