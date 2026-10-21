// A list's saved views in this browser's localStorage (admin UI v2, UI-11),
// and in this tab's sessionStorage the default the tab has already opened.
// What a view may keep is pure, in lib/admin/saved-views.ts; this file only
// reads, writes and listens. Every storage call is in try/catch: a private
// window, blocked site data or a full quota leaves the menu empty, never the
// list broken.

import {
  serializeSavedViews,
  type SavedViewsState,
} from "@/lib/admin/saved-views";

/** The slice of Storage this file uses (a fake in the tests). */
export type ViewStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Fired on this window after a write; the storage event only reaches other tabs. */
export const SAVED_VIEWS_EVENT = "admin:saved-views";

function browserStore(): ViewStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored text, "" when there is none or it cannot be read. */
export function readViews(
  key: string | null,
  store: ViewStore | null = key ? browserStore() : null,
): string {
  if (!key || !store) return "";
  try {
    return store.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/**
 * Writes the views (none left removes the key) and tells this window's
 * menus; false when the browser refused.
 */
export function writeViews(
  key: string,
  state: SavedViewsState,
  store: ViewStore | null = browserStore(),
): boolean {
  if (!store) return false;
  try {
    if (state.views.length === 0) store.removeItem(key);
    else store.setItem(key, serializeSavedViews(state));
  } catch {
    return false;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SAVED_VIEWS_EVENT));
  }
  return true;
}

/** useSyncExternalStore's subscribe: this tab's writes and other tabs'. */
export function subscribeViews(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SAVED_VIEWS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SAVED_VIEWS_EVENT, onChange);
  };
}

// ── The default, once per tab ─────────────────────────────────────────────

function tabStore(): ViewStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The default this tab has already opened the list with
 * (savedViewsTabKey), "" for none or when it cannot be read.
 */
export function readTabDefault(
  key: string | null,
  store: ViewStore | null = key ? tabStore() : null,
): string {
  if (!key || !store) return "";
  try {
    return store.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/**
 * Notes that this tab opened the list with the default `query`; false when
 * the browser refused. The menu opens the default only once this is noted:
 * a tab that cannot remember would open it again on every Back.
 */
export function writeTabDefault(
  key: string | null,
  query: string,
  store: ViewStore | null = key ? tabStore() : null,
): boolean {
  if (!key || !store) return false;
  try {
    store.setItem(key, query);
    return true;
  } catch {
    return false;
  }
}
