import "server-only";

import { listMenuItems } from "@/lib/admin/store";
import {
  grantCoupon,
  listCustomerCoupons,
  withdrawUnusedCoupon,
  type CustomerCoupon,
} from "@/lib/customer/coupons";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  giftTitle,
  MILESTONE_GIFTS,
  MILESTONE_TTL_DAYS,
  milestonesToClawBack,
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
export async function listMilestoneGrants(
  email: string,
): Promise<MilestoneGrant[]> {
  const owner = (email ?? "").trim().toLowerCase();
  if (!owner) return [];
  const { data, error } = await getDb()
    .from(TABLES.customerMilestoneRewards)
    .select("*")
    .eq("customerEmail", owner);
  checkErr(error, "listMilestoneGrants");
  return ((data as MilestoneGrant[] | null) ?? []).sort(
    (a, b) => a.milestone - b.milestone,
  );
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
  const given = new Set(
    (await listMilestoneGrants(owner)).map((g) => g.milestone),
  );
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
      await db
        .from(TABLES.customerMilestoneRewards)
        .delete()
        .eq("customerEmail", owner)
        .eq("milestone", spec.at);
      continue;
    }
    try {
      const coupon = await grantCoupon({
        email: owner,
        kind: "fixed",
        value: item.priceMinor,
        title: giftTitle(item),
        source: "milestone",
        expiresAt: new Date(
          Date.now() + MILESTONE_TTL_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
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
        .update({
          couponId: record.couponId,
          menuItemId: record.menuItemId,
          itemName: record.itemName,
          valueMinor: record.valueMinor,
        })
        .eq("customerEmail", owner)
        .eq("milestone", spec.at);
      checkErr(upd.error, "grantMilestoneGifts.record");
      granted.push(record);
    } catch (err) {
      await db
        .from(TABLES.customerMilestoneRewards)
        .delete()
        .eq("customerEmail", owner)
        .eq("milestone", spec.at);
      throw err;
    }
  }
  return granted;
}

/**
 * Takes back the milestone gifts a reversal left uncovered: the lifetime
 * count went down (a refunded or cancelled order gave its stamps back) and
 * some milestone above it had already been given. See
 * `milestonesToClawBack` for which ones; for each, the unused coupon is
 * withdrawn first (a guarded update, so a gift spent at the checkout a
 * moment earlier stays spent and keeps its claim) and only then the claim
 * row is dropped, keyed on the coupon too, so a claim granted again since
 * is never removed. Returns the milestones whose claim was dropped.
 *
 * `coupons` lets a caller that has just read the member's coupons hand them
 * over; otherwise they are read here.
 */
export async function clawBackMilestoneGifts(
  email: string,
  lifetime: number,
  coupons?: readonly CustomerCoupon[],
  nowMs: number = Date.now(),
): Promise<number[]> {
  const owner = (email ?? "").trim().toLowerCase();
  if (!owner) return [];
  const grants = await listMilestoneGrants(owner);
  if (!grants.some((g) => g.milestone > lifetime)) return [];
  const plan = milestonesToClawBack(
    lifetime,
    grants,
    coupons ?? (await listCustomerCoupons(owner)),
    nowMs,
  );
  const db = getDb();
  const dropped: number[] = [];
  for (const step of plan) {
    if (
      step.action === "withdraw" &&
      !(await withdrawUnusedCoupon(step.couponId, owner, "milestone"))
    ) {
      // Spent (or taken back by a concurrent claw-back) in the meantime:
      // a spent gift keeps its claim; the other writer drops it.
      continue;
    }
    const del = await db
      .from(TABLES.customerMilestoneRewards)
      .delete()
      .eq("customerEmail", owner)
      .eq("milestone", step.milestone)
      .eq("couponId", step.couponId);
    checkErr(del.error, "clawBackMilestoneGifts.release");
    dropped.push(step.milestone);
  }
  return dropped;
}
