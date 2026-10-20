import { useSyncExternalStore } from "react";

/**
 * "Tek tuş kısayolları": the switch for the panel's single keys (/, n, ?,
 * g and a letter; WCAG 2.1.4 wants a way to turn them off), in the user
 * menu and on the shortcut sheet. Remembered per browser, like the order
 * sound: a shared köşk tablet and a back-office laptop want different
 * answers. On unless it was turned off ("off"). ⌘K / Ctrl K is not
 * affected: a key with a modifier is not what 2.1.4 is about.
 */
export const SHORTCUT_PREF_KEY = "laf_admin_shortcuts_v1";

const listeners = new Set<() => void>();
/** The choice when storage refuses (private window): this tab only. */
let fallback: boolean | null = null;

export function parseShortcutPref(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readShortcutPref(): boolean {
  try {
    return parseShortcutPref(window.localStorage.getItem(SHORTCUT_PREF_KEY));
  } catch {
    return fallback ?? true;
  }
}

export function writeShortcutPref(next: boolean): void {
  fallback = next;
  try {
    window.localStorage.setItem(SHORTCUT_PREF_KEY, next ? "on" : "off");
  } catch {
    // Not remembered next time; the switch still works in this tab.
  }
  for (const listener of listeners) listener();
}

/** The switch as an external store; another tab's change arrives through `storage`. */
export function subscribeShortcutPref(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SHORTCUT_PREF_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The switch, for a component. The server render assumes the default (on). */
export function useShortcutPref(): boolean {
  return useSyncExternalStore(
    subscribeShortcutPref,
    readShortcutPref,
    () => true,
  );
}
