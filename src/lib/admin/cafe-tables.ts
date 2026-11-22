import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";
import { branchOf, HOME_BRANCH } from "@/lib/panel/branches";
import {
  planPanelTables,
  type PanelTableInput,
  type PanelTableUpdateFields,
} from "@/lib/panel/tables-link-core";

import {
  generateTableCode,
  normalizeTableCode,
  normalizeTableName,
} from "./cafe-tables-core";

/**
 * The köşk's tables (`public.cafe_tables`), each with the QR printed on it.
 *
 * A table is a name staff use ("Bahçe 3") and a random code the server
 * generates (`cafe-tables-core.ts`). The QR opens `/masa/<code>` on the site,
 * or the app when it is installed; an app cafe order placed with
 * `fulfillment: "table"` names the code and the order row keeps a snapshot
 * of the code and the name (docs/API-MOBILE.md §3).
 *
 * Nothing here deletes. A table taken out of service is deactivated, which
 * keeps the row for the orders and the audit log that name it; a code that
 * leaked is rotated, which kills the old QR at once.
 *
 * One exception to "the code is the server's": LafPOS, the café's till,
 * prints its own cards and sends their codes (`importCafeTables`, the one
 * caller of which is the signed `PUT /api/panel/tables`;
 * src/lib/panel/tables-link-core.ts, docs/LAFPOS.md "Masa kodları").
 */

const TABLE = TABLES.cafeTables;

export interface CafeTable {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string;
  /** Where the table stands (src/lib/panel/branches.ts); Tuzla before 21 Kas 2026. */
  branch: string;
}

/**
 * What a lookup learns about a table: its label, and its branch for the
 * order and the call written at it. The public answers (the app's
 * `GET /tables/{code}`, /masa) still print the label alone.
 */
export interface PublicCafeTable {
  code: string;
  name: string;
  branch: string;
}

export type CafeTableErrorCode = "invalid_name" | "not_found";

export type CafeTableResult =
  | { ok: true; value: CafeTable }
  | { ok: false; error: CafeTableErrorCode; message: string };

const MESSAGES: Record<CafeTableErrorCode, string> = {
  invalid_name: "Masa adı 1-40 karakter olmalı.",
  not_found: "Masa bulunamadı.",
};

function fail(error: CafeTableErrorCode): CafeTableResult {
  return { ok: false, error, message: MESSAGES[error] };
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function toTable(row: Record<string, unknown>): CafeTable {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    sortOrder: Number(row.sortOrder ?? 0) || 0,
    isActive: row.isActive !== false,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    rotatedAt: String(row.rotatedAt ?? ""),
    branch: branchOf(row as { branch?: unknown }),
  };
}

/** Every table, in the panel's order: sort order, then name. */
export async function listCafeTables(): Promise<CafeTable[]> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true });
  checkErr(error, "cafeTables.list");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toTable);
}

export async function getCafeTable(id: string): Promise<CafeTable | null> {
  if (!id) return null;
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  checkErr(error, "cafeTables.get");
  return data ? toTable(data as Record<string, unknown>) : null;
}

/** How many fresh codes to try before giving up on a unique one. */
const CODE_ATTEMPTS = 5;

function isUniqueViolation(error: DbError | null): boolean {
  return Boolean(error && error.code === "23505");
}

/**
 * A new table. The code is the server's - never typed by staff, never read
 * from the request - and a collision on the unique index (one in 2^50 per
 * existing table) is answered by drawing again.
 */
export async function createCafeTable(
  rawName: string,
  branch: string = HOME_BRANCH,
): Promise<CafeTableResult> {
  const name = normalizeTableName(rawName);
  if (!name) return fail("invalid_name");
  const seq = await nextSeq("tbl");
  const id = `tbl-${String(seq).padStart(4, "0")}`;
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const row = {
      id,
      code: generateTableCode(),
      name,
      sortOrder: seq,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      rotatedAt: "",
      branch,
    };
    const { error } = await getDb().from(TABLE).insert(row);
    if (isUniqueViolation(error)) continue;
    checkErr(error, "cafeTables.create");
    return { ok: true, value: toTable(row) };
  }
  throw new Error("cafeTables.create: no unique code after retries");
}

export interface UpdateCafeTableInput {
  name: string;
  sortOrder: number;
  /** Absent keeps the table's branch. */
  branch?: string;
}

