import "server-only";

import { listMenuItems } from "@/lib/admin/store";
import { grantCoupon } from "@/lib/customer/coupons";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  giftTitle,
  MILESTONE_GIFTS,
  MILESTONE_TTL_DAYS,
  pickGift,
  reachedMilestones,
  type MilestoneSpec,
} from "./milestones-core";

/** One granted milestone, as the table records it. */
export type MilestoneGrant = {
  customerEmail: string;
  milestone: number;
  couponId: string;
  menuItemId: string;
  itemName: string;
  valueMinor: number;
  createdAt: string;
};

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** The milestones this member has already been given. */
export async function listMilestoneGrants(email: string): Promise<MilestoneGrant[]> {
  const owner = (email ?? "").trim().toLowerCase();
  if (!owner) return [];
  const { data, error } = await getDb()
    .from(TABLES.customerMilestoneRewards)
    .select("*")
    .eq("customerEmail", owner);
  checkErr(error, "listMilestoneGrants");
  return ((data as MilestoneGrant[] | null) ?? []).sort((a, b) => a.milestone - b.milestone);
}

/**
 * Gives every milestone this lifetime count has reached and not yet given
 * (karar 175). Called after a stamp is earned - an app cafe order paid, a
 * stamp at the till.
 *
 * The row is written BEFORE the coupon is minted: its primary key (member,
 * milestone) is what stops two simultaneous stamps from both giving the
 * tenth-stamp gift. When minting fails the claim is withdrawn, so the next
 * stamp tries again rather than leaving the milestone spent on nothing.
 * `random` is injected for the random picks (tests pass their own).
 */
export async function grantMilestoneGifts(
  email: string,
  lifetime: number,
  random: () => number = Math.random,
  specs: readonly MilestoneSpec[] = MILESTONE_GIFTS,
): Promise<MilestoneGrant[]> {
  const owner = (email ?? "").trim().toLowerCase();
  if (!owner) return [];
  const due = reachedMilestones(lifetime, specs);
  if (due.length === 0) return [];
  const given = new Set((await listMilestoneGrants(owner)).map((g) => g.milestone));
  const todo = due.filter((m) => !given.has(m.at));
  if (todo.length === 0) return [];

  const db = getDb();
  const menu = await listMenuItems();
  const granted: MilestoneGrant[] = [];
  for (const spec of todo) {
    const now = new Date().toISOString();
    const claim: MilestoneGrant = {
      customerEmail: owner,
      milestone: spec.at,
      couponId: "",
      menuItemId: "",
      itemName: "",
      valueMinor: 0,
      createdAt: now,
    };
    const ins = await db.from(TABLES.customerMilestoneRewards).insert(claim);
    // 23505: another request claimed this milestone a moment ago.
    if (ins.error?.code === "23505") continue;
    checkErr(ins.error, "grantMilestoneGifts.claim");

    const item = pickGift(spec, menu, random);
    if (!item) {
      // Nothing on the menu can be given right now: let the next stamp try.
      await db.from(TABLES.customerMilestoneRewards).delete().eq("customerEmail", owner).eq("milestone", spec.at);
      continue;
    }
    try {
      const coupon = await grantCoupon({
        email: owner,
        kind: "fixed",
        value: item.priceMinor,
        title: giftTitle(item),
        source: "milestone",
        expiresAt: new Date(Date.now() + MILESTONE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      });
      const record: MilestoneGrant = {
        ...claim,
        couponId: coupon.id,
        menuItemId: item.id,
        itemName: item.name,
        valueMinor: item.priceMinor,
      };
      const upd = await db
        .from(TABLES.customerMilestoneRewards)
        .update({ couponId: record.couponId, menuItemId: record.menuItemId, itemName: record.itemName, valueMinor: record.valueMinor })
        .eq("customerEmail", owner)
        .eq("milestone", spec.at);
      checkErr(upd.error, "grantMilestoneGifts.record");
      granted.push(record);
    } catch (err) {
      await db.from(TABLES.customerMilestoneRewards).delete().eq("customerEmail", owner).eq("milestone", spec.at);
      throw err;
    }
  }
  return granted;
}
