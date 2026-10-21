// The always-loaded half of a list's saved views (admin UI v2, UI-11): the
// FilterBar asks this whether to draw the "Görünümler" menu, and holds it
// in a boundary. The menu itself (saved-views.tsx, with the rules) is a
// chunk of its own, loaded only by a list that passes `views`, after the
// page is in the browser. FilterBar comes with the kit's barrel into most
// panel pages, so this file stays as small as it is: no rules, no storage,
// no dialog (tests/admin-saved-views-bar.test.ts holds the FilterBar's
// static imports to a list).

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { validAccountKey } from "@/lib/admin/account-key";
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

/** The operator starting something: a press, a key, a form sent. */
export const TOUCH_EVENTS = ["pointerdown", "keydown", "submit"] as const;

/**
 * Calls `onTouch` when the operator presses, types or sends a form anywhere
 * on the page (capture phase: a control that stops the event still counts);
 * returns the cleanup. Exported for tests.
 */
export function watchFirstTouch(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  onTouch: () => void,
): () => void {
  const touch = () => onTouch();
  // The options form: Node's EventTarget (the tests) does not match a
  // boolean `true` on removal, browsers match either.
  for (const type of TOUCH_EVENTS) {
    target.addEventListener(type, touch, { capture: true, passive: true });
  }
  return () => {
    for (const type of TOUCH_EVENTS) {
      target.removeEventListener(type, touch, { capture: true });
    }
  };
}

/**
 * Whether the operator has started something since the bar came up in the
 * browser (`enabled`: a list with saved views). The menu's default asks it
 * once its chunk is in: a tab clicked or "Uygula" sent in the meantime is a
 * navigation under way, and the default's router.replace would cancel it.
 */
export function useTouchedSince(enabled: boolean): () => boolean {
  const touched = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    return watchFirstTouch(window, () => {
      touched.current = true;
    });
  }, [enabled]);
  return useCallback(() => touched.current, []);
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
