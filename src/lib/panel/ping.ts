import "server-only";

import { after } from "next/server";

import {
  panelSyncConfig,
  signedHeaders,
  type PanelSyncConfig,
} from "./karaoke-sync-core";

/**
 * The one way this site tells the köşk's panel (ladmin.laffogato.net) that
 * something it shows changed: an empty, signed `POST` to one of its ping
 * routes, after which the panel pulls what it needs, signed
 * (src/lib/panel/karaoke-sync-core.ts has the signature).
 *
 * Each link builds its own ping here (karaoke-ping.ts, menu-ping.ts,
 * orders-ping.ts) and the data layer's write hook (src/lib/db/index.ts)
 * calls it for every write that expires that link's cache tag, so no code
 * path has to remember it. The ping carries no row at all - only "something
 * changed" and the instant.
 *
 * ## Never in the way of the write
 *
 * `ping()` returns at once: the request is sent from `after()`, once the
 * response is out, and every failure is swallowed (a missed ping costs a
 * panel that catches up on its next pull; a write that failed because the
 * panel was down would cost the write). Outside a request - a script, a
 * plain test - there is nothing to schedule on and it does nothing.
 *
 * ## One ping for a burst
 *
 * A booking or an order is several writes in one request. While a ping is
 * scheduled and not yet sent, later writes ride on it: they committed
 * before it goes out, so the panel's pull sees them. The pending mark is
 * cleared when the send STARTS, so a write after that point schedules a
 * ping of its own; a schedule that never ran (the instance died before
 * `after()` fired) stops counting after ten seconds. Each link keeps its own
 * mark, so a booking and an order in one request each reach the panel.
 */

const PENDING_STALE_MS = 10_000;
const PING_TIMEOUT_MS = 4_000;
const RETRY_DELAY_MS = 1_500;
const WARN_EVERY_MS = 5 * 60_000;

export interface PanelPingSpec {
  /** The panel's route, e.g. "/api/karaoke/ping". */
  path: `/api/${string}`;
  /** What the body says changed, e.g. "karaoke.changed". */
  event: string;
  /** The log prefix, e.g. "panel-karaoke". */
  logTag: string;
}

export interface PanelPing {
  /** Schedules one ping after the response; never throws. */
  ping(): void;
  /**
   * Sends it now; true when the panel took it. A network error or a 5xx is
   * tried once more after a short pause (the panel may be mid-deploy); a
   * 4xx is not - a wrong secret will not fix itself in a second and a half,
   * and a panel without the route yet (404) still catches up on its pull.
   */
  send(
    config: PanelSyncConfig,
    fetchImpl?: typeof fetch,
    now?: () => Date,
  ): Promise<boolean>;
}

export function createPanelPing(spec: PanelPingSpec): PanelPing {
  let pendingAt = 0;
  let lastWarnAt = 0;

  /** One line per few minutes at most, and never the secret or a query. */
  function warn(reason: string): void {
    const now = Date.now();
    if (now - lastWarnAt < WARN_EVERY_MS) return;
    lastWarnAt = now;
    console.warn(`[${spec.logTag}] ping not delivered (${reason})`);
  }

  async function send(
    config: PanelSyncConfig,
    fetchImpl: typeof fetch = fetch,
    now: () => Date = () => new Date(),
  ): Promise<boolean> {
    pendingAt = 0;
    const url = new URL(spec.path, config.panelUrl);
    let reason = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      const at = now();
      const body = JSON.stringify({
        event: spec.event,
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

  function ping(): void {
    try {
      const config = panelSyncConfig(process.env);
      if (!config) return;
      const now = Date.now();
      if (pendingAt !== 0 && now - pendingAt < PENDING_STALE_MS) return;
      pendingAt = now;
      try {
        after(() => send(config));
      } catch {
        pendingAt = 0;
      }
    } catch {
      // Nothing here may reach the write that triggered it.
    }
  }

  return { ping, send };
}
