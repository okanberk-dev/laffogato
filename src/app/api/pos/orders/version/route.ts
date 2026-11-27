import { NextResponse } from "next/server";

import {
  newChangeMarker,
  readBranchMarker,
  readPosKaraokeMarker,
  readPosMenuMarker,
  readPosOrdersMarker,
} from "@/lib/admin/change-marker";
import { listBranchAvailability } from "@/lib/admin/menu-availability";
import { listBranchPrices } from "@/lib/admin/menu-branch-prices";
import { listMenuItemsForPanel } from "@/lib/admin/store";
import { TAG_MENU, TAG_ORDERS } from "@/lib/cache/tags";
import type { BranchPriceRow } from "@/lib/panel/branch-prices-core";
import { chooseBranch, HOME_BRANCH } from "@/lib/panel/branches";
import { digestOf, panelOrdersDigest } from "@/lib/panel/orders-feed";
import {
  signedBy,
  signedCallerKeys,
  signedKeyHeader,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/pos/orders/version` - LafPOS, the till server inside the café,
 * asking whether the online orders changed (docs/LAFPOS.md). It asks every
 * 20 seconds and pulls `GET /api/panel/orders` only when the answer differs
 * from the last one, so an app order reaches the bar screen within half a
 * minute while the database (Neon, free plan) still sleeps between orders.
 *
 * `{ "version": "<text>" }` stands on a change marker
 * (src/lib/admin/change-marker.ts): a random token kept in the Next Data
 * Cache under `live:orders`. A cache miss makes a new token, and every
 * write that expires `live:orders` (the data layer's write hook,
 * src/lib/db/index.ts) makes the next ask a miss, so the marker moves when
 * an order is placed, paid, moved on or refunded; the branch's value under
 * it (below) moves when that branch's list does. It carries no data and
 * means only "same as before" or "not". While the marker stands the
 * database is not read.
 *
 * `karaoke` beside it is the same kind of marker under `live:karaoke`
 * alone: it moves when a karaoke booking is made, paid, confirmed, moved or
 * cancelled, and LafPOS then pulls `GET /api/panel/karaoke` for its room
 * box. An order does not move it, a booking does not move `version`. Added
 * to the answer, not swapped in: a LafPOS that reads only `version` is
 * unchanged.
 *
 * `menu` is the same kind of marker under `pub:menu`: it moves when a menu
 * item's price or state is written (the menu form, the panel's POST
 * /api/panel/menu, LafPOS's own "Tükendi"), and LafPOS then syncs its menu at
 * once, prices from the signed panel list, instead of waiting for its
 * 15-minute poll. Added, not swapped in, like `karaoke`.
 *
 * Per branch (23 Kas 2026): `?branch=`, else the caller's own (LafPOS's
 * `LAFPOS_BRANCHES`, default Marina; src/lib/panel/branches.ts), 400 / 403
 * as the panel routes. The tags are per table, so `live:orders` and
 * `pub:menu` move for every branch's write, and Marina's till pulled its
 * unchanged list after every Tuzla order. `version` and `menu` are now the
 * branch's view of those markers (change-marker.ts `readBranchMarker`): a
 * digest of what the till would read, `GET /api/panel/orders` for the
 * branch (orders-feed.ts `panelOrdersDigest`) and the panel menu's
 * columns with the branch's own "Satışta / Tükendi" rows, read once after
 * the global marker moved and kept under it. Another branch's order, call
 * or Tükendi leaves them as they were; a menu item's own write (price,
 * name, "Menüde") moves `menu` everywhere. While the global markers stand
 * nothing is read, as before. A digest that cannot be read gives the
 * global marker back (pulls on every branch's write, the old behaviour).
 * The menu's digest has the branch's own price rows too (23 Kas 2026,
 * `branchMenuDigest`); a price instant passing writes nothing and moves
 * nothing here: LafPOS syncs then by the read's `nextPriceAt`.
 * `karaoke` stays global: the room is Tuzla's, and another branch's
 * karaoke read is answered without the database.
 *
 * When the cache cannot say (`LAF_DATA_CACHE=off`, a failing cache, or off
 * under test), every answer is a new token: LafPOS then pulls on every ask.
 * A broken cache costs reads, never a missed order, the trade the panel's
 * own markers make.
 *
 * Signed like the panel routes (karaoke-sync-core.ts), with
 * `LAFPOS_SYNC_SECRET` only: the panel's key gets 401 here. No LafPOS key:
 * 503 `not_configured`. Bad, missing or stale signature: 401, nothing more
 * said. `src/proxy.ts` lets every `/api/*` path through untouched.
 *
 * The 200 names the LafPOS value that signed, `x-laf-anahtar: simdiki` or
 * `onceki` (27 Kas 2026; signed-callers.ts `SIGNED_KEY_HEADER`). ladmin
 * checks the value it hands the till here: `onceki` while
 * `LAFPOS_SYNC_SECRET_ONCEKI` is still set means ladmin was not moved to
 * the new value, and deleting the previous one would cut the till off
 * (docs/LAFPOS.md "Anahtarı değiştirmek").
 */

/**
 * A digest of the menu as `branch`'s till reads it from `GET
 * /api/panel/menu`: every item's panel columns (its `updatedAt` moves on
 * every write of the item, photo and text included), the branch's own
 * availability rows and (23 Kas 2026) its own price rows, future ones too:
 * a row the panel writes for tomorrow moves the till's marker now, and the
 * read the till then makes tells it when to sync again (`nextPriceAt`).
 * Another branch's row is not in it. A branch without price rows (the home
 * branch has none) digests as before.
 */
async function branchMenuDigest(branch: string): Promise<string> {
  const [items, rows, prices] = await Promise.all([
    listMenuItemsForPanel(),
    listBranchAvailability(branch),
    branch === HOME_BRANCH
      ? Promise.resolve([] as BranchPriceRow[])
      : listBranchPrices(branch),
  ]);
  const byId = (a: { id: string }, b: { id: string }) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const priceRows = prices
    .map((p) => [p.menuItemId, p.effectiveFrom, p.priceMinor, p.priceMinorL])
    .sort((a, b) => {
      const ka = `${a[0]}|${a[1]}`;
      const kb = `${b[0]}|${b[1]}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return digestOf({
    items: [...items]
      .sort(byId)
      .map((i) => [
        i.id,
        i.name,
        i.categoryKey,
        i.priceMinor,
        i.priceMinorL ?? null,
        i.isActive,
        i.sortOrder,
        i.updatedAt,
      ]),
    branch: [...rows.values()]
      .map((r) => ({ id: r.menuItemId, isActive: r.isActive, at: r.updatedAt }))
      .sort(byId),
    ...(priceRows.length > 0 ? { prices: priceRows } : {}),
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** LafPOS alone: the panel hears of orders by its ping. */
const CALLERS: readonly SignedCaller[] = ["lafpos"];

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  const signer = signedBy(keys, request, "GET", url, "");
  if (!signer) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const { caller } = signer;
  const choice = chooseBranch(
    process.env,
    caller,
    url.searchParams.get("branch"),
  );
  if (!choice.ok) {
    return NextResponse.json(
      { error: choice.error, field: choice.field },
      { status: choice.status, headers: NO_STORE },
    );
  }
  const { branch } = choice;
  const now = new Date();
  // The global markers first, then the branch's digests under them.
  const [ordersMarker, karaoke, menuMarker] = await Promise.all([
    readPosOrdersMarker(),
    readPosKaraokeMarker(),
    readPosMenuMarker(),
  ]);
  const [orders, menu] = await Promise.all([
    ordersMarker
      ? readBranchMarker({
          name: "pos-orders-branch",
          branch,
          marker: ordersMarker,
          tags: [TAG_ORDERS],
          nowMs: now.getTime(),
          digest: () => panelOrdersDigest(branch, now),
        })
      : null,
    menuMarker
      ? readBranchMarker({
          name: "pos-menu-branch",
          branch,
          marker: menuMarker,
          tags: [TAG_MENU],
          nowMs: now.getTime(),
          digest: () => branchMenuDigest(branch),
        })
      : null,
  ]);
  return NextResponse.json(
    {
      version: orders ?? newChangeMarker(),
      karaoke: karaoke ?? newChangeMarker(),
      // No cache: no marker (a fresh token every ask would sync the menu
      // every 20 seconds); LafPOS keeps its 15-minute poll
      ...(menu ? { menu } : {}),
    },
    { headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
  );
}
