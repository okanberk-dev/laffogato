import { NextResponse } from "next/server";

import { safeAudit } from "@/lib/admin/audit";
import {
  getBranchAvailability,
  listBranchAvailability,
  writeBranchAvailability,
} from "@/lib/admin/menu-availability";
import {
  deleteFutureBranchPrice,
  insertBranchPrice,
  listBranchPrices,
} from "@/lib/admin/menu-branch-prices";
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
  type PanelMenuChange,
} from "@/lib/panel/menu-link-core";
import {
  branchPricesByItem,
  branchPriceTimeProblem,
  nextPriceAt,
  sameBranchPrice,
  toPanelBranchPrice,
  withBranchPrice,
  type BranchPriceRow,
  type BranchPriceWrite,
} from "@/lib/panel/branch-prices-core";
import { chooseBranch, HOME_BRANCH, splitBranch } from "@/lib/panel/branches";
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
import { OPTION_MENU_ITEM_IDS } from "@/lib/mobile/customization";

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
 * "Satışta / Tükendi" only. `priceMinor` / `priceMinorL` write the item's
 * own columns, the base price (the home branch's, and every branch's
 * without a price of its own); a branch's own price is a `branchPrice`
 * row (below). Opening an item the site took off the menu: the panel puts
 * it back on the menu, LafPOS gets 409 `{error:"site_closed", item}`.
 *
 * Şube fiyatı since 23 Kas 2026 (branch-prices-core.ts): a read for a
 * branch other than the home branch gives each item's price in force there
 * now (`priceMinor` / `priceMinorL`) beside its base price
 * (`basePriceMinor` / `basePriceMinorL`) and since when (`priceFrom`), and
 * the branch's next price instant (`nextPriceAt`, null for none). The home
 * branch's read is the base price, as before. The panel's read, for any
 * branch, also carries every branch's rows (`branchPrices`). The panel
 * writes one with `branchPrice: {priceMinor, priceMinorL?, effectiveFrom}`
 * (or takes back one not yet in force: `{effectiveFrom, cancel: true}`),
 * alone, for a branch other than home; LafPOS may not (403). The answer to
 * any write for such a branch shows the item as that branch's read does.
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

/**
 * An item in the read's shape for `branch`: at a branch other than home,
 * priced as there at `now` from its rows there (`withBranchPrice`). The
 * write's rules (`changedSaleFields`, `expect`) stay on the base view: the
 * item's own columns are what they guard.
 */
function shape(
  item: BranchView,
  branch: string,
  prices: readonly BranchPriceRow[],
  now: Date = new Date(),
) {
  return toPanelMenuItem(
    branch === HOME_BRANCH ? item : withBranchPrice(item, prices, now),
    MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey,
  );
}

interface AtBranch {
  view: BranchView;
  row: BranchAvailability | null;
  /** The item's own rows at the branch (none read at home). */
  prices: BranchPriceRow[];
}

