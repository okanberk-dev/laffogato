import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { DEFAULT_PAGE_PARAM, type SearchParamsInput } from "./list-params";
import {
  LIST_SEARCH_FIELDS,
  decodeListSearch,
  encodeListSearch,
  listSearchAt,
  listSearchCookieName,
  listSearchCookieOptions,
  pickListSearchTerms,
  withoutListSearch,
  type ListSearch,
  type ListSearchIntent,
  type ListSearchTerms,
} from "./list-search-core";

// The server side of a list's typed search (list-search-core.ts has the
// why): the page reads the remembered text, listSearchAction writes it.

type Params = Record<string, string | string[]>;

export interface ListSearchView {
  /** The address's own params: every link on the page is built from these. */
  url: Params;
  /** `url` and the remembered texts: the list is parsed from these. */
  view: Params;
}

/**
 * A list page's params, split: `url` for its links (tabs, sort, pages,
 * chips, the CSV link), `view` for what it shows. The text never reaches
 * `url`, so no link drawn from it can carry the search into an address.
 * Also for a list's own route handler (the CSV export): the cookie's path
 * covers the pages under the list.
 */
export async function listSearchView(
  pathname: string,
  sp: SearchParamsInput,
): Promise<ListSearchView> {
  const list = listSearchAt(pathname);
  if (!list) {
    throw new Error(`listSearchView: ${pathname} is not in LIST_SEARCHES`);
  }
  const url = withoutListSearch(sp, list);
  if (list.params.length === 0) return { url, view: url };
  const terms = decodeListSearch(await storedListSearch(list), list);
  return { url, view: { ...url, ...terms } };
}

/**
 * The list's cookie as the request sent it. Outside a request (a script, a
 * test drawing the page) there is none, as getAdminSession reads it: the
 * list shows unsearched rather than failing.
 */
async function storedListSearch(list: ListSearch): Promise<string | undefined> {
  try {
    return (await cookies()).get(listSearchCookieName(list))?.value;
  } catch {
    return undefined;
  }
}

/** A param the redirect may carry: a short ASCII name, a value of 200 at most. */
const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const MAX_VALUE = 200;
const MAX_PARAMS = 30;

const metaSchema = z.object({
  path: z.string().min(1).max(300),
  intent: z.enum(["apply", "reset", "clear"]).default("apply"),
  clear: z.string().max(40).optional(),
});

/** What a list search post asks for, read and checked. */
export interface ListSearchPost {
  list: ListSearch;
  /** The list's address: the cookie's path and the redirect's. */
  path: string;
  intent: ListSearchIntent;
  /** The box a chip's × removes (`clear`). */
  clear: string | null;
  /** The box's texts (`apply`), normalized. */
  terms: ListSearchTerms;
  /** Everything else the form held (tab, dropdowns, dates, sort): the address. */
  params: URLSearchParams;
}

/**
 * The post, or null for one the panel never draws (no list at that path, an
 * unknown intent). The page param is dropped (a new search starts on page
 * 1), so are empty fields, as the GET form's script did; the search boxes
 * never go into `params`, whatever the form calls itself.
 */
export function readListSearchPost(form: FormData): ListSearchPost | null {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const meta = metaSchema.safeParse({
    path: text(LIST_SEARCH_FIELDS.path),
    intent: text(LIST_SEARCH_FIELDS.intent),
    clear: text(LIST_SEARCH_FIELDS.clear),
  });
  if (!meta.success) return null;
  const list = listSearchAt(meta.data.path);
  if (!list) return null;
  const boxes = new Set(list.params.map((p) => p.name));
  const params = new URLSearchParams();
  let kept = 0;
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    // Next's own fields ($ACTION_ID_…) and this form's (_path, _do, _clear).
    if (key.startsWith("$") || key.startsWith("_")) continue;
    if (boxes.has(key) || key === DEFAULT_PAGE_PARAM) continue;
    if (!PARAM_NAME.test(key)) continue;
    const v = value.trim();
    if (!v || v.length > MAX_VALUE) continue;
    if (kept >= MAX_PARAMS) break;
    params.append(key, v);
    kept += 1;
  }
  return {
    list,
    path: meta.data.path,
    intent: meta.data.intent,
    clear: meta.data.clear ?? null,
    terms:
      meta.data.intent === "apply"
        ? pickListSearchTerms(list, (name) => form.get(name))
        : {},
    params,
  };
}

/** The search after this post: the box's, none, or the stored one minus a box. */
export function nextListSearchTerms(
  post: Pick<ListSearchPost, "intent" | "clear" | "terms">,
  stored: ListSearchTerms,
): ListSearchTerms {
  if (post.intent === "apply") return { ...post.terms };
  if (post.intent === "reset") return {};
  const out = { ...stored };
  if (post.clear) delete out[post.clear];
  return out;
}

/** Where the post lands: the list with its params, never with the text. */
export function listSearchHref(post: Pick<ListSearchPost, "path" | "params">) {
  const query = post.params.toString();
  return query ? `${post.path}?${query}` : post.path;
}

/** Writes the search the post leaves, or forgets it when none is left. */
export async function saveListSearch(post: ListSearchPost): Promise<void> {
  if (post.list.params.length === 0) return;
  const store = await cookies();
  const name = listSearchCookieName(post.list);
  const next = nextListSearchTerms(
    post,
    decodeListSearch(store.get(name)?.value, post.list),
  );
  if (Object.keys(next).length === 0) {
    store.delete({ name, path: post.path });
    return;
  }
  store.set({
    name,
    value: encodeListSearch(next),
    ...listSearchCookieOptions(
      post.path,
      process.env.NODE_ENV === "production",
    ),
  });
}
