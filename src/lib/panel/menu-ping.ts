import "server-only";

import { after } from "next/server";

import {
  panelSyncConfig,
  signedHeaders,
  type PanelSyncConfig,
} from "./karaoke-sync-core";

/**
 * Tells the köşk's panel that the menu changed, so its copy of the linked
 * items' prices and on-menu state follows within seconds
 * (src/lib/panel/menu-link-core.ts, docs/PANEL-MENU.md).
 *
 * Called from the data layer's write hook (src/lib/db/index.ts) for every
 * write that expires `pub:menu`: an item saved, priced, sold out, moved or
 * deleted, from the panel here or from the panel there. The ping carries no
 * item; the panel reads the list itself, signed.
 *
 * Never in the way of the write, and one ping for a burst: the karaoke
 * ping's rules (src/lib/panel/karaoke-ping.ts), with its own pending mark so
 * a menu write and a booking in one request each reach the panel.
 */

const PENDING_STALE_MS = 10_000;
const PING_TIMEOUT_MS = 4_000;
const RETRY_DELAY_MS = 1_500;
const WARN_EVERY_MS = 5 * 60_000;

let pendingAt = 0;
let lastWarnAt = 0;

export function pingPanelMenu(): void {
  try {
    const config = panelSyncConfig(process.env);
    if (!config) return;
    const now = Date.now();
    if (pendingAt !== 0 && now - pendingAt < PENDING_STALE_MS) return;
    pendingAt = now;
    try {
      after(() => sendPanelMenuPing(config));
    } catch {
      pendingAt = 0;
    }
  } catch {
    // Nothing here may reach the write that triggered it.
  }
}

/** One line per few minutes at most, and never the secret or a query. */
function warn(reason: string): void {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  console.warn(`[panel-menu] ping not delivered (${reason})`);
}

/**
 * Sends the ping; true when the panel took it. A network error or a 5xx is
 * tried once more after a short pause; a 4xx is not. A panel that does not
 * have the route yet answers 404: one warning, and its own pull (page open,
 * daily cron) still catches up.
 */
export async function sendPanelMenuPing(
  config: PanelSyncConfig,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  pendingAt = 0;
  const url = new URL("/api/menu/ping", config.panelUrl);
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    const at = now();
    const body = JSON.stringify({
      event: "menu.changed",
      at: at.toISOString(),
    });
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...signedHeaders(config.secret, "POST", url, body, at.getTime()),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      });
      if (res.ok) return true;
      reason = `HTTP ${res.status}`;
      if (res.status < 500) break;
    } catch (err) {
      reason = err instanceof Error ? err.name : "network";
    }
  }
  warn(`${url.host}: ${reason}`);
  return false;
}