/** One item and its branch's rows, as that branch sees it; null when gone. */
async function readAtBranch(
  id: string,
  branch: string,
): Promise<AtBranch | null> {
  const [item, row, prices] = await Promise.all([
    getMenuItemForPanel(id),
    getBranchAvailability(id, branch),
    branch === HOME_BRANCH
      ? Promise.resolve([] as BranchPriceRow[])
      : listBranchPrices(branch, [id]),
  ]);
  return item ? { view: itemAtBranch(item, row), row, prices } : null;
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
  const home = branch === HOME_BRANCH;
  let items: BranchView[];
  let priceRows: BranchPriceRow[];
  try {
    // The panel's columns only: never the photos (up to 2 MB each). The
    // branch's own prices (none at home); the panel gets every branch's.
    const [all, rows, branchPrices] = await Promise.all([
      listMenuItemsForPanel(),
      listBranchAvailability(branch),
      caller === "panel"
        ? listBranchPrices()
        : home
          ? Promise.resolve([] as BranchPriceRow[])
          : listBranchPrices(branch),
    ]);
    items = all.map((item) => itemAtBranch(item, rows.get(item.id)));
    priceRows = branchPrices;
  } catch (err) {
    console.error("[panel-menu] menu could not be read", err);
    return deny(503, "unavailable");
  }
  const here = priceRows.filter((r) => r.branch === branch);
  const byItem = branchPricesByItem(here);
  return NextResponse.json(
    {
      version: PANEL_MENU_VERSION,
      now: now.toISOString(),
      branch,
      items: sortForPanelMenu(
        items.map((item) =>
          shape(item, branch, byItem.get(item.id) ?? [], now),
        ),
        MENU_CATEGORY_KEYS,
      ),
      writes: PANEL_MENU_WRITES,
      // Nothing is written at that instant: LafPOS syncs its menu then.
      ...(home ? {} : { nextPriceAt: nextPriceAt(here, now) }),
      ...(caller === "panel"
        ? {
            branchPrices: priceRows
              .filter((r) => r.branch !== HOME_BRANCH)
              .map(toPanelBranchPrice),
          }
        : {}),
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
          : change.branchPrice !== undefined
            ? "branchPrice"
            : null;
    if (priceField) return deny(403, "forbidden", { field: priceField });
  }
  const choice = chooseBranch(process.env, caller, split.branch);
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }
  const { branch } = choice;
  if (change.branchPrice) {
    return writeBranchPrice(change, change.branchPrice, branch, caller);
  }

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
      return NextResponse.json(
        { item: shape(view, branch, read.prices) },
        { headers: NO_STORE },
      );
    }
    // A field the writer would change moved here after it read it: its
    // older view does not go over the newer value.
    if (staleSaleFields(view, fields, change.expect).length > 0) {
      return deny(409, "stale", { item: shape(view, branch, read.prices) });
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
      return deny(409, "site_closed", {
        item: shape(view, branch, read.prices),
      });
    }
    const actor = panelAuditActor(change.actor, caller);

    // The prices: the item's own columns (the base price: the home
    // branch's, and every branch's without a row of its own) as before.
    // With `expect`, conditional on the expected ones; without (an older
    // panel), today's plain UPDATE.
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
    return NextResponse.json(
      { item: shape(item, branch, after?.prices ?? read.prices) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[panel-menu] change could not be written", err);
    return deny(503, "unavailable");
  }
}

/**
 * `branchPrice`: the panel sets a branch's own price from an instant on, or
 * takes back one not yet in force (branch-prices-core.ts). In this order:
 * the branch (not home: the home branch's price is the item's own), the
 * item (not an option's: those price the app's and the till's options for
 * every branch), the instant (a new row: at most five minutes ago, at most
 * 90 days ahead), the item itself (404), the site's sizes (an L for a
 * single-size item: 409 `single_size`). The answer: the item as the
 * branch's read shows it and its rows there (`branchPrices`).
 *
 * A new row the site already holds exactly (same instant, M and L): the
 * same write sent again, its first answer lost (the panel's request timed
 * out after the row landed). Nothing is written or audited and the answer
 * is the success one. A different row at that instant, or a cancel of a
 * row that is not there or already in force: 409 `stale` with the item as
 * the branch sees it and its rows there (`branchPrices`), so the panel
 * sees what the site holds.
 *
 * The base price, "Satışta / Tükendi" and the price list's date
 * (`menuPricesChangedAt`, Tuzla's printed list) are not touched.
 */
