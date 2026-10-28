import { z } from "zod";

import { CATALOG_MONEY_MAX_MINOR } from "@/lib/utils/format";

import type { SignedCaller } from "./signed-callers";

/**
 * The menu link between this site and the köşk's back-office panel
 * (ladmin.laffogato.net, the `lafmaliyet` project): the panel keeps a copy
 * of each linked item's sale price and on-menu state for its cost and
 * waste figures, and an admin there may change them. The site is the one
 * source of both (docs/PANEL-MENU.md):
 *
 * 1. **Ping, site → panel.** A write that expires `pub:menu` sends
 *    `POST /api/menu/ping` to the panel after the response
 *    (src/lib/panel/menu-ping.ts). It carries no item.
 * 2. **Read, panel → site.** `GET /api/panel/menu`: every item, in the
 *    whitelisted shape below.
 * 3. **Write, panel → site.** `POST /api/panel/menu`: one item's price(s)
 *    and/or on-menu state, checked by the same rules as the menu form. The
 *    panel stores its change only after this answers 2xx. With `expect`
 *    (the values the panel's copy holds) a field that moved here meanwhile
 *    is not written over: 409 `stale` with the item as it is
 *    (`staleSaleFields`, docs/PANEL-SENKRON.md).
 *
 * Signed like the karaoke link (src/lib/panel/karaoke-sync-core.ts), with
 * the same secret; LafPOS, the café's till, reads and writes the same way
 * with a key of its own (signed-callers.ts, docs/LAFPOS.md). Pure: the
 * route and the tests share it.
 */

/** The shape's version: the panel refuses a list it does not know. */
export const PANEL_MENU_VERSION = 1;

/** A write's body is a few dozen bytes; anything past this is refused. */
export const PANEL_MENU_MAX_BODY_BYTES = 4096;

/** The panel user's name as the audit row carries it. */
export const PANEL_MENU_ACTOR_MAX = 80;

/**
 * The read's capability flag (`writes` at the top level of
 * `GET /api/panel/menu`): the optional request fields the write takes on
 * top of the first version's. The write's schema is strict, so a field the
 * site does not know is a 400; the panel sends `expect` only after a read
 * that carried `expect: true` (lafmaliyet src/lib/site-menu/schema.ts), and
 * on a 400 whose field is "expect" or "body" it tries once without it.
 * A new optional field joins here in the same change that accepts it.
 */
export const PANEL_MENU_WRITES = { expect: true } as const;

