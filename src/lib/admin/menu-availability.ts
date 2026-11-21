import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import type { BranchAvailability } from "@/lib/panel/menu-availability-core";

/**
 * The `menu_item_availability` rows: "Satışta / Tükendi" per branch
 * (db/migrations/20261121150719_branches.sql). The rules are in
 * src/lib/panel/menu-availability-core.ts; this file only reads and writes.
 *
 * Every write here expires `pub:menu` (src/lib/cache/tags.ts): the site's
 * menu, the app's /menu and the table's QR menu re-read, the köşk's panel is
 * pinged (`menu.changed`) and LafPOS's menu marker moves.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function toRow(raw: Record<string, unknown>): BranchAvailability {
  return {
    menuItemId: String(raw.menuItemId ?? ""),
    branch: String(raw.branch ?? ""),
    isActive: raw.isActive !== false,
    updatedAt: String(raw.updatedAt ?? ""),
    updatedBy: String(raw.updatedBy ?? ""),
  };
}

function rowsOf(data: unknown): BranchAvailability[] {
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}

/** A branch's rows, by item id. */
export async function listBranchAvailability(
  branch: string,
  ids?: readonly string[],
): Promise<Map<string, BranchAvailability>> {
  if (ids && ids.length === 0) return new Map();
  let query = getDb()
    .from(TABLES.menuItemAvailability)
    .select("*")
    .eq("branch", branch);
  if (ids) query = query.in("menuItemId", [...ids]);
  const { data, error } = await query;
  checkErr(error, "menuAvailability.list");
  return new Map(rowsOf(data).map((r) => [r.menuItemId, r]));
}

/** Every branch's rows (the site panel's menu list). */
export async function listAllBranchAvailability(): Promise<
  BranchAvailability[]
> {
  const { data, error } = await getDb()
    .from(TABLES.menuItemAvailability)
    .select("*");
  checkErr(error, "menuAvailability.listAll");
  return rowsOf(data);
}

/** One item's row at a branch, or null (no row: "Satışta"). */
export async function getBranchAvailability(
  menuItemId: string,
  branch: string,
): Promise<BranchAvailability | null> {
  const { data, error } = await getDb()
    .from(TABLES.menuItemAvailability)
    .select("*")
    .eq("menuItemId", menuItemId)
    .eq("branch", branch)
    .maybeSingle();
  checkErr(error, "menuAvailability.get");
  return data ? toRow(data as Record<string, unknown>) : null;
}

/**
 * Writes an item's row at a branch, conditional on the row the caller read
 * (`seen`): null inserts one (another write that inserted first wins:
 * "stale"), a row updates it only while it still holds `seen.isActive` and
 * `seen.updatedAt`. "gone": the item no longer exists (the row's foreign
 * key). The answer is the row as written.
 */
export async function writeBranchAvailability(
  menuItemId: string,
  branch: string,
  isActive: boolean,
  updatedBy: string,
  seen: BranchAvailability | null,
  now: Date = new Date(),
): Promise<
  | { ok: true; row: BranchAvailability }
  | { ok: false; reason: "stale" | "gone" }
> {
  const row: BranchAvailability = {
    menuItemId,
    branch,
    isActive,
    updatedAt: now.toISOString(),
    updatedBy: updatedBy.slice(0, 120),
  };
  const db = getDb();
  if (!seen) {
    const { error } = await db.from(TABLES.menuItemAvailability).insert(row);
    if (error?.code === "23505") return { ok: false, reason: "stale" };
    if (error?.code === "23503") return { ok: false, reason: "gone" };
    checkErr(error, "menuAvailability.insert");
    return { ok: true, row };
  }
  const { data, error } = await db
    .from(TABLES.menuItemAvailability)
    .update({
      isActive: row.isActive,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    })
    .eq("menuItemId", menuItemId)
    .eq("branch", branch)
    .eq("isActive", seen.isActive)
    .eq("updatedAt", seen.updatedAt)
    .select("menuItemId");
  checkErr(error, "menuAvailability.update");
  const moved = ((data as unknown[] | null) ?? []).length > 0;
  return moved ? { ok: true, row } : { ok: false, reason: "stale" };
}
