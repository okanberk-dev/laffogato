import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import {
  importCafeTables,
  type ImportCafeTablesResult,
} from "@/lib/admin/cafe-tables";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";
import {
  PANEL_TABLES_MAX_BODY_BYTES,
  panelTablesActor,
  parsePanelTablesSync,
} from "@/lib/panel/tables-link-core";

/**
 * `PUT /api/panel/tables` - LafPOS, the café's till, sending the codes it
 * printed on the table cards, so the QR it made opens the right table here
 * and in the app (src/lib/panel/tables-link-core.ts, docs/LAFPOS.md "Masa
 * kodları"; the LafPOS side: lafpos docs/03-ENTEGRASYON.md §2.3).
 *
 * Body `{tables: [{code, name, active}], actor}`, the whole list every
 * time, 200 tables at most. A code the site does not have becomes a new
 * table (`importCafeTables`); one it has gets its name and state brought
 * up to date, only what differs written; a table the list does not name is
 * left alone. Each row added or changed gets an audit row "lafpos:<actor>"
 * (the panel's own Masalar actions write the same rows). No cache to
 * expire: a table lookup (/masa, the app's `GET /tables/{code}`, the order
 * path) reads the database every time, so a new code resolves at once.
 *
 * - 200 `{ok: true, count, created, updated, unchanged}`.
 * - 400 `{error: "invalid", field}`: a field broke a rule (`tables[2].code`).
 * - 401: unsigned, forged, stale, or signed with the panel's key.
 * - 413: the body is past the limit.
 * - 503 `not_configured`: `LAFPOS_SYNC_SECRET` unset (docs/LAFPOS.md
 *   "Varsayılan kapalı"); `unavailable`: the database could not be written.
 *
 * Server to server, no cookie: signed with LafPOS's own `LAFPOS_SYNC_SECRET`
 * only (signed-callers.ts, CLAUDE.md rule 7). The panel's key opens nothing
 * here: the panel does not print cards. `src/proxy.ts` lets every `/api/*`
 * path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** LafPOS alone, with its own key. */
const CALLERS: readonly SignedCaller[] = ["lafpos"];

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export async function PUT(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_TABLES_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_TABLES_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "PUT", url, body);
  if (!caller) return deny(401, "unauthorized");
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const parsed = parsePanelTablesSync(raw);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { sync } = parsed;

  let result: ImportCafeTablesResult;
  try {
    result = await importCafeTables(sync.tables);
  } catch (err) {
    console.error("[panel-tables] tables could not be written", err);
    return deny(503, "unavailable");
  }
  // From here on the writes are done: nothing below may turn them into an
  // error, or LafPOS would park a list the site has taken. The audit rows
  // never throw.
  const actor = panelTablesActor(sync.actor, caller);
  for (const table of result.created) {
    await safeAudit({
      action: "create",
      entity: "cafe_table",
      entityId: table.id,
      actor,
      payload: {
        name: table.name,
        code: table.code,
        isActive: table.isActive,
        via: caller,
      },
    });
  }
  for (const table of result.updated) {
    await safeAudit({
      action: "update",
      entity: "cafe_table",
      entityId: table.id,
      actor,
      payload: {
        name: table.name,
        code: table.code,
        isActive: table.isActive,
        via: caller,
      },
    });
  }
  return NextResponse.json(
    {
      ok: true,
      count: result.count,
      created: result.created.length,
      updated: result.updated.length,
      unchanged: result.unchanged,
    },
    { headers: NO_STORE },
  );
}
