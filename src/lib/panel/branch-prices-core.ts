import { z } from "zod";

import { CATALOG_MONEY_MAX_MINOR } from "@/lib/utils/format";

/**
 * Şube fiyatı: a menu item's selling price at one branch (23 Kas 2026; the
 * owner's decision of 4 Kas 2026, lafmaliyet docs/SUBE.md, approved for
 * build on 23 Kas 2026; db/migrations/20261123180000_menu_item_branch_prices.sql,
 * docs/PANEL-MENU.md "Şube fiyatı").
 *
 * `menu_items."priceMinor"` / `"priceMinorL"` stay the base price: the
 * site's pages, the app's menu and every order at the home branch (Tuzla)
 * charge it, and so does another branch until it has a price of its own.
 * A branch's own price is a row in `menu_item_branch_prices`, written by the
 * köşk's panel (lafmaliyet Fiyatlar, signed `POST /api/panel/menu`
 * `branchPrice`) for an instant: "from 25 Kas 05:00, Marina's latte is
 * 145 / 165 TL". The rows are append-only: a row is the branch's price from
 * its `effectiveFrom` until the next row's, so the table is its own history
 * (lafmaliyet's "Eski fiyattan satılanlar" report reads it). Only a row
 * still in the future may be taken back (cancel); one in force is replaced
 * by a newer row. `priceMinor: null` is "from then on, the base price
 * again".
 *
 * The sizes are the site's: an item the site keeps single-size (L 0) has no
 * L at any branch; a row with no L of its own (0) keeps the base L.
 *
 * Pure: the routes, the store's loaders and the tests share it.
 */

/** A stored row (the table's columns). */
export interface BranchPriceRow {
  menuItemId: string;
  branch: string;
  /** Kuruş, KDV included: M or the only size; null = the base price again. */
  priceMinor: number | null;
  /** Kuruş, KDV included: L; 0 = the base L (or none, for a single size). */
  priceMinorL: number;
  /** ISO-8601 UTC (`toISOString`), so text order is time order. */
  effectiveFrom: string;
  createdAt: string;
  /** "panel:<name>", the audit actor. Never leaves the site. */
  createdBy: string;
}

/** What pricing needs of a row. */
export type BranchPriceRule = Pick<
  BranchPriceRow,
  "priceMinor" | "priceMinorL" | "effectiveFrom"
>;

/** An item's price at a branch at an instant. */
export interface PriceAtBranch {
  priceMinor: number;
  priceMinorL: number;
  /** The branch row in force, or null when the base price is. */
  from: string | null;
}

/** A new row may start at most this long ago (clock skew between the two sites). */
export const BRANCH_PRICE_PAST_SLACK_MS = 5 * 60_000;

/** And at most this far ahead. */
export const BRANCH_PRICE_MAX_AHEAD_MS = 90 * 24 * 60 * 60_000;

