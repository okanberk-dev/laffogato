import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import {
  getBranchAvailability,
  listBranchAvailability,
  writeBranchAvailability,
} from "@/lib/admin/menu-availability";
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
import { chooseBranch, splitBranch } from "@/lib/panel/branches";
import {
  itemAtBranch,
  planAvailabilityWrite,
  type BranchAvailability,
} from "@/lib/panel/menu-availability-core";
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
 * Per branch since 21 Kas 2026 (branches.ts, menu-availability-core.ts):
 * the read is for one branch (`?branch=`, else the caller's own: the panel
 * Tuzla, LafPOS its `LAFPOS_BRANCHES`) and says which (`branch`); each
 * item's `isActive` is "sold at that branch", `onMenu` the site's own flag,
 * `updatedAt` the later of the item's stamp and the branch's. A write's
 * `isActive` (`branch` in the body, the same default) writes that branch's
 * "Satışta / Tükendi" only; prices stay one for every branch. Opening an
 * item the site took off the menu: the panel puts it back on the menu,
 * LafPOS gets 409 `{error:"site_closed", item}`.
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

type BranchView = MenuItemPanelView & { onMenu: boolean };

function shape(item: BranchView) {
  return toPanelMenuItem(
    item,
    MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey,
  );
}

/** One item and its branch's row, as that branch sees it; null when gone. */
async function readAtBranch(
  id: string,
  branch: string,
): Promise<{ view: BranchView; row: BranchAvailability | null } | null> {
  const [item, row] = await Promise.all([
    getMenuItemForPanel(id),
    getBranchAvailability(id, branch),
  ]);
  return item ? { view: itemAtBranch(item, row), row } : null;
}

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "GET", url, "");
  if (!caller) return deny(401, "unauthorized");
  const choice = chooseBranch(
    process.env,
    caller,
    url.searchParams.get("branch"),
  );
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }
  const { branch } = choice;
  // Stamped before the read, like the orders route: a write that lands
  // while the list is read is after `now`, so the panel does not take the
  // list's older value for that write's.
  const now = new Date();
  let items: BranchView[];
  try {
    // The panel's columns only: never the photos (up to 2 MB each).
    const [all, rows] = await Promise.all([
      listMenuItemsForPanel(),
      listBranchAvailability(branch),
    ]);
    items = all.map((item) => itemAtBranch(item, rows.get(item.id)));
  } catch (err) {
    console.error("[panel-menu] menu could not be read", err);
    return deny(503, "unavailable");
  }
  return NextResponse.json(
    {
      version: PANEL_MENU_VERSION,
      now: now.toISOString(),
      branch,
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
  const split = splitBranch(raw);
  const parsed = parsePanelMenuChange(split.rest);
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
  const choice = chooseBranch(process.env, caller, split.branch);
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }
  const { branch } = choice;

  try {
    const read = await readAtBranch(change.id, branch);
    if (!read) return deny(404, "not_found");
    const { view, row } = read;
    // The site closed the L size; a stale panel may not open it again.
    if (opensLargeSize(view, saleFieldsOf(change))) {
      return deny(409, "single_size");
    }
    const fields = changedSaleFields(view, saleFieldsOf(change));
    // Nothing to change: the answer is the item as it is, whatever `expect`
    // says (the panel's "already sold out" rests on this 200).
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ item: shape(view) }, { headers: NO_STORE });
    }
    // A field the writer would change moved here after it read it: its
    // older view does not go over the newer value.
    if (staleSaleFields(view, fields, change.expect).length > 0) {
      return deny(409, "stale", { item: shape(view) });
    }
    const { isActive, ...prices } = fields;
    const availability =
      isActive === undefined
        ? ({ kind: "none" } as const)
        : planAvailabilityWrite(
            { onMenu: view.onMenu, branchRow: row },
            isActive,
            caller,
          );
    // Before any write: a refused half leaves the other half unwritten.
    if (availability.kind === "site_closed") {
      return deny(409, "site_closed", { item: shape(view) });
    }
    const actor = panelAuditActor(change.actor, caller);

    // The prices: every branch's, the item's own columns as before. With
    // `expect`, conditional on the expected ones; without (an older panel),
    // today's plain UPDATE.
    if (Object.keys(prices).length > 0) {
      const guard = saleWriteGuard(view, prices, change.expect);
      const next = guard
        ? await setMenuItemSaleFields(change.id, prices, guard)
        : await setMenuItemSaleFields(change.id, prices);
      if (!next) return await staleOrGone(change.id, branch);
    }
    // "Satışta / Tükendi": the branch's own row; the panel's reopen puts
    // the item back on the menu first.
    if (availability.kind === "reopen") {
      const next = await setMenuItemSaleFields(
        change.id,
        { isActive: true },
        { isActive: false },
      );
      if (!next) return await staleOrGone(change.id, branch);
    }
    const rowTo =
      availability.kind === "branch"
        ? availability.isActive
        : availability.kind === "reopen" && row && !row.isActive
          ? true
          : null;
    if (rowTo !== null) {
      const written = await writeBranchAvailability(
        change.id,
        branch,
        rowTo,
        actor,
        row,
      );
      if (!written.ok) return await staleOrGone(change.id, branch);
    }

    // From here on the write is done: nothing below may turn it into an
    // error, or the panel would keep its old value beside the site's new
    // one. The mark and the audit row never throw.
    if (changesPrice(fields)) await markMenuPricesChanged(new Date());
    const after = await readAtBranch(change.id, branch).catch(() => null);
    const item = after?.view ?? {
      ...view,
      ...prices,
      ...(isActive !== undefined ? { isActive } : {}),
    };
    await safeAudit({
      action: "update",
      entity: "menu_item",
      entityId: change.id,
      actor,
      payload: {
        name: item.name,
        ...fields,
        ...(isActive !== undefined ? { branch } : {}),
        ...(availability.kind === "reopen" ? { onMenu: true } : {}),
        via: caller,
      },
    });
    return NextResponse.json({ item: shape(item) }, { headers: NO_STORE });
  } catch (err) {
    console.error("[panel-menu] change could not be written", err);
    return deny(503, "unavailable");
  }
}

/**
 * A conditional write that touched nothing: the item moved in between
 * (409 `stale` with the item as it now is) or is gone (404).
 */
async function staleOrGone(id: string, branch: string) {
  const now = await readAtBranch(id, branch);
  return now
    ? deny(409, "stale", { item: shape(now.view) })
    : deny(404, "not_found");
}
