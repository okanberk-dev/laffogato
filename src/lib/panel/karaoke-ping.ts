import "server-only";

import { createPanelPing } from "./ping";

/**
 * Tells the köşk's panel that a karaoke booking changed, so the bar's screen
 * rings and recounts without asking this site every few seconds
 * (src/lib/panel/karaoke-sync-core.ts has the whole link).
 *
 * Called from the data layer's write hook (src/lib/db/index.ts) for every
 * write that expires `live:karaoke` - a booking made, paid, confirmed,
 * cancelled, made good or swept - so no karaoke code path has to remember
 * it. The ping carries nothing about the booking; the panel pulls the day's
 * rows itself, signed. How it stays out of the write's way and sends one
 * ping for a burst: src/lib/panel/ping.ts.
 */

const karaoke = createPanelPing({
  path: "/api/karaoke/ping",
  event: "karaoke.changed",
  logTag: "panel-karaoke",
});

export const pingPanelKaraoke = karaoke.ping;
export const sendPanelPing = karaoke.send;
