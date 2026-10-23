// Client-safe (no server-only): the rules of a list's saved views (admin UI
// v2, UI-11, design §5 #11). A view is the part of a list's address that
// says what the list shows (the tab, the dropdowns, the sort), kept under a
// name in this browser's localStorage, per signed-in account and per list:
// "Masa siparişleri", "Kargoya verilecek" in one tap. What a view may keep
// is decided here, once, for the write and for the read back;
// ui/saved-views.tsx only reads, writes and draws.
//
// A view never keeps what names a person. The typed search is not in the
// address any more (list-search-core.ts), and `q` and the list's own search
// boxes are dropped all the same. Beyond that a view keeps only the list's
// own params (its filters, its tab, its sort: viewRulesFor) with a value its
// controls write (letters, digits, `_` and `-`, no run of seven digits), and
// nothing piiLike() reads as an e-mail or a phone: a counter tablet is
// shared, and localStorage outlives the session. A date has eight digits, so
// a date range is not kept either; a fixed range would go stale in a week.

import {
  DEFAULT_DIR_PARAM,
  DEFAULT_SORT_PARAM,
  filterParamNames,
  toSearchParams,
  type FilterField,
  type SearchParamsInput,
} from "./list-params";
import { piiLike } from "./pii-like";
import { foldTr } from "./text-fold";

import { SAVED_VIEWS_KEY_PREFIX } from "./saved-views-key";

export {
  SAVED_VIEWS_KEY_PREFIX,
  savedViewsStorageKey,
} from "./saved-views-key";

/**
 * sessionStorage, per tab, account and list: the default view this tab has
 * already opened the list with (defaultViewHref's `appliedInTab`).
 */
export const SAVED_VIEWS_TAB_PREFIX = "laf_admin_views_tab_v1:";

/** The tab's note for a list's views (the same account and list), or null. */
export function savedViewsTabKey(storageKey: string): string | null {
  if (!storageKey.startsWith(SAVED_VIEWS_KEY_PREFIX)) return null;
  return `${SAVED_VIEWS_TAB_PREFIX}${storageKey.slice(SAVED_VIEWS_KEY_PREFIX.length)}`;
}

/** Views per list and account. */
export const SAVED_VIEWS_MAX = 8;

/** A view's name, in characters. */
export const SAVED_VIEW_NAME_MAX = 30;

/** A param a view may keep: the name listSearchAction accepts in a post. */
const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
/**
 * A value a list's own controls write: a tab, an option, a sort ("acik",
 * "pending_payment", "1"). No space, dot, slash, comma, "@" or "%": a name,
 * an address, a split phone or an encoded e-mail cannot be one.
 */
const VALUE = /^[A-Za-z0-9_-]{1,100}$/;
const PARAMS_MAX = 16;

/** Seven digits once `_` and `-` go: piiLike leaves `0532_123_45_67` whole. */
const digitRun = (text: string) => /\d{7,}/.test(text.replace(/[_-]/g, ""));

/** The typed search's usual name: never kept, whatever the list calls its boxes. */
const SEARCH_PARAM = "q";

/** What a list's FilterBar tells the rules about itself. */
export interface ViewRules {
  /** The list's search boxes (its `search` fields): never kept. */
  searchNames: readonly string[];
  /** The page param: a view opens on page 1. */
  pageParam: string;
  /**
   * The only names a view keeps (viewRulesFor: the list's filters, its tab
   * and its sort); without it, any name the other rules let through.
   */
  names?: readonly string[];
}

/**
 * Every list's own params besides its filters: the tab (StatusTabs'
 * default param) and the sort (DataTable's). A test holds the tab's name
 * to StatusTabs.
 */
export const LIST_VIEW_PARAMS: readonly string[] = [
  "durum",
  DEFAULT_SORT_PARAM,
  DEFAULT_DIR_PARAM,
];

/**
 * The rules for a list with these FilterBar fields: what the menu uses.
 * `tabParam` names a tab that is not StatusTabs' default (Karaoke's
 * `sekme`, Müşteriler' `filter`): without it a view dropped the tab, and a
 * list on one of its tabs read as bare (23 Eki 2026).
 */
export function viewRulesFor(
  fields: readonly FilterField[],
  pageParam: string,
  tabParam?: string,
): ViewRules {
  const boxes = fields.filter((f) => f.type === "search");
  return {
    searchNames: boxes.map((f) => f.name),
    pageParam,
    names: [
      ...filterParamNames(fields.filter((f) => f.type !== "search")),
      ...LIST_VIEW_PARAMS,
      ...(tabParam ? [tabParam] : []),
    ],
  };
}

export interface SavedView {
  name: string;
  /** The canonical query (viewQuery), without "?". */
  query: string;
}

export interface SavedViewsState {
  /** In the order they were saved. */
  views: SavedView[];
  /** The view the list opens with when its address is plain; null for none. */
  defaultQuery: string | null;
}

export const NO_SAVED_VIEWS: SavedViewsState = {
  views: [],
  defaultQuery: null,
};

