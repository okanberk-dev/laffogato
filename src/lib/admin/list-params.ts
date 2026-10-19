// Client-safe (no server-only): the URL side of an admin list - filters,
// sort, page and tab live in the query string, so a filtered view is a link
// the operator can reload, bookmark or send to a colleague, and every page
// works without JavaScript.
//
// Default parameter names are Turkish like the rest of the panel's URLs
// (`?once=`, `?denied=`): `sirala`, `yon`, `sayfa`.

/** What a page receives as `searchParams` (awaited), or a URLSearchParams. */
export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

/** A change to the query string: `null`, `undefined` or "" removes the key. */
export type ParamPatch = Record<string, string | number | null | undefined>;

export const DEFAULT_SORT_PARAM = "sirala";
export const DEFAULT_DIR_PARAM = "yon";
export const DEFAULT_PAGE_PARAM = "sayfa";

/**
 * Params that are a one-time message, not a view: `denied` is requireRole's
 * "Bu sayfaya yetkin yok" (roles.ts `deniedPathFor`). Personel lands on a
 * list (open orders), and the list's tabs, sort, pages and filters are built
 * from the page's params: the next click would have said it again.
 */
const ONE_TIME_PARAMS: ReadonlySet<string> = new Set(["denied"]);

/**
 * A copy of the params as URLSearchParams, keeping repeated keys and
 * dropping the one-time ones, so no link or filter carries them on.
 */
export function toSearchParams(sp: SearchParamsInput): URLSearchParams {
  const out = new URLSearchParams();
  if (!sp) return out;
  const entries: Iterable<[string, string | string[] | undefined]> =
    sp instanceof URLSearchParams ? sp.entries() : Object.entries(sp);
  for (const [key, value] of entries) {
    if (value === undefined || ONE_TIME_PARAMS.has(key)) continue;
    if (Array.isArray(value)) for (const v of value) out.append(key, v);
    else out.append(key, value);
  }
  return out;
}

/**
 * The current URL with `patch` applied, every other param kept.
 *
 * Returns `pathname?query`; with nothing left, `pathname` alone (or "?",
 * which a link resolves to the current path without a query).
 *
 * @example withParams({ durum: "paid", sayfa: "3" }, { sirala: "total", sayfa: null }, "/admin/siparisler")
 * // "/admin/siparisler?durum=paid&sirala=total"
 */
export function withParams(
  searchParams: SearchParamsInput,
  patch: ParamPatch,
  pathname: string = "",
): string {
  const next = toSearchParams(searchParams);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  if (query) return `${pathname}?${query}`;
  return pathname || "?";
}

/** The first value of `key`, or undefined. */
export function firstParam(
  searchParams: SearchParamsInput,
  key: string,
): string | undefined {
  if (!searchParams) return undefined;
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key) ?? undefined;
  }
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

// ── Sort ────────────────────────────────────────────────────────────────

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * The sort the URL asks for, if the column is one the page allows; otherwise
 * `fallback`. A missing or odd direction reads as the fallback's direction
 * for the fallback column and as "asc" for any other.
 */
export function parseSort(
  searchParams: SearchParamsInput,
  allowed: readonly string[],
  fallback: SortState,
  names: { sort?: string; dir?: string } = {},
): SortState {
  const key = firstParam(searchParams, names.sort ?? DEFAULT_SORT_PARAM);
  if (!key || !allowed.includes(key)) return fallback;
  const raw = firstParam(searchParams, names.dir ?? DEFAULT_DIR_PARAM);
  const dir: SortDir =
    raw === "asc" || raw === "desc"
      ? raw
      : key === fallback.key
        ? fallback.dir
        : "asc";
  return { key, dir };
}

/** The direction a click on column `key` asks for: flip if sorted, else `first`. */
export function nextSortDir(
  current: SortState | null | undefined,
  key: string,
  first: SortDir = "asc",
): SortDir {
  if (current && current.key === key) {
    return current.dir === "asc" ? "desc" : "asc";
  }
  return first;
}

// ── Page ────────────────────────────────────────────────────────────────

/** A 1-based page number from the URL; anything else is page 1. */
export function parsePage(
  searchParams: SearchParamsInput,
  param: string = DEFAULT_PAGE_PARAM,
): number {
  const raw = firstParam(searchParams, param);
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  const n = Number(raw);
  return n >= 1 ? n : 1;
}

/** How many pages `total` rows fill; at least 1. */
export function pageCount(total: number, pageSize: number): number {
  if (!(pageSize > 0) || !(total > 0)) return 1;
  return Math.ceil(total / pageSize);
}

/**
 * The page numbers to draw: the first, the last and `siblings` either side
 * of the current one; `null` marks a gap ("…"). A gap of one page is drawn
 * as that page, so the row never reads "1 … 3".
 *
 * @example pageWindow(6, 20) // [1, null, 5, 6, 7, null, 20]
 */
