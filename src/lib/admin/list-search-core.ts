// Client-safe and proxy-safe (no server-only, no zod): which panel lists
// keep their typed search out of the address, and how.
//
// What the operator types in a list's search box is an e-mail address or a
// phone number as often as an order number. In `?q=` it sat in the address
// bar, the browser's history, any proxy and the Vercel request log
// (CLAUDE.md security rule 9). Now the box posts to listSearchAction
// (app/admin/liste-arama/actions.ts), which keeps the text in a short-lived
// cookie scoped to the list's own path, and the list reads it from there.
// Everything that is not typed (the tab, a dropdown, the dates, the sort,
// the page) stays in the address, so a filtered view can still be linked,
// reloaded and gone back to; only the text is not part of it, and a saved
// view built from the address (UI-11) cannot hold it either.

import { toSearchParams, type SearchParamsInput } from "./list-params";
import type { AdminSection } from "./roles";

/** A typed search the list keeps out of its address. */
export interface ListSearchParam {
  /** The box's field name (the FilterBar field's `name`). */
  name: string;
  /** Longest text kept: the FilterBar field's `maxLength` (default 100). */
  maxLength: number;
}

export interface ListSearch {
  /** The cookie's suffix: `adm_q_<key>`. */
  key: string;
  /** Who may search this list: the page's own requireRole section. */
  section: AdminSection;
  /**
   * The list's address. A list that belongs to one record (a campaign's
   * send log) gives a pattern instead, and its cookie is scoped to that
   * record's page.
   */
  path: string | RegExp;
  /** Its search boxes. None: a filter bar without one (Stok hareketleri). */
  params: readonly ListSearchParam[];
}

/**
 * Every list a FilterBar draws, with its search boxes. FilterBar refuses a
 * path that is not here and a search field that is not listed for it
 * (`listSearchFor`), so a new box cannot quietly post its text into the
 * address; tests/admin-list-search.test.ts holds the names and lengths to
 * each list's own FilterField definitions and the sections to its page.
 */
export const LIST_SEARCHES: readonly ListSearch[] = [
  {
    key: "orders",
    section: "orders",
    path: "/admin/siparisler",
    params: [{ name: "q", maxLength: 80 }],
  },
  {
    key: "customers",
    section: "customers",
    path: "/admin/musteriler",
    params: [{ name: "q", maxLength: 100 }],
  },
  {
    key: "products",
    section: "products",
    path: "/admin/urunler",
    params: [{ name: "q", maxLength: 100 }],
  },
  {
    key: "menu",
    section: "menu",
    path: "/admin/menu",
    params: [{ name: "q", maxLength: 100 }],
  },
  {
    key: "karaoke",
    section: "karaoke",
    path: "/admin/mobil/karaoke",
    params: [{ name: "q", maxLength: 100 }],
  },
  {
    key: "newsletter",
    section: "newsletter",
    path: "/admin/bulten",
    params: [{ name: "q", maxLength: 120 }],
  },
  {
    key: "campaign",
    section: "newsletter",
    // One path segment (`cmail-<ms>-<hex>`), never "." or "..".
    path: /^\/admin\/bulten\/kampanya\/[A-Za-z0-9_~-][A-Za-z0-9._~-]{0,79}$/,
    params: [{ name: "q", maxLength: 120 }],
  },
  {
    key: "promos",
    section: "promos",
    path: "/admin/promosyon",
    params: [{ name: "q", maxLength: 40 }],
  },
  {
    key: "tables",
    section: "tables",
    path: "/admin/masalar",
    params: [{ name: "q", maxLength: 100 }],
  },
  {
    key: "audit",
    section: "audit",
    path: "/admin/olay-kaydi",
    params: [
      { name: "actor", maxLength: 100 },
      { name: "entityId", maxLength: 200 },
    ],
  },
  {
    key: "stock",
    section: "stock",
    path: "/admin/stok-hareketleri",
    params: [],
  },
];

/** How long a search is remembered after it was typed: ten minutes. */
export const LIST_SEARCH_MAX_AGE_SECONDS = 10 * 60;

const COOKIE_PREFIX = "adm_q_";

/**
 * The fields listSearchAction reads besides the list's own: which list
 * (its path), what to do, and which search a chip's × removes. Underscored
 * so they never meet a list's param names.
 */
export const LIST_SEARCH_FIELDS = {
  path: "_path",
  intent: "_do",
  clear: "_clear",
} as const;

/**
 * - apply: the box's text is the search (an empty box forgets it);
 * - reset: "Sıfırla" and "Filtreleri temizle", the search goes;
 * - clear: a search chip's ×, that one box goes.
 */
export type ListSearchIntent = "apply" | "reset" | "clear";

export const LIST_SEARCH_INTENTS: readonly ListSearchIntent[] = [
  "apply",
  "reset",
  "clear",
];

