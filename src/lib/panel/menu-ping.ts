import "server-only";

import { createPanelPing } from "./ping";

/**
 * Tells the köşk's panel that the menu changed, so its copy of the linked
 * items' prices and on-menu state follows within seconds
 * (src/lib/panel/menu-link-core.ts, docs/PANEL-MENU.md).
 *
 * Called from the data layer's write hook (src/lib/db/index.ts) for every
 * write that expires `pub:menu`: an item saved, priced, sold out, moved or
 * deleted, from the panel here or from the panel there. The ping carries no
 * item; the panel reads the list itself, signed. A panel that does not have
 * the route yet answers 404: one warning, and its own pull (page open,
 * daily cron) still catches up. The ping's rules: src/lib/panel/ping.ts.
 */

const menu = createPanelPing({
  path: "/api/menu/ping",
  event: "menu.changed",
  logTag: "panel-menu",
});

export const pingPanelMenu = menu.ping;
export const sendPanelMenuPing = menu.send;