async function writeBranchPrice(
  change: PanelMenuChange,
  write: BranchPriceWrite,
  branch: string,
  caller: SignedCaller,
) {
  if (branch === HOME_BRANCH) {
    return deny(400, "invalid", { field: "branch" });
  }
  if (OPTION_MENU_ITEM_IDS.includes(change.id)) {
    return deny(400, "invalid", { field: "id" });
  }
  const now = new Date();
  if (
    !write.cancel &&
    branchPriceTimeProblem(write.effectiveFrom, now, false)
  ) {
    return deny(400, "invalid", { field: "branchPrice.effectiveFrom" });
  }
  try {
    const read = await readAtBranch(change.id, branch);
    if (!read) return deny(404, "not_found");
    const actor = panelAuditActor(change.actor, caller);
    const held = read.prices.find(
      (r) => r.effectiveFrom === write.effectiveFrom,
    );
    // The item's rows after the write, should the re-read below fail.
    let rowsAfter: BranchPriceRow[];
    if (write.cancel) {
      if (!held || branchPriceTimeProblem(write.effectiveFrom, now, true)) {
        return branchPriceStale(read, branch);
      }
      const deleted = await deleteFutureBranchPrice(
        change.id,
        branch,
        write.effectiveFrom,
        now,
      );
      if (!deleted) return await branchPriceSettled(change.id, branch);
      rowsAfter = read.prices.filter(
        (r) => r.effectiveFrom !== write.effectiveFrom,
      );
    } else {
      // Only the site opens an L size, at every branch at once.
      if (write.priceMinorL > 0 && !(read.view.priceMinorL > 0)) {
        return deny(409, "single_size");
      }
      if (held) {
        return sameBranchPrice(held, write)
          ? branchPriceAnswer(read.view, branch, read.prices)
          : branchPriceStale(read, branch);
      }
      const written = await insertBranchPrice({
        menuItemId: change.id,
        branch,
        priceMinor: write.priceMinor,
        priceMinorL: write.priceMinorL,
        effectiveFrom: write.effectiveFrom,
        createdAt: now.toISOString(),
        createdBy: actor,
      });
      if (!written.ok) {
        // "stale": a row at that instant landed in between (the same
        // write sent twice at once, or another).
        return written.reason === "gone"
          ? deny(404, "not_found")
          : await branchPriceSettled(change.id, branch, write);
      }
      rowsAfter = [...read.prices, written.row];
    }

    // From here on the write is done (as in POST above).
    const after = await readAtBranch(change.id, branch).catch(() => null);
    await safeAudit({
      action: "update",
      entity: "menu_item",
      entityId: change.id,
      actor,
      payload: {
        name: (after?.view ?? read.view).name,
        branch,
        branchPrice: write,
        via: caller,
      },
    });
    return branchPriceAnswer(
      after?.view ?? read.view,
      branch,
      after?.prices ?? rowsAfter,
    );
  } catch (err) {
    console.error("[panel-menu] branch price could not be written", err);
    return deny(503, "unavailable");
  }
}

/** A `branchPrice` answer: the item as the branch reads it, and its rows there. */
function branchPriceAnswer(
  view: BranchView,
  branch: string,
  prices: readonly BranchPriceRow[],
) {
  return NextResponse.json(
    {
      item: shape(view, branch, prices),
      branchPrices: prices.map(toPanelBranchPrice),
    },
    { headers: NO_STORE },
  );
}

/** A refused `branchPrice`: 409 `stale` with the item and its rows there. */
function branchPriceStale(read: AtBranch, branch: string) {
  return deny(409, "stale", {
    item: shape(read.view, branch, read.prices),
    branchPrices: read.prices.map(toPanelBranchPrice),
  });
}

/**
 * A `branchPrice` write the table did not take (a row at that instant
 * landed in between, or the row to cancel left): read again. The row this
 * write would add, there exactly: the same write, answered as a success
 * (the request that wrote it audited it). Else 409 `stale` with the rows
 * the site holds, or 404 when the item is gone.
 */
async function branchPriceSettled(
  id: string,
  branch: string,
  write?: Extract<BranchPriceWrite, { cancel: false }>,
) {
  const now = await readAtBranch(id, branch);
  if (!now) return deny(404, "not_found");
  const held = write
    ? now.prices.find((r) => r.effectiveFrom === write.effectiveFrom)
    : undefined;
  return held && write && sameBranchPrice(held, write)
    ? branchPriceAnswer(now.view, branch, now.prices)
    : branchPriceStale(now, branch);
}

/**
 * A conditional write that touched nothing: the item moved in between
 * (409 `stale` with the item as it now is) or is gone (404).
 */
async function staleOrGone(id: string, branch: string) {
  const now = await readAtBranch(id, branch);
  return now
    ? deny(409, "stale", { item: shape(now.view, branch, now.prices) })
    : deny(404, "not_found");
}
