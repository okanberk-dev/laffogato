import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import type { BranchPriceRow } from "@/lib/panel/branch-prices-core";

/**
 * The `menu_item_branch_prices` rows: a branch's own selling price
 * (db/migrations/20261123180000_menu_item_branch_prices.sql). The rules are
 * in src/lib/panel/branch-prices-core.ts; this file only reads and writes.
 *
 * Every write here expires `pub:menu` (src/lib/cache/tags.ts): the branch's
 * menu re-reads, the köşk's panel is pinged (`menu.changed`) and LafPOS's
 * menu marker moves.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function toRow(raw: Record<string, unknown>): BranchPriceRow {
  const price = raw.priceMinor;
  return {
    menuItemId: String(raw.menuItemId ?? ""),
    branch: String(raw.branch ?? ""),
    priceMinor: price === null || price === undefined ? null : Number(price),
    priceMinorL: Number(raw.priceMinorL ?? 0) || 0,
    effectiveFrom: String(raw.effectiveFrom ?? ""),
    createdAt: String(raw.createdAt ?? ""),
    createdBy: String(raw.createdBy ?? ""),
  };
}

function rowsOf(data: unknown): BranchPriceRow[] {
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}

/**
 * The rows, oldest first: one branch's (`branch`), else every branch's
 * (the köşk panel's read); `ids` narrows to those items.
 */
export async function listBranchPrices(
  branch?: string,
  ids?: readonly string[],
): Promise<BranchPriceRow[]> {
  if (ids && ids.length === 0) return [];
  let query = getDb().from(TABLES.menuItemBranchPrices).select("*");
  if (branch !== undefined) query = query.eq("branch", branch);
  if (ids) query = query.in("menuItemId", [...ids]);
  const { data, error } = await query
    .order("effectiveFrom")
    .order("menuItemId");
  checkErr(error, "menuBranchPrices.list");
  return rowsOf(data);
}

/**
 * Adds a row. "stale": the item already has a row at that branch and
 * instant (the panel's view of the item is older than the site's);
 * "gone": the item no longer exists (the row's foreign key).
 */
export async function insertBranchPrice(
  row: BranchPriceRow,
): Promise<
  { ok: true; row: BranchPriceRow } | { ok: false; reason: "stale" | "gone" }
> {
  const written: BranchPriceRow = {
    ...row,
    createdBy: row.createdBy.slice(0, 120),
  };
  const { error } = await getDb()
    .from(TABLES.menuItemBranchPrices)
    .insert(written);
  if (error?.code === "23505") return { ok: false, reason: "stale" };
  if (error?.code === "23503") return { ok: false, reason: "gone" };
  checkErr(error, "menuBranchPrices.insert");
  return { ok: true, row: written };
}

/**
 * Takes back a row not yet in force: deleted only while its instant is
 * still at or after `notBefore` (the caller's "now"; the row's own instant
 * is checked against it before). False: no such row (cancelled already,
 * or never there).
 */
export async function deleteFutureBranchPrice(
  menuItemId: string,
  branch: string,
  effectiveFrom: string,
  notBefore: Date,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.menuItemBranchPrices)
    .delete()
    .eq("menuItemId", menuItemId)
    .eq("branch", branch)
    .eq("effectiveFrom", effectiveFrom)
    .gte("effectiveFrom", notBefore.toISOString())
    .select("menuItemId");
  checkErr(error, "menuBranchPrices.delete");
  return ((data as unknown[] | null) ?? []).length > 0;
}
