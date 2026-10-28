import { z } from "zod";

import {
  normalizeTableCode,
  normalizeTableName,
} from "@/lib/admin/cafe-tables-core";

import type { SignedCaller } from "./signed-callers";

/**
 * The table link between this site and LafPOS, the café's till
 * (RiosenBeq/lafpos, its docs/03-ENTEGRASYON.md §2.3 "Masa QR'ı LafPOS
 * üretir"). LafPOS prints the table cards itself, with a code of its own
 * making by this site's rule (ten Crockford base32 symbols,
 * src/lib/admin/cafe-tables-core.ts), and the QR still opens
 * `https://laffogato.net/masa/<code>`. For that code to name a table here -
 * on /masa, in the app's `GET /tables/{code}` and on a table order - LafPOS
 * sends its whole list with `PUT /api/panel/tables`
 * (src/app/api/panel/tables/route.ts, docs/LAFPOS.md "Masa kodları"):
 *
 * - a code the site does not have is added to `cafe_tables` as a new table,
 *   with the name and state given and no `rotatedAt`;
 * - a code the site has gets its name and state brought up to date, and
 *   only what differs is written;
 * - a table of the site's the list does not name is left alone;
 * - a code LafPOS retired ("Kodu yenile") comes as `active: false`, so the
 *   old card stops resolving here as well.
 *
 * Signed like the other panel routes, with LafPOS's own key only
 * (signed-callers.ts). Pure (no `server-only`, no database): the route, the
 * store and the tests share it.
 */

/** Tables one list may carry at most: a café has dozens, never hundreds. */
export const PANEL_TABLES_MAX = 200;

/**
 * A full list of 200 tables with the longest names (40 characters, up to
 * four bytes each) is under 48 KB; anything past this is refused.
 */
export const PANEL_TABLES_MAX_BODY_BYTES = 64 * 1024;

/** The LafPOS user's name as the audit row carries it. */
export const PANEL_TABLES_ACTOR_MAX = 60;

/** One table as LafPOS sends it, before its code and name are checked. */
const rawTableSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    active: z.boolean(),
  })
  .strict();

export const panelTablesSyncSchema = z
  .object({
    tables: z.array(rawTableSchema).max(PANEL_TABLES_MAX),
    actor: z.string().trim().min(1).max(PANEL_TABLES_ACTOR_MAX),
  })
  .strict();

/** One table as the site takes it: the code and the name normalised. */
export interface PanelTableInput {
  /** Ten symbols of the alphabet, upper case (`normalizeTableCode`). */
  code: string;
  /** Trimmed, inner whitespace collapsed (`normalizeTableName`). */
  name: string;
  active: boolean;
}

export interface PanelTablesSync {
  tables: PanelTableInput[];
  actor: string;
}

/** `["tables", 2, "code"]` → `tables[2].code`; an empty path is the body. */
function fieldOf(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) return "body";
  return path
    .map((p, i) =>
      typeof p === "number" ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`,
    )
    .join("");
}

/**
 * Parses a list's raw JSON. On a refusal, the first field that broke a
 * rule, named so LafPOS can show it: `body` for a body that is not the
 * object, `tables` for too many, `tables[2].code` for a code that is not
 * one (or one the list carries twice), `tables[2].name` for a name the
 * panel's form would refuse too, `actor` for a missing name. An empty list
 * is a list: nothing to add, nothing to change.
 */
export function parsePanelTablesSync(
  raw: unknown,
): { ok: true; sync: PanelTablesSync } | { ok: false; field: string } {
  const parsed = panelTablesSyncSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, field: fieldOf(parsed.error.issues[0]?.path ?? []) };
  }
  const tables: PanelTableInput[] = [];
  const seen = new Set<string>();
  for (const [i, t] of parsed.data.tables.entries()) {
    const code = normalizeTableCode(t.code);
    if (!code || seen.has(code))
      return { ok: false, field: `tables[${i}].code` };
    const name = normalizeTableName(t.name);
    if (!name) return { ok: false, field: `tables[${i}].name` };
    seen.add(code);
    tables.push({ code, name, active: t.active });
  }
  return { ok: true, sync: { tables, actor: parsed.data.actor } };
}

/** What the plan reads of a stored table. */
export interface StoredPanelTable {
  code: string;
  name: string;
  isActive: boolean;
}

/** The columns an update writes; only what differs is in it. */
export interface PanelTableUpdateFields {
  name?: string;
  isActive?: boolean;
}

export interface PanelTablesPlan {
  /** Codes the site does not have: new rows, as given. */
  create: PanelTableInput[];
  /** Codes the site has whose name or state differs. */
  update: Array<{ code: string; fields: PanelTableUpdateFields }>;
  /** Codes the site has exactly as given: nothing written. */
  unchanged: number;
}

/**
 * What the list changes against the site's tables of the same codes: the
 * rows to add, the rows to bring up to date with only the fields that
 * differ, and how many are already as given. A table of the site's that
 * `existing` holds but the list does not name is nobody's business here;
 * the store reads only the listed codes.
 */
export function planPanelTables(
  existing: ReadonlyArray<StoredPanelTable>,
  wanted: ReadonlyArray<PanelTableInput>,
): PanelTablesPlan {
  const byCode = new Map(existing.map((t) => [t.code, t]));
  const plan: PanelTablesPlan = { create: [], update: [], unchanged: 0 };
  for (const want of wanted) {
    const have = byCode.get(want.code);
    if (!have) {
      plan.create.push(want);
      continue;
    }
    const fields: PanelTableUpdateFields = {};
    if (have.name !== want.name) fields.name = want.name;
    if (have.isActive !== want.active) fields.isActive = want.active;
    if (Object.keys(fields).length === 0) plan.unchanged += 1;
    else plan.update.push({ code: want.code, fields });
  }
  return plan;
}

/**
 * The audit row's actor for a table LafPOS sent: `lafpos:LafPOS`, as the
 * menu and stage routes write theirs (docs/LAFPOS.md "Olay kaydı").
 */
export function panelTablesActor(
  actor: string,
  caller: SignedCaller = "lafpos",
): string {
  return `${caller}:${actor.trim().slice(0, PANEL_TABLES_ACTOR_MAX)}`;
}
