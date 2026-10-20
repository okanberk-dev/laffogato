// The always-loaded half of a list's saved views (admin UI v2, UI-11): the
// FilterBar asks this whether to draw the "Görünümler" menu. The menu
// itself (saved-views.tsx, with the rules) is a chunk of its own, loaded
// only by a list that passes `views`, after the page is in the browser.

import { useSyncExternalStore } from "react";

import { validAccountKey } from "@/lib/admin/palette-shell";
import { savedViewsStorageKey } from "@/lib/admin/saved-views-key";

const noSubscribe = () => () => {};

/**
 * The account key the layout puts on the admin root (`data-admin-account`:
 * the palette's HMAC of the e-mail, never the e-mail), or "" without one
 * (the cashier, the sign-in screens).
 */
export function pageAccountKey(
  root: Pick<ParentNode, "querySelector"> = document,
): string {
  const value =
    root
      .querySelector("[data-admin-root]")
      ?.getAttribute("data-admin-account") ?? "";
  return validAccountKey(value) ? value : "";
}

/**
 * Where this list's views live for the signed-in account, once the page is
 * in the browser; null before (the server's render and hydration), without
 * `listKey`, and without an account key. The FilterBar draws the menu, and
 * the row it sits in, only when this is set.
 */
export function useSavedViewsKey(listKey: string | undefined): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => (listKey ? savedViewsStorageKey(pageAccountKey(), listKey) : null),
    () => null,
  );
}
