import "server-only";

import { panelSyncConfig } from "./karaoke-sync-core";

/**
 * The köşk panel's address while the link is on (the shared
 * `KARAOKE_SYNC_SECRET` is set), else null: what Ayarlar → Sistem durumu
 * says and links to. Presence only - the secret never leaves this
 * function, and the page does not read the environment itself
 * (tests/supabase-service-role-visibility.test.ts).
 */
export function panelLinkUrl(): string | null {
  return panelSyncConfig(process.env)?.panelUrl ?? null;
}