export async function updateCafeTable(
  id: string,
  input: UpdateCafeTableInput,
): Promise<CafeTableResult> {
  const name = normalizeTableName(input.name);
  if (!name) return fail("invalid_name");
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Math.trunc(input.sortOrder)
    : 0;
  const { data, error } = await getDb()
    .from(TABLE)
    .update({
      name,
      sortOrder,
      ...(input.branch ? { branch: input.branch } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*");
  checkErr(error, "cafeTables.update");
  const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
  return row ? { ok: true, value: toTable(row) } : fail("not_found");
}

export async function setCafeTableActive(
  id: string,
  isActive: boolean,
): Promise<CafeTableResult> {
  const { data, error } = await getDb()
    .from(TABLE)
    .update({ isActive, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("*");
  checkErr(error, "cafeTables.setActive");
  const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
  return row ? { ok: true, value: toTable(row) } : fail("not_found");
}

/**
 * A new code for the same table. The printed QR stops working immediately
 * (its code no longer resolves), so the sheet has to be printed again; orders
 * already placed keep the code they were placed with.
 */
export async function rotateCafeTableCode(
  id: string,
): Promise<CafeTableResult> {
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const { data, error } = await getDb()
      .from(TABLE)
      .update({ code: generateTableCode(), rotatedAt: now, updatedAt: now })
      .eq("id", id)
      .select("*");
    if (isUniqueViolation(error)) continue;
    checkErr(error, "cafeTables.rotate");
    const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
    return row ? { ok: true, value: toTable(row) } : fail("not_found");
  }
  throw new Error("cafeTables.rotate: no unique code after retries");
}

export interface ImportCafeTablesResult {
  /** Tables the list carried. */
  count: number;
  /** Rows added, as inserted. */
  created: CafeTable[];
  /** Rows brought up to date, as they now are. */
  updated: CafeTable[];
  /** Rows already as given: nothing written. */
  unchanged: number;
}

/**
 * One table's name and state by its code, at `branch` only; null when the
 * code names nothing there.
 */
async function updateCafeTableByCode(
  code: string,
  fields: PanelTableUpdateFields,
  now: string,
  branch: string,
): Promise<CafeTable | null> {
  const { data, error } = await getDb()
    .from(TABLE)
    .update({ ...fields, updatedAt: now })
    .eq("code", code)
    .eq("branch", branch)
    .select("*");
  checkErr(error, "cafeTables.import.update");
  const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
  return row ? toTable(row) : null;
}

/**
 * LafPOS's table list (src/lib/panel/tables-link-core.ts): each code the
 * site does not have becomes a new table with that code, the name and the
 * state given, and no `rotatedAt`; each code it has gets its name and
 * state brought up to date, only what differs written. A table of the
 * site's the list does not name is not touched: only the listed codes are
 * read. The codes and names are the parsed list's (`parsePanelTablesSync`),
 * never raw.
 *
 * One write per row, no transaction: a list cut short by an error leaves
 * the rows it did write, and the next list (LafPOS retries) finds them and
 * writes the rest. A code added meanwhile by someone else (the unique index
 * says so) is brought up to date instead of refused.
 */
export async function importCafeTables(
  tables: readonly PanelTableInput[],
  /** The list's branch (src/lib/panel/branches.ts). */
  branch: string,
): Promise<
  ImportCafeTablesResult | { wrongBranch: { index: number; code: string } }
> {
  const result: ImportCafeTablesResult = {
    count: tables.length,
    created: [],
    updated: [],
    unchanged: 0,
  };
  if (tables.length === 0) return result;
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .in(
      "code",
      tables.map((t) => t.code),
    );
  checkErr(error, "cafeTables.import.read");
  const existing = ((data as Record<string, unknown>[] | null) ?? []).map(
    toTable,
  );
  const plan = planPanelTables(existing, tables, branch);
  // Another branch's table: the whole list is refused, nothing written.
  if (plan.wrongBranch) return { wrongBranch: plan.wrongBranch };
  result.unchanged = plan.unchanged;
  const now = new Date().toISOString();
  for (const want of plan.create) {
    const seq = await nextSeq("tbl");
    const row = {
      id: `tbl-${String(seq).padStart(4, "0")}`,
      code: want.code,
      name: want.name,
      sortOrder: seq,
      isActive: want.active,
      createdAt: now,
      updatedAt: now,
      rotatedAt: "",
      branch,
    };
    const { error: insertError } = await getDb().from(TABLE).insert(row);
    if (isUniqueViolation(insertError)) {
      // Added meanwhile: brought up to date if it is this branch's, else
      // left alone (the next list is refused with `wrong_branch`).
      const updated = await updateCafeTableByCode(
        want.code,
        { name: want.name, isActive: want.active },
        now,
        branch,
      );
      if (updated) result.updated.push(updated);
      continue;
    }
    checkErr(insertError, "cafeTables.import.create");
    result.created.push(toTable(row));
  }
  for (const change of plan.update) {
    const updated = await updateCafeTableByCode(
      change.code,
      change.fields,
      now,
      branch,
    );
    if (updated) result.updated.push(updated);
  }
  return result;
}

/**
 * The table behind a code from outside (a QR, the app):
 *
 *   `{ code, name }`  the code names an active table;
 *   `"inactive"`      it names a table taken out of service;
 *   `null`            it names nothing (or is not a code at all - such a
 *                     value never reaches the database).
 */
export async function resolveActiveTable(
  raw: unknown,
): Promise<PublicCafeTable | "inactive" | null> {
  const code = normalizeTableCode(raw);
  if (!code) return null;
  const { data, error } = await getDb()
    .from(TABLE)
    .select("code, name, isActive, branch")
    .eq("code", code)
    .maybeSingle();
  checkErr(error, "cafeTables.resolve");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (row.isActive === false) return "inactive";
  return {
    code: String(row.code ?? code),
    name: String(row.name ?? ""),
    branch: branchOf(row as { branch?: unknown }),
  };
}
