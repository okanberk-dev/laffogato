import type { SignedCaller } from "./signed-callers";

/**
 * "Satışta / Tükendi" per branch (21 Kas 2026; the owner's decision of
 * 4 Kas 2026, lafmaliyet docs/SUBE.md; db/migrations/
 * 20261121150719_branches.sql, docs/PANEL-MENU.md "Şube").
 *
 * Two flags make an item sold at a branch:
 *
 * - `menu_items."isActive"`, **on the menu** at all (`onMenu` below): the
 *   site's own menu form and list write it, for every branch at once.
 * - the branch's row in `menu_item_availability`, if it has one: that
 *   branch's "Tükendi" (false) or "Satışta" (true). No row is "Satışta".
 *
 * The signed callers write the second one only, for the branch they act
 * for (branches.ts): Tuzla's barista closing the cheesecake on the köşk's
 * panel no longer closes it at Marina's till, and Marina's till running
 * out of tiramisu no longer takes it off Tuzla's app and QR menu. One
 * exception keeps what the panel could do before: the panel (the owner's
 * back office) opening an item the site took off the menu puts it back on
 * the menu. LafPOS may not (409 `site_closed`): a café machine does not
 * put back what the site or another branch's manager took off.
 *
 * Pure: the routes, the store's loaders and the tests share it.
 */

/** A branch's own row. */
export interface BranchAvailability {
  menuItemId: string;
  branch: string;
  isActive: boolean;
  /** The branch's own stamp, ISO text. */
  updatedAt: string;
  /** "panel:<name>" or "lafpos:<name>", the audit actor of the last write. */
  updatedBy: string;
}

/** The later of two ISO stamps ("" is earliest). */
export function laterStamp(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return tb > ta ? b : a;
  return b > a ? b : a;
}

/** Whether an item is sold at the branch whose row (if any) is `row`. */
export function soldAtBranch(
  item: { isActive: boolean },
  row: Pick<BranchAvailability, "isActive"> | null | undefined,
): boolean {
  return item.isActive && (row ? row.isActive : true);
}

/**
 * A stored item as one branch sees it: `isActive` is "sold here",
 * `onMenu` the site's own flag, and `updatedAt` the later of the item's
 * stamp and the branch's, so a change at another branch does not move it
 * (the köşk panel's sold-out card keys on it: lafmaliyet
 * src/lib/site-menu/sold-out.ts `markerValid`).
 */
export function itemAtBranch<
  T extends { isActive: boolean; updatedAt: string },
>(
  item: T,
  row: BranchAvailability | null | undefined,
): T & { onMenu: boolean } {
  return {
    ...item,
    onMenu: item.isActive,
    isActive: soldAtBranch(item, row),
    updatedAt: laterStamp(item.updatedAt, row?.updatedAt ?? ""),
  };
}

/** The items sold at a branch, given that branch's rows by item id. */
export function itemsSoldAtBranch<T extends { id: string; isActive: boolean }>(
  items: readonly T[],
  rows: ReadonlyMap<string, Pick<BranchAvailability, "isActive">>,
): T[] {
  return items.filter((it) => soldAtBranch(it, rows.get(it.id)));
}

/** What a signed "Satışta / Tükendi" write does. */
export type AvailabilityWrite =
  /** Already so at this branch: nothing is written. */
  | { kind: "none" }
  /** The branch's own row, to `isActive`. */
  | { kind: "branch"; isActive: boolean }
  /** The panel puts an item the site took off back on the menu (and the branch's row, if closed). */
  | { kind: "reopen" }
  /** LafPOS asked to open an item the site took off the menu: 409 `site_closed`. */
  | { kind: "site_closed" };

export function planAvailabilityWrite(
  current: {
    onMenu: boolean;
    branchRow: Pick<BranchAvailability, "isActive"> | null;
  },
  wanted: boolean,
  caller: SignedCaller,
): AvailabilityWrite {
  const branchOpen = current.branchRow ? current.branchRow.isActive : true;
  if (!wanted) {
    return current.onMenu && branchOpen
      ? { kind: "branch", isActive: false }
      : { kind: "none" };
  }
  if (!current.onMenu) {
    return caller === "panel" ? { kind: "reopen" } : { kind: "site_closed" };
  }
  return branchOpen ? { kind: "none" } : { kind: "branch", isActive: true };
}

/**
 * The site panel's view of an item's branches (Kafe menüsü): the branches
 * whose row says "Tükendi", in `order`.
 */
export function soldOutBranches(
  rows: readonly Pick<BranchAvailability, "branch" | "isActive">[],
  order: readonly string[],
): string[] {
  const closed = new Set(rows.filter((r) => !r.isActive).map((r) => r.branch));
  return [
    ...order.filter((b) => closed.has(b)),
    ...[...closed].filter((b) => !order.includes(b)).sort(),
  ];
}