/** The list drawn at exactly this path, or null. */
export function listSearchAt(pathname: string): ListSearch | null {
  return (
    LIST_SEARCHES.find((list) =>
      typeof list.path === "string"
        ? list.path === pathname
        : list.path.test(pathname),
    ) ?? null
  );
}

/**
 * The list at `pathname`, for a filter bar with these fields. Throws for a
 * path that is not a list here, or for a search box the list does not keep
 * out of its address: both are a programming error, and a quiet fallback
 * would put the box's text back in the URL.
 */
export function listSearchFor(
  pathname: string,
  fields: readonly { type: string; name?: string }[] = [],
): ListSearch {
  const list = listSearchAt(pathname);
  if (!list) {
    throw new Error(
      `FilterBar: ${pathname} is not in LIST_SEARCHES (lib/admin/list-search-core.ts)`,
    );
  }
  for (const field of fields) {
    if (
      field.type === "search" &&
      !list.params.some((p) => p.name === field.name)
    ) {
      throw new Error(
        `FilterBar: the search box "${field.name}" on ${pathname} is not in LIST_SEARCHES`,
      );
    }
  }
  return list;
}

export function listSearchCookieName(list: ListSearch): string {
  return `${COOKIE_PREFIX}${list.key}`;
}

/**
 * The cookie's attributes: the browser's eyes only (httpOnly), never sent
 * by another site's form or image (sameSite lax: a click on a link to the
 * list still carries it), only to the list and the pages under it (path),
 * gone ten minutes after it was set.
 */
export function listSearchCookieOptions(path: string, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path,
    maxAge: LIST_SEARCH_MAX_AGE_SECONDS,
  };
}

/**
 * A typed text as the list reads it: spaces collapsed, trimmed, capped, as
 * parseFilters reads a search box.
 */
export function normalizeListSearchText(
  raw: string,
  maxLength: number,
): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

export type ListSearchTerms = Record<string, string>;

/**
 * The list's search texts out of `read` (a form, a cookie, an address),
 * normalized; the empty ones left out.
 */
export function pickListSearchTerms(
  list: ListSearch,
  read: (name: string) => unknown,
): ListSearchTerms {
  const out: ListSearchTerms = {};
  for (const p of list.params) {
    const raw = read(p.name);
    if (typeof raw !== "string") continue;
    const text = normalizeListSearchText(raw, p.maxLength);
    if (text) out[p.name] = text;
  }
  return out;
}

/** The cookie's value: the texts as a query string, or "" for none. */
export function encodeListSearch(terms: ListSearchTerms): string {
  return new URLSearchParams(terms).toString();
}

/** What a cookie value holds for this list; anything else is dropped. */
export function decodeListSearch(
  raw: string | null | undefined,
  list: ListSearch,
): ListSearchTerms {
  if (!raw) return {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return {};
  }
  return pickListSearchTerms(list, (name) => params.get(name) ?? undefined);
}

/**
 * The page's params without the list's search boxes: what every link on
 * the page is built from, so no tab, sort, page or chip link can carry a
 * text even if one arrived in the address.
 */
export function withoutListSearch(
  sp: SearchParamsInput,
  list: ListSearch,
): Record<string, string | string[]> {
  const names = new Set(list.params.map((p) => p.name));
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of toSearchParams(sp)) {
    if (names.has(key)) continue;
    const had = out[key];
    if (had === undefined) out[key] = value;
    else out[key] = Array.isArray(had) ? [...had, value] : [had, value];
  }
  return out;
}

/**
 * An old link (a bookmark, a link copied before this change) that still
 * carries a search in its address: the texts it asks for and the address
 * without them. Null when `pathname` is not a list or nothing is to move.
 * The proxy turns this into the cookie and a redirect, so the text leaves
 * the address bar and the history at once, and the page and the sign-in's
 * `next` never see it.
 */
export function listSearchInAddress(
  pathname: string,
  params: URLSearchParams,
): { list: ListSearch; terms: ListSearchTerms; rest: URLSearchParams } | null {
  const list = listSearchAt(pathname);
  if (!list || !list.params.some((p) => params.has(p.name))) return null;
  const terms = pickListSearchTerms(
    list,
    (name) => params.get(name) ?? undefined,
  );
  const rest = new URLSearchParams(params);
  for (const p of list.params) rest.delete(p.name);
  return { list, terms, rest };
}

/**
 * Signing out forgets every list's remembered search: on the köşk's shared
 * device the next person to sign in would otherwise find the last one's
 * text under the box. A campaign's own search (a cookie per campaign page)
 * runs out on its own within the ten minutes.
 */
export function forgetListSearches(jar: {
  delete(cookie: { name: string; path: string }): unknown;
}): void {
  for (const list of LIST_SEARCHES) {
    if (typeof list.path !== "string" || list.params.length === 0) continue;
    jar.delete({ name: listSearchCookieName(list), path: list.path });
  }
}
