import "server-only";

import type { DbError } from "@/lib/db";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import { INVITE_REWARD_CAP, type InviteRow } from "@/lib/mobile/invite";

/**
 * The invite tree, read-only, for the panel.
 *
 * Deliberately NOT `getInviteSummary`: that one calls `ensureInviteCode`, so
 * opening a customer page would mint an invite code for a member who never
 * asked for one. Staff diagnosing a stuck referral only need to see the rows.
 */

export interface AdminInviteTree {
  /** The member's own shareable code ("" when none has been minted yet). */
  inviteCode: string;
  /** Who invited them, if anyone. */
  invitedBy: string;
  /** Rows this member created by sharing their code, newest first. */
  invitees: InviteRow[];
  /** How many of them have paid out. */
  rewardedCount: number;
  /** The cap in lib/mobile/invite.ts — once hit, further invites earn nothing. */
  rewardCap: number;
  capReached: boolean;
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

export async function getAdminInviteTree(
  email: string,
): Promise<AdminInviteTree> {
  const owner = (email ?? "").trim().toLowerCase();
  if (!owner) {
    return {
      inviteCode: "",
      invitedBy: "",
      invitees: [],
      rewardedCount: 0,
      rewardCap: INVITE_REWARD_CAP,
      capReached: false,
    };
  }
  const db = getDb();
  // `AdminCustomer` does not carry the two invite columns, so they are read
  // here rather than widening the customer view for one card.
  const [rows, identity] = await Promise.all([
    db
      .from(TABLES.invites)
      .select("*")
      .eq("inviterEmail", owner)
      .order("createdAt", { ascending: false }),
    db
      .from(TABLES.customers)
      .select("inviteCode, invitedBy")
      .eq("email", owner)
      .maybeSingle(),
  ]);
  checkErr(rows.error, "getAdminInviteTree");
  checkErr(identity.error, "getAdminInviteTree.identity");
  const who = identity.data as {
    inviteCode?: string;
    invitedBy?: string;
  } | null;
  const invitees = (rows.data as InviteRow[] | null) ?? [];
  const rewardedCount = invitees.filter((i) => i.status === "rewarded").length;
  return {
    inviteCode: who?.inviteCode ?? "",
    invitedBy: who?.invitedBy ?? "",
    invitees,
    rewardedCount,
    rewardCap: INVITE_REWARD_CAP,
    capReached: rewardedCount >= INVITE_REWARD_CAP,
  };
}
