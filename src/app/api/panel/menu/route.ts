import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import {
  getMenuItemForPanel,
  listMenuItemsForPanel,
  markMenuPricesChanged,
  MENU_CATEGORY_KEYS,
  MENU_CATEGORY_LABELS,
  setMenuItemSaleFields,
  type MenuItemPanelView,
} from "@/lib/admin/store";
import {
  panelSyncConfig,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
import {
  changedSaleFields,
  changesPrice,
  PANEL_MENU_MAX_BODY_BYTES,
  PANEL_MENU_VERSION,
  panelAuditActor,
  parsePanelMenuChange,
  saleFieldsOf,
  sortForPanelMenu,
  toPanelMenuItem,
} from "@/lib/panel/menu-link-core";

/**
 * The köşk's panel (ladmin.laffogato.net) reading and writing the menu's
 * sale fields (src/lib/panel/menu-link-core.ts, docs/PANEL-MENU.md).
 *
 * - `GET /api/panel/menu`: every item, on the menu or not, in the
 *   whitelisted shape: id, name, category, prices, state, Sıra, updatedAt.
 * - `POST /api/panel/menu` `{id, priceMinor?, priceMinorL?, isActive?,
 *   actor}`: one item's prices and/or state, by the menu form's rules. Only
 *   the fields that differ are written (one UPDATE of those columns), with
 *   an audit row "panel:<actor>"; the answer is the item as it now is, which
 *   the panel stores. The write expires `pub:menu`: the site, the tables'
 *   QR menu and the app show it, and the panel gets the usual ping.
 *
 * Server to server, no cookie: signed with the shared `KARAOKE_SYNC_SECRET`
 * like the karaoke route (CLAUDE.md rule 7). Unset secret: 503. Bad,
 * missing or stale signature: 401, nothing more said. `src/proxy.ts` lets
 * every `/api/*` path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

function signedBy(
  secret: string,
  request: Request,
  method: "GET" | "POST",
  url: URL,
  body: string,
): boolean {
  return verifySignature(secret, {
    method,
    url,
    body,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
}

function shape(item: MenuItemPanelView) {
  return toPanelMenuItem(
    item,
    MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey,
  );
}

export async function GET(request: Request) {
  const config = panelSyncConfig(process.env);
  if (!config) return deny(503, "not_configured");
  const url = new URL(request.url);
  if (!signedBy(config.secret, request, "GET", url, "")) {
    return deny(401, "unauthorized");
  }
  // Stamped before the read, like the orders route: a write that lands
  // while the list is read is after `now`, so the panel does not take the
  // list's older value for that write's.
  const now = new Date();
  let items: MenuItemPanelView[];
  try {
    // The panel's columns only: never the photos (up to 2 MB each).
    items = await listMenuItemsForPanel();
  } catch (err) {
    console.error("[panel-menu] menu could not be read", err);
    return deny(503, "unavailable");
  }
  return NextResponse.json(
    {
      version: PANEL_MENU_VERSION,
      now: now.toISOString(),
      items: sortForPanelMenu(items.map(shape), MENU_CATEGORY_KEYS),
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const config = panelSyncConfig(process.env);
  if (!config) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_MENU_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_MENU_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  if (!signedBy(config.secret, request, "POST", url, body)) {
    return deny(401, "unauthorized");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const parsed = parsePanelMenuChange(raw);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { change } = parsed;

  try {
    const current = await getMenuItemForPanel(change.id);
    if (!current) return deny(404, "not_found");
    const fields = changedSaleFields(current, saleFieldsOf(change));
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ item: shape(current) }, { headers: NO_STORE });
    }
    const next = await setMenuItemSaleFields(change.id, fields);
    // Deleted between the read and the write.
    if (!next) return deny(404, "not_found");
    // From here on the write is done: nothing below may turn it into an
    // error, or the panel would keep its old value beside the site's new
    // one. The mark and the audit row never throw.
    if (changesPrice(fields)) await markMenuPricesChanged(new Date());
    await safeAudit({
      action: "update",
      entity: "menu_item",
      entityId: change.id,
      actor: panelAuditActor(change.actor),
      payload: { name: next.name, ...fields, via: "panel" },
    });
    return NextResponse.json({ item: shape(next) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[panel-menu] change could not be written", err);
    return deny(503, "unavailable");
  }
}
