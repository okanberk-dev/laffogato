// The always-loaded half of a list's saved views (admin UI v2, UI-11): the
// FilterBar asks this whether to draw the "Görünümler" menu, and holds it
// in a boundary. The menu itself (saved-views.tsx, with the rules) is a
// chunk of its own, loaded only by a list that passes `views`, after the
// page is in the browser. FilterBar comes with the kit's barrel into most
// panel pages, so this file stays as small as it is: no rules, no storage,
// no dialog (tests/admin-saved-views-bar.test.ts holds the FilterBar's
// static imports to a list).

import { Component, useSyncExternalStore, type ReactNode } from "react";

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

/**
 * Keeps a menu that cannot load, or breaks while drawing, from taking the
 * list with it. The menu is a chunk of its own (a deploy can replace it,
 * the köşk's network can drop) and it is asked for as soon as the page is
 * in the browser, not on a click: an error out of it would reach
 * admin/error.tsx and replace the whole orders list with "Bu ekran
 * yüklenemedi". A rejected import stays rejected for as long as the page
 * lives, so that screen's "Tekrar dene" would show it again. Caught here,
 * the list works as it did and only the menu is not drawn; a fresh load
 * brings it back. Exported for tests.
 */
export class SavedViewsBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