export function pageWindow(
  page: number,
  count: number,
  siblings: number = 1,
): Array<number | null> {
  const last = Math.max(1, Math.trunc(count));
  const current = Math.min(Math.max(1, Math.trunc(page)), last);
  const wanted = new Set<number>([1, last]);
  for (let i = current - siblings; i <= current + siblings; i++) {
    if (i >= 1 && i <= last) wanted.add(i);
  }
  const out: Array<number | null> = [];
  let prev = 0;
  for (const n of [...wanted].sort((a, b) => a - b)) {
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}

/** "1-100 / 250": the rows this page shows, out of all of them. */
export function pageRangeLabel(
  page: number,
  pageSize: number,
  total: number,
): string {
  if (!(total > 0)) return "0 / 0";
  const from = Math.min((Math.max(1, page) - 1) * pageSize + 1, total);
  const to = Math.min(from + pageSize - 1, total);
  return `${from}-${to} / ${total}`;
}

// ── Filters ─────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

/** A free-text box. The value is trimmed, spaces collapsed, capped. */
export interface SearchFilterField {
  type: "search";
  name: string;
  label: string;
  placeholder?: string;
  /** Longest value kept; default 100. */
  maxLength?: number;
}

/** A dropdown. Only one of `options` is accepted from the URL. */
export interface SelectFilterField {
  type: "select";
  name: string;
  label: string;
  options: readonly FilterOption[];
  /** The empty option's text; default "Tümü". */
  allLabel?: string;
}

/** Two `type=date` inputs (YYYY-MM-DD), each optional. */
export interface DateRangeFilterField {
  type: "date-range";
  label: string;
  /** Param name of the first day, e.g. "bas". */
  from: string;
  /** Param name of the last day (inclusive), e.g. "bit". */
  to: string;
}

export type FilterField =
  SearchFilterField | SelectFilterField | DateRangeFilterField;

/** Valid, non-empty filter values keyed by param name. */
export type FilterValues = Record<string, string>;

/** The URL params a set of fields owns. */
export function filterParamNames(fields: readonly FilterField[]): string[] {
  return fields.flatMap((f) =>
    f.type === "date-range" ? [f.from, f.to] : [f.name],
  );
}

/** True for a real calendar day written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  return (
    at.getUTCFullYear() === y &&
    at.getUTCMonth() === mo - 1 &&
    at.getUTCDate() === d
  );
}

/** "2026-10-01" as "01.10.2026"; anything else unchanged. */
export function formatIsoDate(value: string): string {
  return isIsoDate(value)
    ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`
    : value;
}

/**
 * The filters the URL asks for, keeping only values the page can use: an
 * unknown select value, a malformed date or an empty box is dropped, so the
 * page, the bar and the chips all agree on what is active. A date range
 * typed backwards is swapped.
 */
export function parseFilters(
  searchParams: SearchParamsInput,
  fields: readonly FilterField[],
): FilterValues {
  const out: FilterValues = {};
  for (const field of fields) {
    if (field.type === "search") {
      const raw = firstParam(searchParams, field.name) ?? "";
      const value = raw
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, field.maxLength ?? 100)
        .trim();
      if (value) out[field.name] = value;
    } else if (field.type === "select") {
      const raw = firstParam(searchParams, field.name) ?? "";
      if (raw && field.options.some((o) => o.value === raw)) {
        out[field.name] = raw;
      }
    } else {
      let from = firstParam(searchParams, field.from) ?? "";
      let to = firstParam(searchParams, field.to) ?? "";
      if (!isIsoDate(from)) from = "";
      if (!isIsoDate(to)) to = "";
      if (from && to && from > to) [from, to] = [to, from];
      if (from) out[field.from] = from;
      if (to) out[field.to] = to;
    }
  }
  return out;
}

/** One active filter, with the link that removes it. */
export interface FilterChip {
  /** The param (or "from|to" for a date range); stable React key. */
  key: string;
  label: string;
  value: string;
  removeHref: string;
}

/** The chips for the active filters; removing one also resets the page. */
export function filterChips(
  fields: readonly FilterField[],
  values: FilterValues,
  searchParams: SearchParamsInput,
  pathname: string,
  pageParam: string = DEFAULT_PAGE_PARAM,
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const field of fields) {
    if (field.type === "date-range") {
      const from = values[field.from];
      const to = values[field.to];
      if (!from && !to) continue;
      const value =
        from && to
          ? `${formatIsoDate(from)} - ${formatIsoDate(to)}`
          : from
            ? `${formatIsoDate(from)} ve sonrası`
            : `${formatIsoDate(to)} ve öncesi`;
      chips.push({
        key: `${field.from}|${field.to}`,
        label: field.label,
        value,
        removeHref: withParams(
          searchParams,
          { [field.from]: null, [field.to]: null, [pageParam]: null },
          pathname,
        ),
      });
      continue;
    }
    const raw = values[field.name];
    if (!raw) continue;
    const value =
      field.type === "select"
        ? (field.options.find((o) => o.value === raw)?.label ?? raw)
        : raw;
    chips.push({
      key: field.name,
      label: field.label,
      value,
      removeHref: withParams(
        searchParams,
        { [field.name]: null, [pageParam]: null },
        pathname,
      ),
    });
  }
  return chips;
}