function at(instant: string): number {
  const ms = Date.parse(instant);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** The row in force at `when`: the latest whose `effectiveFrom` is not after it. */
function ruleAt<T extends BranchPriceRule>(
  rows: readonly T[] | undefined,
  when: Date,
): T | null {
  const now = when.getTime();
  let best: T | null = null;
  for (const r of rows ?? []) {
    if (at(r.effectiveFrom) > now) continue;
    if (!best || at(r.effectiveFrom) > at(best.effectiveFrom)) best = r;
  }
  return best;
}

/**
 * An item's price at a branch at `when`, given that item's rows at that
 * branch (any order). No row in force, or a `null` one: the base price.
 */
export function priceAtBranch(
  item: { priceMinor: number; priceMinorL: number },
  rows: readonly BranchPriceRule[] | undefined,
  when: Date,
): PriceAtBranch {
  const baseL = item.priceMinorL > 0 ? item.priceMinorL : 0;
  const rule = ruleAt(rows, when);
  if (!rule || rule.priceMinor === null) {
    return { priceMinor: item.priceMinor, priceMinorL: baseL, from: null };
  }
  return {
    priceMinor: rule.priceMinor,
    // The site's sizes: closed there, closed here; no L of the row's own,
    // the base L.
    priceMinorL:
      baseL > 0 ? (rule.priceMinorL > 0 ? rule.priceMinorL : baseL) : 0,
    from: rule.effectiveFrom,
  };
}

/**
 * A stored item as a branch's signed read shows it: `priceMinor` /
 * `priceMinorL` the price in force there now, beside the base price and
 * since when the branch's own holds (`priceFrom`, null on the base price).
 */
export function withBranchPrice<
  T extends { priceMinor: number; priceMinorL: number },
>(
  item: T,
  rows: readonly BranchPriceRule[] | undefined,
  when: Date,
): T & {
  basePriceMinor: number;
  basePriceMinorL: number;
  priceFrom: string | null;
} {
  const price = priceAtBranch(item, rows, when);
  return {
    ...item,
    priceMinor: price.priceMinor,
    priceMinorL: price.priceMinorL,
    basePriceMinor: item.priceMinor,
    basePriceMinorL: item.priceMinorL > 0 ? item.priceMinorL : 0,
    priceFrom: price.from,
  };
}

/** The rows by item id. */
export function branchPricesByItem<T extends { menuItemId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const list = out.get(r.menuItemId);
    if (list) list.push(r);
    else out.set(r.menuItemId, [r]);
  }
  return out;
}

/**
 * The next instant a price changes at the branch whose rows these are (any
 * item): the earliest `effectiveFrom` after `now`, or null. Nothing is
 * written at that instant, so nothing expires a cache or moves a marker:
 * LafPOS syncs its menu then (`nextPriceAt` of the signed read), and the
 * app's menu remembers its ETag only until then (`validUntil`).
 */
export function nextPriceAt(
  rows: readonly Pick<BranchPriceRow, "effectiveFrom">[],
  now: Date,
): string | null {
  const t = now.getTime();
  let next: string | null = null;
  for (const r of rows) {
    const ms = at(r.effectiveFrom);
    if (ms <= t || !Number.isFinite(ms)) continue;
    if (next === null || ms < at(next)) next = r.effectiveFrom;
  }
  return next;
}

/**
 * The latest instant at or before `now` at which a branch's price changed
 * ("" when none has): a cached view of the branch's prices is good while
 * this stays the same, so it is part of the cache key (site-data.ts
 * `listSiteMenu`).
 */
