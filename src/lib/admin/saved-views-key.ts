// Client-safe (no server-only): where a list's saved views are kept (admin
// UI v2, UI-11). Apart from saved-views.ts, which re-exports it, because
// every page with a filter bar runs this to decide whether to draw the
// menu at all; the rules and the menu load only where a list uses them.

import { validAccountKey } from "./palette-shell";

/** localStorage, per account and list: `laf_admin_views_v1:<account>:<list>`. */
export const SAVED_VIEWS_KEY_PREFIX = "laf_admin_views_v1:";

/** A list's key (`views.key` on the FilterBar): short, lower-case ASCII. */
const LIST_KEY = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Where this account's views of this list live, or null when either key is
 * not one the panel writes (no account key: the layout gives none to the
 * cashier, nor without ADMIN_SESSION_SECRET). Null turns the menu off.
 */
export function savedViewsStorageKey(
  accountKey: string,
  listKey: string,
): string | null {
  if (!validAccountKey(accountKey)) return null;
  if (typeof listKey !== "string" || !LIST_KEY.test(listKey)) return null;
  return `${SAVED_VIEWS_KEY_PREFIX}${accountKey}:${listKey}`;
}
