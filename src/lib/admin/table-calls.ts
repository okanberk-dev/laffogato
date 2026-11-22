import "server-only";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import { branchOf } from "@/lib/panel/branches";

import {
  TABLE_CALL_LIST_MAX,
  isTableCallReason,
  tableCallsOpenSince,
  toPanelTableCalls,
  type PanelTableCall,
  type TableCallReason,
  type TableCallRow,
} from "./table-calls-core";

/**
 * The `table_calls` rows ("Garson çağır", 6 Kas 2026;
 * db/migrations/20261106120000_table_calls.sql). The rules are in
 * table-calls-core.ts; this file only reads and writes.
 *
 * Every write here expires `live:orders` (src/lib/cache/tags.ts), so the
 * data layer pings the köşk panel (`orders.changed`) after the response and
 * the order alert's change marker moves: a new call or an answer reaches
 * the bar screen and every open panel tab within seconds, and no code path
 * has to remember it.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function toRow(raw: Record<string, unknown>): TableCallRow | null {
  const reason = raw.reason;
  if (!isTableCallReason(reason)) return null;
  return {
    id: String(raw.id ?? ""),
    tableCode: String(raw.tableCode ?? ""),
    tableName: String(raw.tableName ?? ""),
    reason,
    customerEmail: String(raw.customerEmail ?? ""),
    createdAt: String(raw.createdAt ?? ""),
    ackedAt: String(raw.ackedAt ?? ""),
    ackedBy: String(raw.ackedBy ?? ""),
    branch: branchOf(raw as { branch?: unknown }),
  };
}

function rowsOf(data: unknown): TableCallRow[] {
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map(toRow)
    .filter((row): row is TableCallRow => row !== null);
}

export async function getTableCall(id: string): Promise<TableCallRow | null> {
  const { data, error } = await getDb()
    .from(TABLES.tableCalls)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  checkErr(error, "tableCalls.get");
  return data ? toRow(data as Record<string, unknown>) : null;
}

/**
 * The table's open call for `reason` (unanswered, younger than the
 * window), the oldest one if there are several, or null.
 */
export async function findOpenTableCall(
  tableCode: string,
  reason: TableCallReason,
  now: Date,
): Promise<TableCallRow | null> {
  const { data, error } = await getDb()
    .from(TABLES.tableCalls)
    .select("*")
    .eq("tableCode", tableCode)
    .eq("reason", reason)
    .eq("ackedAt", "")
    .gte("createdAt", tableCallsOpenSince(now.getTime()))
    .order("createdAt", { ascending: true })
    .limit(1);
  checkErr(error, "tableCalls.findOpen");
  return rowsOf(data)[0] ?? null;
}

export async function insertTableCall(row: {
  id: string;
  tableCode: string;
  tableName: string;
  reason: TableCallReason;
  customerEmail: string;
  createdAt: string;
  /** The table's branch (`cafe_tables.branch`). */
  branch: string;
}): Promise<TableCallRow> {
  const values = {
    ...row,
    customerEmail: row.customerEmail.trim().toLowerCase(),
    ackedAt: "",
    ackedBy: "",
  };
  const { error } = await getDb().from(TABLES.tableCalls).insert(values);
  checkErr(error, "tableCalls.insert");
  return values;
}

/**
 * Every open call, oldest first: unanswered and younger than the window
 * (TABLE_CALL_OPEN_MS), at most `limit`; with `branch`, that branch's only
 * (the signed bar screens: src/lib/panel/branches.ts). This site's own
 * panel reads every branch.
 */
export async function listOpenTableCalls(
  now: Date,
  limit = TABLE_CALL_LIST_MAX,
  branch?: string,
): Promise<TableCallRow[]> {
  let query = getDb()
    .from(TABLES.tableCalls)
    .select("*")
    .eq("ackedAt", "")
    .gte("createdAt", tableCallsOpenSince(now.getTime()));
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query
    .order("createdAt", { ascending: true })
    .limit(limit);
  checkErr(error, "tableCalls.listOpen");
  return rowsOf(data);
}

/**
 * The open calls as Siparişler's "Masa çağrıları" list shows them: the
 * bar screen's whitelist (table, reason, time), oldest first, no guest.
 */
export async function listOpenTableCallsForPanel(
  now: Date = new Date(),
): Promise<PanelTableCall[]> {
  return toPanelTableCalls(await listOpenTableCalls(now), now.getTime());
}

export type TableCallAck =
  | { ok: true; call: TableCallRow; already: boolean }
  | { ok: false; reason: "not_found" | "wrong_branch" };

/**
 * "Gördüm": answers the call, once. The write is conditional on the call
 * still being unanswered, so two people pressing at once (the bar screen
 * and this panel) leave the first answer in place and both are told it is
 * answered; pressing again is a no-op. An expired call can still be
 * answered (it was seen after all), it just stopped ringing on its own.
 */
export async function ackTableCall(
  id: string,
  ackedBy: string,
  now: Date = new Date(),
  /**
   * The signed bar screens' branch (src/lib/panel/branches.ts): a call of
   * another branch is not theirs to answer ("wrong_branch", nothing
   * written). This site's own panel answers any.
   */
  branch?: string,
): Promise<TableCallAck> {
  let update = getDb()
    .from(TABLES.tableCalls)
    .update({ ackedAt: now.toISOString(), ackedBy: ackedBy.slice(0, 120) })
    .eq("id", id)
    .eq("ackedAt", "");
  if (branch) update = update.eq("branch", branch);
  const { data, error } = await update.select("*");
  checkErr(error, "tableCalls.ack");
  const moved = rowsOf(data)[0];
  if (moved) return { ok: true, call: moved, already: false };
  const current = await getTableCall(id);
  if (!current) return { ok: false, reason: "not_found" };
  if (branch && branchOf(current) !== branch) {
    return { ok: false, reason: "wrong_branch" };
  }
  return { ok: true, call: current, already: true };
}

/**
 * "Gördüm" from this site's panel (the order alert's card, the "Masa
 * çağrıları" list): `ackedBy` is "admin:<name>", the panel account's name,
 * or its e-mail when the account has none (the env-credentialed owner).
 */
export async function ackTableCallAsAdmin(
  id: string,
  adminEmail: string,
  now: Date = new Date(),
): Promise<TableCallAck> {
  return ackTableCall(id, `admin:${await adminName(adminEmail)}`, now);
}

async function adminName(email: string): Promise<string> {
  const { data, error } = await getDb()
    .from(TABLES.adminUsers)
    .select("name")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) return email;
  const name = String((data as { name?: unknown } | null)?.name ?? "").trim();
  return name || email;
}
