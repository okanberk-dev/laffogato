// Client-safe (no server-only), and as small as it looks: what the account
// key the layout computes (palette-account.ts) must look like. Apart from
// palette-shell.ts, which re-exports it, because the FilterBar needs only
// this to decide whether to draw a list's saved views, and importing the
// palette's shell file would bring the roles, the nav matching and the
// palette's rules into every page that has a filter bar.

/** 16 hex of an HMAC of the e-mail, never the e-mail itself. */
export function validAccountKey(key: unknown): key is string {
  return typeof key === "string" && /^[0-9a-f]{16}$/.test(key);
}