/**
 * The params a view keeps of this address, sorted by name, so one view has
 * one spelling. Dropped: `q`, the list's search boxes, the page, the
 * one-time `denied`, a name the list does not own (`rules.names`), an odd
 * name, a value its controls would not write (VALUE), and any name or value
 * that reads as an e-mail or a phone (piiLike, or seven digits in a row:
 * a date too). A repeated name keeps its first value, as the lists read it.
 */
export function viewParams(
  address: SearchParamsInput,
  rules: ViewRules,
): Array<[string, string]> {
  const dropped = new Set([
    SEARCH_PARAM,
    ...rules.searchNames,
    rules.pageParam,
  ]);
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  for (const [key, value] of toSearchParams(address)) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (dropped.has(key) || !PARAM_NAME.test(key)) continue;
    if (rules.names && !rules.names.includes(key)) continue;
    if (!VALUE.test(value)) continue;
    // The name too: a link someone wrote by hand can carry a number in it
    // (`?p05321234567=1`), and the name is kept as much as the value.
    if (piiLike(key) || piiLike(value) || digitRun(key) || digitRun(value)) {
      continue;
    }
    out.push([key, value]);
    if (out.length === PARAMS_MAX) break;
  }
  return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** viewParams as a query string ("" when nothing is kept). */
export function viewQuery(
  address: SearchParamsInput,
  rules: ViewRules,
): string {
  return new URLSearchParams(viewParams(address, rules)).toString();
}

/** The list's address for a view's query. */
export function viewHref(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

export type ViewNameCheck =
  { ok: true; name: string } | { ok: false; error: string };

/**
 * A typed name as kept: on one line, without invisible characters, at most
 * 30 characters. Refused when empty, too long, or when it looks like an
 * e-mail or a phone (the rule the params follow).
 */
export function cleanViewName(raw: unknown): ViewNameCheck {
  const name =
    typeof raw === "string"
      ? raw
          .normalize("NFKC")
          .replace(/\p{Cf}/gu, "")
          .replace(/[\s\p{Cc}]+/gu, " ")
          .trim()
      : "";
  if (!name) return { ok: false, error: "Görünüme bir ad ver." };
  if ([...name].length > SAVED_VIEW_NAME_MAX) {
    return {
      ok: false,
      error: `Ad en fazla ${SAVED_VIEW_NAME_MAX} karakter olabilir.`,
    };
  }
  if (piiLike(name)) {
    return {
      ok: false,
      error: "Adda e-posta ya da telefon numarası olmasın.",
    };
  }
  return { ok: true, name };
}

/** Two names are one view's: "Masa" and "MASA", "İade" and "iade". */
const sameName = (a: string, b: string) => foldTr(a) === foldTr(b);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The stored views, read back through the rules they were written with: a
 * hand-edited or older entry loses what a view may not keep, an entry left
 * with nothing (or a bad name, or a second copy) is dropped, at most eight
 * are read, and a default that is not one of them is forgotten.
 */
export function parseSavedViews(
  raw: string | null | undefined,
  rules: ViewRules,
): SavedViewsState {
  if (!raw) return NO_SAVED_VIEWS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_SAVED_VIEWS;
  }
  if (!isRecord(value) || !Array.isArray(value.views)) return NO_SAVED_VIEWS;
  const views: SavedView[] = [];
  for (const item of value.views) {
    if (views.length === SAVED_VIEWS_MAX) break;
    if (!isRecord(item) || typeof item.query !== "string") continue;
    const name = cleanViewName(item.name);
    if (!name.ok) continue;
    const query = viewQuery(new URLSearchParams(item.query), rules);
    if (!query) continue;
    if (views.some((v) => v.query === query || sameName(v.name, name.name))) {
      continue;
    }
    views.push({ name: name.name, query });
  }
  const wanted =
    typeof value.default === "string"
      ? viewQuery(new URLSearchParams(value.default), rules)
      : "";
  return {
    views,
    defaultQuery: views.some((v) => v.query === wanted) ? wanted : null,
  };
}

/** What parseSavedViews reads back. */
export function serializeSavedViews(state: SavedViewsState): string {
  return JSON.stringify({
    views: state.views.map(({ name, query }) => ({ name, query })),
    default: state.defaultQuery ?? undefined,
  });
}

/** The saved view this query is, or null. */
export function findView(
  state: SavedViewsState,
  query: string,
): SavedView | null {
  if (!query) return null;
  return state.views.find((v) => v.query === query) ?? null;
}

export type SaveViewOutcome =
  | { ok: true; state: SavedViewsState; name: string }
  | { ok: false; error: string };

/**
 * The views after saving `query` as `rawName`. A name already used is that
 * view, now with this query (and the default goes with it); a query already
 * saved is renamed; anything else is added, up to eight. One name and one
 * query per view, always.
 */