export function priceEpoch(
  rows: readonly Pick<BranchPriceRow, "effectiveFrom">[],
  now: Date,
): string {
  return (
    ruleAt(
      rows.map((r) => ({ ...r, priceMinor: 0, priceMinorL: 0 })),
      now,
    )?.effectiveFrom ?? ""
  );
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * An instant from a request, as stored: ISO-8601 with its offset (`Z` or
 * `+03:00`; one without is ambiguous between the panel's Istanbul and the
 * server's UTC), a real calendar day, normalised to `toISOString`. Null
 * otherwise.
 */
export function normalizeInstant(raw: string): string | null {
  if (!ISO_INSTANT.test(raw)) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  // Date.parse rolls 30 Feb over to March; the day written must exist.
  const [y, m, d] = raw.slice(0, 10).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return null;
  return new Date(ms).toISOString();
}

/**
 * Why a row's instant may not be written now, or null. A new row: at most
 * `BRANCH_PRICE_PAST_SLACK_MS` ago (no price is set for the past: sales
 * already rung stay as they were) and at most `BRANCH_PRICE_MAX_AHEAD_MS`
 * ahead. A cancel: only a row not yet in force.
 */
export function branchPriceTimeProblem(
  effectiveFrom: string,
  now: Date,
  cancel: boolean,
): "past" | "too_far" | "in_effect" | null {
  const ms = at(effectiveFrom);
  const t = now.getTime();
  if (cancel) return ms > t ? null : "in_effect";
  if (ms < t - BRANCH_PRICE_PAST_SLACK_MS) return "past";
  if (ms > t + BRANCH_PRICE_MAX_AHEAD_MS) return "too_far";
  return null;
}

/** A `branchPrice` write, parsed. */
export type BranchPriceWrite =
  | {
      cancel: false;
      priceMinor: number | null;
      priceMinorL: number;
      effectiveFrom: string;
    }
  | { cancel: true; effectiveFrom: string };

const money = (min: number) =>
  z.number().int().min(min).max(CATALOG_MONEY_MAX_MINOR);

/**
 * `branchPrice` of `POST /api/panel/menu`: `{priceMinor, priceMinorL?,
 * effectiveFrom}` (a new row; `priceMinor` null = the base price again) or
 * `{effectiveFrom, cancel: true}` (take back a row not yet in force).
 * Strict, like the rest of the write.
 */
export const branchPriceSchema = z
  .object({
    priceMinor: money(1).nullable().optional(),
    priceMinorL: money(0).optional(),
    effectiveFrom: z.string().max(40),
    cancel: z.boolean().optional(),
  })
  .strict();

/**
 * Parses a raw `branchPrice`. On a refusal, the field that broke a rule as
 * `branchPrice.<key>` ("branchPrice" for the object itself).
 */
export function parseBranchPriceWrite(
  raw: unknown,
): { ok: true; write: BranchPriceWrite } | { ok: false; field: string } {
  const parsed = branchPriceSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    return {
      ok: false,
      field:
        typeof key === "string" && issue?.code !== "unrecognized_keys"
          ? `branchPrice.${key}`
          : "branchPrice",
    };
  }
  const b = parsed.data;
  const effectiveFrom = normalizeInstant(b.effectiveFrom);
  if (b.cancel !== undefined) {
    if (
      b.cancel !== true ||
      b.priceMinor !== undefined ||
      b.priceMinorL !== undefined
    ) {
      return { ok: false, field: "branchPrice.cancel" };
    }
    if (!effectiveFrom)
      return { ok: false, field: "branchPrice.effectiveFrom" };
    return { ok: true, write: { cancel: true, effectiveFrom } };
  }
  if (b.priceMinor === undefined) {
    return { ok: false, field: "branchPrice.priceMinor" };
  }
  const priceMinorL = b.priceMinorL ?? 0;
  // Back to the base price: both sizes, so no L of its own.
  if (b.priceMinor === null && priceMinorL !== 0) {
    return { ok: false, field: "branchPrice.priceMinorL" };
  }
  if (!effectiveFrom) return { ok: false, field: "branchPrice.effectiveFrom" };
  return {
    ok: true,
    write: {
      cancel: false,
      priceMinor: b.priceMinor,
      priceMinorL,
      effectiveFrom,
    },
  };
}

/**
 * Whether a stored row is exactly what a new-row write would add: the same
 * instant and the same M and L. The row being there already is then the
 * same write landing twice (a re-send whose first answer was lost), which
 * the route answers as a success; a different price at that instant is
 * another write (409 `stale`). The item and branch are the caller's to
 * match.
 */
export function sameBranchPrice(
  row: BranchPriceRule,
  write: Extract<BranchPriceWrite, { cancel: false }>,
): boolean {
  return (
    row.effectiveFrom === write.effectiveFrom &&
    row.priceMinor === write.priceMinor &&
    row.priceMinorL === write.priceMinorL
  );
}

/** A row as the panel reads it (`branchPrices` of the signed read). */
export interface PanelBranchPrice {
  id: string;
  branch: string;
  priceMinor: number | null;
  priceMinorL: number;
  effectiveFrom: string;
  createdAt: string;
}

/** The whitelist: the writer's name stays in the site's audit log. */
export function toPanelBranchPrice(row: BranchPriceRow): PanelBranchPrice {
  return {
    id: row.menuItemId,
    branch: row.branch,
    priceMinor: row.priceMinor,
    priceMinorL: row.priceMinorL,
    effectiveFrom: row.effectiveFrom,
    createdAt: row.createdAt,
  };
}
