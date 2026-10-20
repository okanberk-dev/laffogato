// Client-safe, pure, always loaded: which roles have the panel's single-key
// shortcuts (admin UI v2, UI-8). The sidebar asks it for the switch and
// for whether to fetch the layer, the palette for its Komutlar entry. The
// rules themselves (shortcut-core.ts) ride in the layer's own chunk, so a
// page pays only for this.

import type { AdminRole } from "./roles";

/**
 * The roles with single keys. Not the cashier: one page, the Kasa, where
 * typed and scanned codes arrive. A role added later gets none until it is
 * named here.
 */
export function singleKeysForRole(
  role: AdminRole | null | undefined,
): role is AdminRole {
  return role === "owner" || role === "manager" || role === "staff";
}
