// Client-safe and edge-safe: imported by src/proxy.ts and the reset page.

/**
 * Where the password-reset e-mail points (`/uye/sifre-sifirla?token=...`).
 * The path is called from mail already sent, so it never changes.
 */
export const RESET_PATH = "/uye/sifre-sifirla";

/**
 * The cookie the reset token moves into before the page renders.
 *
 * A token in the address bar is a token in every analytics hit: GTM's tags
 * (GA4's page_location, any pixel's `dl`) report the full URL, query string
 * included, and the token opens the account for an hour. The proxy takes it
 * out of the URL on arrival, keeps it here (httpOnly, this path only, the
 * token's own lifetime) and redirects to the bare path, so the page that
 * loads GTM never has it in `location`.
 */
export const RESET_TOKEN_COOKIE = "laffogato_reset_token";

/** Same as the token's own validity (RESET_TTL_MS in lib/customer/store.ts). */
export const RESET_TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60;

/** Tokens are 64 hex characters; anything far longer is not one of ours. */
export const RESET_TOKEN_MAX_LENGTH = 200;
