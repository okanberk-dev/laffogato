import "server-only";

import { after } from "next/server";

import {
  panelSyncConfig,
  signedHeaders,
  type PanelSyncConfig,
} from "./karaoke-sync-core";

/**
 * Tells the köşk's panel that a karaoke booking changed, so the bar's screen
 * rings and recounts without asking this site every few seconds
 * (src/lib/panel/karaoke-sync-core.ts has the whole link).
 *
 * Called from the data layer's write hook (src/lib/db/index.ts) for every
 * write that expires `live:karaoke` - a booking made, paid, confirmed,
 * cancelled, made good or swept - so no karaoke code path has to remember
 * it. The ping carries nothing about the booking; the panel pulls the day's
 * rows itself, signed.
 *
 * ## Never in the way of the write
 *
 * It returns at once: the request is sent from `after()`, once the response
 * is out, and every failure is swallowed (a missed ping costs a panel that
 * catches up when its board is next opened; a booking that failed because
 * the panel was down would cost the booking). Outside a request - a script,
 * a plain test - there is nothing to schedule on and it does nothing.
 *
 * ## One ping for a burst
 *
 * A booking is several writes in one request (the row, then its payment
 * state). While a ping is scheduled and not yet sent, later writes ride on
 * it: they committed before it goes out, so the panel's pull sees them.
 * `pendingAt` is cleared when the send STARTS, so a write after that point
 * schedules a ping of its own; a schedule that never ran (the instance died
 * before `after()` fired) stops counting after ten seconds.
 */

const PENDING_STALE_MS = 10_000;
const PING_TIMEOUT_MS = 4_000;
const RETRY_DELAY_MS = 1_500;
const WARN_EVERY_MS = 5 * 60_000;

let pendingAt = 0;
let lastWarnAt = 0;

export function pingPanelKaraoke(): void {
  try {
    const config = panelSyncConfig(process.env);
    if (!config) return;
    const now = Date.now();
    if (pendingAt !== 0 && now - pendingAt < PENDING_STALE_MS) return;
    pendingAt = now;
    try {
      after(() => sendPanelPing(config));
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
  console.warn(`[panel-karaoke] ping not delivered (${reason})`);
}

/**
 * Sends the ping; true when the panel took it. A network error or a 5xx is
 * tried once more after a short pause (the panel may be mid-deploy); a 4xx
 * is not - a wrong secret will not fix itself in a second and a half.
 */
export async function sendPanelPing(
  config: PanelSyncConfig,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  pendingAt = 0;
  const url = new URL("/api/karaoke/ping", config.panelUrl);
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    const at = now();
    const body = JSON.stringify({
      event: "karaoke.changed",
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
