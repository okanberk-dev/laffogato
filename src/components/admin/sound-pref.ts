import { useSyncExternalStore } from "react";

/**
 * The panel's one sound switch: the order list's beep and the new-order
 * alert's ring (order-alerts.tsx) read and write the same key, so turning
 * it off in one place silences both. Remembered per browser; a shared till
 * screen and a back-office laptop want different answers.
 *
 * On unless it was turned off ("0"): the alert is the reason the panel
 * makes a sound at all, and a barista who never found the switch must still
 * hear a table order. The key predates the alert ("1" = on), so an old
 * "on" stays on and an old "off" stays off.
 */
export const SOUND_KEY = "laffogato.admin.orders.sound";

const listeners = new Set<() => void>();
/** The choice when storage refuses (private window): this tab only. */
let fallback: boolean | null = null;

export function parseSoundPref(raw: string | null): boolean {
  return raw !== "0";
}

export function readSoundPref(): boolean {
  try {
    return parseSoundPref(window.localStorage.getItem(SOUND_KEY));
  } catch {
    return fallback ?? true;
  }
}

export function writeSoundPref(next: boolean): void {
  fallback = next;
  try {
    window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
  } catch {
    /* Not remembered next time; the switch still works this session. */
  }
  for (const listener of listeners) listener();
}

/**
 * Read as an external store rather than mirrored into React state:
 * `localStorage` cannot be read while rendering on the server, and a change
 * in another tab arrives through the same `storage` event.
 */
export function subscribeSound(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SOUND_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The switch, for a component. The server render assumes the default (on). */
export function useSoundPref(): boolean {
  return useSyncExternalStore(subscribeSound, readSoundPref, () => true);
}

// ── Is the panel-wide alert mounted? ─────────────────────────────────────

let alertsMounted = 0;

/**
 * Called by the new-order alert while it is mounted (once per tab, in the
 * top bar). The order list reads it so it does not beep for the cafe
 * orders the alert already rings for. Returns the unmount.
 */
export function markOrderAlertsMounted(): () => void {
  alertsMounted += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    alertsMounted -= 1;
  };
}

export function orderAlertsMounted(): boolean {
  return alertsMounted > 0;
}

/**
 * Whether the order list beeps for a poll that counted new orders.
 *
 * Alone, it beeps when the count grew, as it always did. Beside the
 * panel-wide alert it beeps only when a SHOP order is among them: the alert
 * rings for the cafe orders itself, and two sounds for one table order is
 * how an operator ends up muting both. `countShop` is asked only then.
 */
export async function shouldListBeep(input: {
  grew: boolean;
  soundOn: boolean;
  alertsMounted: boolean;
  /** The last shop count this list heard (0 after a refresh). */
  lastShop: number;
  countShop: () => Promise<number | null>;
}): Promise<{ beep: boolean; shop: number | null }> {
  if (!input.grew || !input.soundOn) return { beep: false, shop: null };
  if (!input.alertsMounted) return { beep: true, shop: null };
  const shop = await input.countShop();
  if (typeof shop !== "number") return { beep: false, shop: null };
  return { beep: shop > input.lastShop, shop };
}
