"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { useToast } from "@/components/admin/ui/toast";
import {
  DENSITY_ATTR,
  DENSITY_ATTR_VALUE,
  DENSITY_PREF_KEY,
  DENSITY_TOGGLE_EVENT,
  RAIL_ATTR,
  RAIL_ATTR_VALUE,
  RAIL_PREF_KEY,
  densityMessage,
  densityPrefValue,
  dismissRailTips,
  parseDensityPref,
  parseRailPref,
  railPrefValue,
} from "@/lib/admin/view-prefs-core";

/*
 * The panel's two view preferences (admin UI v2, UI-9): the laptop rail and
 * "Sıkı görünüm". Each is one boolean in localStorage, per browser, like the
 * single-key switch and the order sound: a shared köşk laptop and a
 * back-office one want different answers. They are client-only, so the
 * server and the first paint draw the expanded, comfortable default and the
 * stored choice applies right after hydration (see ViewPrefs).
 */

/**
 * One boolean preference as an external store: `read` (what is stored, or
 * what this tab holds when the storage refuses), `write` (stores, then
 * tells every subscriber of this tab), `subscribe` (this tab's writes and
 * another tab's, which arrive as `storage` events).
 */
function createPref(
  key: string,
  parse: (raw: string | null) => boolean,
  encode: (on: boolean) => string,
) {
  const listeners = new Set<() => void>();
  /** The choice this tab holds when the storage refused the write (private window). */
  let held: boolean | null = null;

  const read = (): boolean => {
    if (held !== null) return held;
    try {
      return parse(window.localStorage.getItem(key));
    } catch {
      return parse(null);
    }
  };

  const write = (next: boolean): void => {
    try {
      window.localStorage.setItem(key, encode(next));
      held = null;
    } catch {
      // Not remembered next time; the choice still holds in this tab.
      held = next;
    }
    for (const listener of listeners) listener();
  };

  const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { read, write, subscribe };
}

const rail = createPref(RAIL_PREF_KEY, parseRailPref, railPrefValue);
const density = createPref(
  DENSITY_PREF_KEY,
  parseDensityPref,
  densityPrefValue,
);

export const readRailPref = rail.read;
export const writeRailPref = rail.write;
export const subscribeRailPref = rail.subscribe;
export const readDensityPref = density.read;
export const writeDensityPref = density.write;
export const subscribeDensityPref = density.subscribe;

const expanded = () => false;

/** Whether the rail is folded. The server render and hydration say no. */
export function useRailPref(): boolean {
  return useSyncExternalStore(rail.subscribe, rail.read, expanded);
}

/** Whether "Sıkı görünüm" is on. The server render and hydration say no. */
export function useDensityPref(): boolean {
  return useSyncExternalStore(density.subscribe, density.read, expanded);
}

/**
 * Writes `name` on the admin root (or takes it off, for `null`) and returns
 * the undo: a layout effect's cleanup, so a sign-out (the shell unmounts)
 * leaves no stale attribute on the sign-in screen, and a change takes the
 * old value off in the same commit it writes the new one.
 */
export function holdRootAttribute(
  name: string,
  value: string | null,
): () => void {
  const root = document.querySelector("[data-admin-root]");
  if (!root) return () => {};
  if (value === null) root.removeAttribute(name);
  else root.setAttribute(name, value);
  return () => root.removeAttribute(name);
}

/**
 * The shell's side of the two preferences; draws nothing. Mounted by the
 * full nav only: the cashier's one-page shell never runs any of it.
 *
 * - The stored choices go on the admin root as `data-admin-rail="on"` and
 *   `data-admin-density="compact"`. React does not own those attributes
 *   (the server layout renders the root without them), so no hydration
 *   mismatch is possible, and a layout effect writes them in the commit
 *   that reads the store, before the browser paints it. Nothing animates:
 *   the one thing that moves on a reload with the rail folded is the
 *   sidebar's width and the page's left edge, once.
 * - Esc hides the rail's tooltips while the rail is folded.
 * - The palette's "Sıkı görünüm" arrives as an event (the list's chunk has
 *   no room for more code): flip the density, say so.
 */
export function ViewPrefs() {
  const collapsed = useRailPref();
  const compact = useDensityPref();
  const toast = useToast();

  useLayoutEffect(
    () => holdRootAttribute(RAIL_ATTR, collapsed ? RAIL_ATTR_VALUE : null),
    [collapsed],
  );
  useLayoutEffect(
    () => holdRootAttribute(DENSITY_ATTR, compact ? DENSITY_ATTR_VALUE : null),
    [compact],
  );

  useEffect(() => {
    if (!collapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRailTips(document);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collapsed]);

  useEffect(() => {
    const onToggle = () => {
      const next = !density.read();
      density.write(next);
      toast.show({
        tone: "info",
        message: densityMessage(
          next,
          window.matchMedia("(pointer: fine)").matches,
        ),
      });
    };
    window.addEventListener(DENSITY_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(DENSITY_TOGGLE_EVENT, onToggle);
  }, [toast]);

  return null;
}