export function saveView(
  state: SavedViewsState,
  rawName: unknown,
  query: string,
): SaveViewOutcome {
  const name = cleanViewName(rawName);
  if (!name.ok) return name;
  if (!query) {
    return {
      ok: false,
      error: "Kaydedilecek bir sekme, süzgeç ya da sıralama yok.",
    };
  }
  const byName = state.views.findIndex((v) => sameName(v.name, name.name));
  const at =
    byName >= 0 ? byName : state.views.findIndex((v) => v.query === query);
  if (at < 0 && state.views.length >= SAVED_VIEWS_MAX) {
    return {
      ok: false,
      error: `En fazla ${SAVED_VIEWS_MAX} görünüm kaydedilir. Yenisi için birini sil.`,
    };
  }
  const next: SavedView = { name: name.name, query };
  const views: SavedView[] = [];
  state.views.forEach((v, i) => {
    if (i === at) views.push(next);
    else if (v.query !== query && !sameName(v.name, name.name)) views.push(v);
  });
  if (at < 0) views.push(next);
  const replaced = at >= 0 ? state.views[at] : null;
  let defaultQuery = state.defaultQuery;
  if (replaced && defaultQuery === replaced.query) defaultQuery = query;
  if (!views.some((v) => v.query === defaultQuery)) defaultQuery = null;
  return { ok: true, state: { views, defaultQuery }, name: name.name };
}

/** The views without the one at `query`. */
export function removeView(
  state: SavedViewsState,
  query: string,
): SavedViewsState {
  return {
    views: state.views.filter((v) => v.query !== query),
    defaultQuery: state.defaultQuery === query ? null : state.defaultQuery,
  };
}

/** The views with `query` as the default (one of them), or none (null). */
export function setDefaultView(
  state: SavedViewsState,
  query: string | null,
): SavedViewsState {
  if (query !== null && !findView(state, query)) return state;
  return { views: state.views, defaultQuery: query };
}

/** What the tab and the page say about opening the default now. */
export interface DefaultViewContext {
  /**
   * The default this tab has already opened the list with (sessionStorage,
   * savedViewsTabKey), or null. Next mounts the list anew on Back (its back
   * cache holds one page), and the bare address there is the operator's own
   * "Tümü": the same default is not opened twice in a tab.
   */
  appliedInTab?: string | null;
  /**
   * The operator pressed, typed or sent something on the page since the
   * list came up (ui/saved-views-key.ts): the default's replace would cancel
   * the navigation they started, or undo the tab they chose.
   */
  touched?: boolean;
}

/**
 * Where the list goes when it opens: its default view, but only for a
 * plain address (no tab, filter, sort or page: the menu, a bookmark of the
 * bare list), no remembered search, nothing the operator has started yet,
 * and once per tab for a default (a new default opens once too). A list
 * opened with anything in its address shows that, and so does the bare
 * list reached from the list itself ("Tümü", "Sıfırla", and Back to them):
 * ui/saved-views.tsx asks once per mount.
 */
export function defaultViewHref(
  state: SavedViewsState,
  pathname: string,
  address: SearchParamsInput,
  searchActive: boolean,
  { appliedInTab = null, touched = false }: DefaultViewContext = {},
): string | null {
  if (!state.defaultQuery || searchActive || touched) return null;
  if (state.defaultQuery === appliedInTab) return null;
  if ([...toSearchParams(address)].length > 0) return null;
  return viewHref(pathname, state.defaultQuery);
}

/** One saved view as the menu lists it. */
export interface ViewsMenuEntry {
  name: string;
  href: string;
  isDefault: boolean;
  /** The view on screen. */
  open: boolean;
  /** Its accessible name: the name, then "varsayılan" and "açık". */
  ariaLabel: string;
}

/** What the "Görünümler" menu shows for the view on screen. */
export interface ViewsMenu {
  /** The menu button's text: the open view's name, or "Görünümler". */
  label: string;
  entries: ViewsMenuEntry[];
  /** The saved view on screen: "Varsayılan yap" and "Görünümü sil". */
  here: SavedView | null;
  hereIsDefault: boolean;
  /**
   * When `here` is null, "Bu görünümü kaydet": `save`, or turned off with
   * a reason for a bare list (`plain`) or eight views (`full`).
   */
  save: "save" | "plain" | "full";
}

/** The menu for `current` (viewQuery of the address) on this list. */
export function viewsMenu(
  state: SavedViewsState,
  pathname: string,
  current: string,
): ViewsMenu {
  const here = findView(state, current);
  const entries = state.views.map((view) => {
    const isDefault = view.query === state.defaultQuery;
    const open = view.query === here?.query;
    return {
      name: view.name,
      href: viewHref(pathname, view.query),
      isDefault,
      open,
      ariaLabel: [view.name, isDefault ? "varsayılan" : "", open ? "açık" : ""]
        .filter(Boolean)
        .join(", "),
    };
  });
  return {
    label: here ? `Görünüm: ${here.name}` : "Görünümler",
    entries,
    here,
    hereIsDefault: here !== null && here.query === state.defaultQuery,
    save: !current
      ? "plain"
      : state.views.length >= SAVED_VIEWS_MAX
        ? "full"
        : "save",
  };
}
