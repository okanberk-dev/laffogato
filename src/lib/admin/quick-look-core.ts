// Client-safe (no server-only): a list's quick look (Innex's right drawer,
// innex-15; 23 Eki 2026). The record shown sits in the list's address
// (`?gor=prd-0007`), so the drawer is drawn by the server with the list,
// survives a reload, can be linked to and opens without JavaScript; a row
// opens it and closing it leaves the list as it was.

import { firstParam, withParams, type SearchParamsInput } from "./list-params";

/** `?gor=<id>`: the record a list shows in its drawer. */
export const QUICK_LOOK_PARAM = "gor";

/** The panel's record ids ("prd-0007", "mnu-0012"), never a path or a query. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** The record the address asks to show, or null for none or junk. */
export function parseQuickLook(sp: SearchParamsInput): string | null {
  const raw = firstParam(sp, QUICK_LOOK_PARAM);
  return raw && ID_RE.test(raw) ? raw : null;
}

/**
 * The list's own params, without the drawer: what its tabs, sort, pages
 * and filters are built from (a sort link must not reopen the drawer), and
 * what keys the list (opening a drawer keeps the rows that were ticked).
 */
export function withoutQuickLook<T extends string | string[]>(
  sp: Readonly<Record<string, T>>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (key !== QUICK_LOOK_PARAM) out[key] = value;
  }
  return out;
}

/** A row's link: the list as it is, with `id` in the drawer. */
export function quickLookHref(
  sp: SearchParamsInput,
  pathname: string,
  id: string,
): string {
  return withParams(sp, { [QUICK_LOOK_PARAM]: id }, pathname);
}

/** Closing the drawer: the list as it was. */
export function quickLookCloseHref(
  sp: SearchParamsInput,
  pathname: string,
): string {
  return withParams(sp, { [QUICK_LOOK_PARAM]: null }, pathname);
}

/**
 * Whether two addresses are the same list: the same path and the same
 * params in any order (the address bar and a link built on the server may
 * spell a query differently: `+` or `%20`, another order).
 */
export function sameListAddress(a: string, b: string): boolean {
  const base = "http://panel.invalid";
  let ua: URL;
  let ub: URL;
  try {
    ua = new URL(a, base);
    ub = new URL(b, base);
  } catch {
    return false;
  }
  if (ua.pathname !== ub.pathname) return false;
  const norm = (u: URL) =>
    [...u.searchParams.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
  return norm(ua) === norm(ub);
}

/**
 * How many chips a drawer shows before "Tümünü göster (n)" (Innex's
 * "Show all 8 amenities"): the first `limit`, and the rest behind it. A
 * rest of one is shown whole: a button that reveals one chip is a chip's
 * width of button for nothing.
 */
export function foldChips<T>(
  items: readonly T[],
  limit = 4,
): { shown: readonly T[]; folded: readonly T[] } {
  if (items.length <= limit + 1) return { shown: items, folded: [] };
  return { shown: items.slice(0, limit), folded: items.slice(limit) };
}
