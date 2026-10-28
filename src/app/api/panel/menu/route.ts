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
  changedSaleFields,
  changesPrice,
  opensLargeSize,
  PANEL_MENU_MAX_BODY_BYTES,
  PANEL_MENU_VERSION,
  PANEL_MENU_WRITES,
  panelAuditActor,
  parsePanelMenuChange,
  saleFieldsOf,
  saleWriteGuard,
  sortForPanelMenu,
  staleSaleFields,
  toPanelMenuItem,
} from "@/lib/panel/menu-link-core";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * The köşk's panel (ladmin.laffogato.net) reading and writing the menu's
 * sale fields (src/lib/panel/menu-link-core.ts, docs/PANEL-MENU.md).
 *
 * - `GET /api/panel/menu`: every item, on the menu or not, in the
 *   whitelisted shape: id, name, category, prices, state, Sıra, updatedAt;
 *   and `writes: {expect: true}`, the optional request fields the write
 *   takes (menu-link-core `PANEL_MENU_WRITES`).
 * - `POST /api/panel/menu` `{id, priceMinor?, priceMinorL?, isActive?,
 *   actor, expect?}`: one item's prices and/or state, by the menu form's
 *   rules. In this order: parse, the item, `single_size`, then only the
 *   fields that differ (none: 200 and the item as it is, `expect` unread).
 *   A differing field whose `expect` the site no longer holds is not
 *   written: 409 `{error:"stale", item}` with the item as it is. Otherwise
 *   one UPDATE of those columns, conditional on the expected ones (a row
 *   that moved in between: the same 409), with an audit row
 *   "panel:<actor>"; the answer is the item as it now is, which the panel
 *   stores. The write expires `pub:menu`: the site, the tables' QR menu and
 *   the app show it, and the panel gets the usual ping.
 *
 * Server to server, no cookie: signed with the shared `KARAOKE_SYNC_SECRET`
 * like the karaoke route (CLAUDE.md rule 7), or by LafPOS, the café's till,
 * with its own `LAFPOS_SYNC_SECRET` (signed-callers.ts, docs/LAFPOS.md):
 * its writes are audited "lafpos:<actor>". Neither key set: 503. Bad,
 * missing or stale signature: 401, nothing more said. `src/proxy.ts` lets
 * every `/api/*` path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

function deny(status: number, error: string, extra: object = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

function shape(item: MenuItemPanelView) {
  return toPanelMenuItem(
    item,
    MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey,
  );
}

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const url = new URL(request.url);
  if (!signedCaller(keys, request, "GET", url, "")) {
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
      writes: PANEL_MENU_WRITES,
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PANEL_MENU_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > PANEL_MENU_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "POST", url, body);
  if (!caller) return deny(401, "unauthorized");
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const parsed = parsePanelMenuChange(raw);
  if (!parsed.ok) return deny(400, "invalid", { field: parsed.field });
  const { change } = parsed;
  // LafPOS writes Tükendi / Satışta only (docs/LAFPOS.md). Its key sits on
  // the café's machine; a stolen machine must not be able to change a price
  // the site and the app charge (src/lib/mobile/order-pricing.ts).
  if (caller === "lafpos") {
    const priceField =
      change.priceMinor !== undefined
        ? "priceMinor"
        : change.priceMinorL !== undefined
          ? "priceMinorL"
          : null;
    if (priceField) return deny(403, "forbidden", { field: priceField });
  }

  try {
    const current = await getMenuItemForPanel(change.id);
    if (!current) return deny(404, "not_found");
    // The site closed the L size; a stale panel may not open it again.
    if (opensLargeSize(current, saleFieldsOf(change))) {
      return deny(409, "single_size");
    }
    const fields = changedSaleFields(current, saleFieldsOf(change));
    // Nothing to change: the answer is the item as it is, whatever `expect`
    // says (the panel's "already sold out" rests on this 200).
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ item: shape(current) }, { headers: NO_STORE });
    }
    // A field the writer would change moved here after it read it: its
    // older view does not go over the newer value.
    if (staleSaleFields(current, fields, change.expect).length > 0) {
      return deny(409, "stale", { item: shape(current) });
    }
    // With `expect`, conditional on the expected columns; a write without
    // it (an older panel, LafPOS) is today's plain UPDATE.
    const guard = saleWriteGuard(current, fields, change.expect);
    const next = guard
      ? await setMenuItemSaleFields(change.id, fields, guard)
      : await setMenuItemSaleFields(change.id, fields);
    if (!next) {
      // Deleted between the read and the write, or (with `expect`) moved.
      const now = guard ? await getMenuItemForPanel(change.id) : null;
      return now
        ? deny(409, "stale", { item: shape(now) })
        : deny(404, "not_found");
    }
    // From here on the write is done: nothing below may turn it into an
    // error, or the panel would keep its old value beside the site's new
    // one. The mark and the audit row never throw.
    if (changesPrice(fields)) await markMenuPricesChanged(new Date());
    await safeAudit({
      action: "update",
      entity: "menu_item",
      entityId: change.id,
      actor: panelAuditActor(change.actor, caller),
      payload: { name: next.name, ...fields, via: caller },
    });
    return NextResponse.json({ item: shape(next) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[panel-menu] change could not be written", err);
    return deny(503, "unavailable");
  }
}