/** One item as the panel reads it: prices, state and what names it. */
export interface PanelMenuItem {
  id: string;
  name: string;
  categoryKey: string;
  categoryLabel: string;
  /** Kuruş, KDV included: M, or the only price. */
  priceMinor: number;
  /** Kuruş, KDV included: L, or 0 for a single-size item. */
  priceMinorL: number;
  /** On the menu ("Satışta"); false is "Tükendi". */
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** The fields of a stored item the panel's shape is made from. */
export interface MenuItemForPanel {
  id: string;
  name: string;
  categoryKey: string;
  priceMinor: number;
  priceMinorL: number;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

/**
 * A stored item in the panel's shape: a whitelist, so a column added to
 * `menu_items` later (a cost, a supplier) does not leave the site unless it
 * is added here on purpose.
 */
export function toPanelMenuItem(
  item: MenuItemForPanel,
  categoryLabel: string,
): PanelMenuItem {
  return {
    id: item.id,
    name: item.name,
    categoryKey: item.categoryKey,
    categoryLabel,
    priceMinor: item.priceMinor,
    priceMinorL: item.priceMinorL > 0 ? item.priceMinorL : 0,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    updatedAt: item.updatedAt,
  };
}

/**
 * The list in the menu's own order: category (the site's order of
 * categories), then Sıra, then name, then id so two calls agree.
 */
export function sortForPanelMenu(
  items: readonly PanelMenuItem[],
  categoryOrder: readonly string[],
): PanelMenuItem[] {
  const rank = new Map(categoryOrder.map((key, i) => [key, i]));
  const at = (key: string) => rank.get(key) ?? categoryOrder.length;
  return [...items].sort(
    (a, b) =>
      at(a.categoryKey) - at(b.categoryKey) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, "tr") ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

const money = (min: number) =>
  z.number().int().min(min).max(CATALOG_MONEY_MAX_MINOR);

/**
 * What the writer last read of the fields it writes: the panel's copy of
 * the item. Any of the three; a value the site's rules would refuse as a
 * new price (an M of 0) may still be one the writer read.
 */
const expectSchema = z
  .object({
    priceMinor: money(0).optional(),
    priceMinorL: money(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/**
 * A write from the panel. Every field but `id` and `actor` is optional and
 * at least one of the three sale fields must be there; what is absent is
 * left as it is. The rules are the menu form's
 * (src/lib/admin/menu-item-schema.ts): whole kuruş, an M price above zero
 * (0 ₺ is a free cup, CAT-05), an L price of 0 for a single-size item, the
 * catalogue's ceiling. `expect` is optional and announced by the read
 * (`PANEL_MENU_WRITES`); a broken one names the field "expect".
 */
export const panelMenuChangeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    priceMinor: money(1).optional(),
    priceMinorL: money(0).optional(),
    isActive: z.boolean().optional(),
    actor: z.string().trim().min(1).max(PANEL_MENU_ACTOR_MAX),
    expect: expectSchema.optional(),
  })
  .strict();

export type PanelMenuChange = z.infer<typeof panelMenuChangeSchema>;

/** The three sale fields a change may carry. */
export type PanelMenuSaleFields = Partial<
  Pick<PanelMenuItem, "priceMinor" | "priceMinorL" | "isActive">
>;

/**
 * Parses a write's raw JSON. On a refusal, the first field that broke a
 * rule (or "body" for a body that is not an object, "fields" when none of
 * the three is there): the panel shows which one.
 */
export function parsePanelMenuChange(
  raw: unknown,
): { ok: true; change: PanelMenuChange } | { ok: false; field: string } {
  const parsed = panelMenuChangeSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { ok: false, field: typeof path === "string" ? path : "body" };
  }
  const c = parsed.data;
  if (
    c.priceMinor === undefined &&
    c.priceMinorL === undefined &&
    c.isActive === undefined
  ) {
    return { ok: false, field: "fields" };
  }
  return { ok: true, change: c };
}

/** The sale fields of a change, without its id and actor. */
export function saleFieldsOf(change: PanelMenuChange): PanelMenuSaleFields {
  const out: PanelMenuSaleFields = {};
  if (change.priceMinor !== undefined) out.priceMinor = change.priceMinor;
  if (change.priceMinorL !== undefined) out.priceMinorL = change.priceMinorL;
  if (change.isActive !== undefined) out.isActive = change.isActive;
  return out;
}

/**
 * Only what differs from the stored item: the write, the audit row and the
 * "prices changed" mark carry real changes only, so the panel re-sending a
 * value it already has writes nothing.
 */
export function changedSaleFields(
  current: Pick<PanelMenuItem, "priceMinor" | "priceMinorL" | "isActive">,
  wanted: PanelMenuSaleFields,
): PanelMenuSaleFields {
  const out: PanelMenuSaleFields = {};
  if (
    wanted.priceMinor !== undefined &&
    wanted.priceMinor !== current.priceMinor
  ) {
    out.priceMinor = wanted.priceMinor;
  }
  if (
    wanted.priceMinorL !== undefined &&
    wanted.priceMinorL !== (current.priceMinorL > 0 ? current.priceMinorL : 0)
  ) {
    out.priceMinorL = wanted.priceMinorL;
  }
  if (wanted.isActive !== undefined && wanted.isActive !== current.isActive) {
    out.isActive = wanted.isActive;
  }
  return out;
}

/**
 * The changed fields (`changedSaleFields`) whose expected value the site no
 * longer holds: someone moved them here (the menu form, another panel tab,
 * LafPOS) after the writer read them, and writing would put the writer's
 * older view over theirs. Only the fields the write would change are
 * checked; a field with no expectation, or none at all, is never stale.
 * The L price compares as the panel reads it (0 for a single size).
 */
export function staleSaleFields(
  current: Pick<PanelMenuItem, "priceMinor" | "priceMinorL" | "isActive">,
  fields: PanelMenuSaleFields,
  expected: PanelMenuSaleFields | undefined,
): Array<keyof PanelMenuSaleFields> {
  if (!expected) return [];
  const out: Array<keyof PanelMenuSaleFields> = [];
  if (
    fields.priceMinor !== undefined &&
    expected.priceMinor !== undefined &&
    expected.priceMinor !== current.priceMinor
  ) {
    out.push("priceMinor");
  }
  if (
    fields.priceMinorL !== undefined &&
    expected.priceMinorL !== undefined &&
    expected.priceMinorL !== (current.priceMinorL > 0 ? current.priceMinorL : 0)
  ) {
    out.push("priceMinorL");
  }
  if (
    fields.isActive !== undefined &&
    expected.isActive !== undefined &&
    expected.isActive !== current.isActive
  ) {
    out.push("isActive");
  }
  return out;
}

/**
 * The write's condition when it carries `expect`: each changed field that
 * has an expectation, at the value the site read a moment ago (which the
 * expectation matched, `staleSaleFields` being empty). The UPDATE then
 * touches the row only if those columns still hold it, so a write landing
 * between the read and this one is not put back either. Null without an
 * expectation for any changed field: the write is unconditional, as before
 * `expect` existed.
 */
export function saleWriteGuard(
  current: Pick<PanelMenuItem, "priceMinor" | "priceMinorL" | "isActive">,
  fields: PanelMenuSaleFields,
  expected: PanelMenuSaleFields | undefined,
): PanelMenuSaleFields | null {
  if (!expected) return null;
  const out: PanelMenuSaleFields = {};
  if (fields.priceMinor !== undefined && expected.priceMinor !== undefined) {
    out.priceMinor = current.priceMinor;
  }
  if (fields.priceMinorL !== undefined && expected.priceMinorL !== undefined) {
    out.priceMinorL = current.priceMinorL;
  }
  if (fields.isActive !== undefined && expected.isActive !== undefined) {
    out.isActive = current.isActive;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Whether a change gives an L price to an item the site keeps single-size.
 * Only the site opens an L size: the panel's copy may be minutes old, and
 * an L price sent from it after the operator closed the size here would
 * open it again. Closing L (0) and moving an open L stay the panel's.
 */
export function opensLargeSize(
  current: Pick<PanelMenuItem, "priceMinorL">,
  wanted: PanelMenuSaleFields,
): boolean {
  return (
    wanted.priceMinorL !== undefined &&
    wanted.priceMinorL > 0 &&
    !(current.priceMinorL > 0)
  );
}

/** Whether a set of changes moves a price (the price list's date then may be stale). */
export function changesPrice(fields: PanelMenuSaleFields): boolean {
  return fields.priceMinor !== undefined || fields.priceMinorL !== undefined;
}

/**
 * The audit row's actor for a change the panel made: `panel:Selin`; one
 * LafPOS made with its own key reads `lafpos:Selin` (docs/LAFPOS.md).
 */
export function panelAuditActor(
  actor: string,
  caller: SignedCaller = "panel",
): string {
  return `${caller}:${actor.trim().slice(0, PANEL_MENU_ACTOR_MAX)}`;
}
