/**
 * The admin panel's cookies: names, path and options, in one place for
 * `auth.ts` (which writes them) and `src/proxy.ts` (which moves the old ones).
 * Pure: no `next/headers`, no `server-only`.
 *
 * Path `/admin` (docs/AUDIT.md §13): the session and the pending-2FA cookie
 * go only with requests to the panel's own paths. The site's pages, its
 * route handlers and its Server Actions never receive them, so nothing
 * outside /admin can be handed an admin session by the browser. Server
 * Actions post to the page's own path, so every panel action still gets it.
 *
 * What the path does NOT do: a cookie's path is matched against the URL a
 * request goes TO, not the page that sends it. A script on a site page that
 * calls `fetch("/admin/...")` still sends this cookie; only a separate origin
 * for the panel stops that (the finding stays open for it).
 *
 * New names, not the old ones under a new path: the browser keeps a cookie
 * per name AND path, a request carries no path, and Next.js keeps one
 * Set-Cookie per name in a response. Under the old names the proxy could
 * neither tell the whole-origin cookie from the panel's nor expire one and
 * write the other in the same answer.
 */

export const ADMIN_COOKIE_PATH = "/admin";

export const ADMIN_SESSION_COOKIE = "laffogato_panel_session";
export const ADMIN_PENDING_COOKIE = "laffogato_panel_2fa";

/**
 * The names used until 21 Eki 2026, with path `/`. Read only by the proxy,
 * which moves a live one under the panel path and expires the old copy
 * (`src/proxy.ts`), and expired again on sign-in and sign-out.
 */
export const LEGACY_ADMIN_SESSION_COOKIE = "laffogato_admin_session";
export const LEGACY_ADMIN_PENDING_COOKIE = "laffogato_admin_pending_2fa";
export const LEGACY_ADMIN_COOKIE_PATH = "/";

export const ADMIN_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const ADMIN_PENDING_MAX_AGE_SECONDS = 5 * 60;

/** How every admin cookie is written. */
export function adminCookieOptions(maxAge: number, secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: ADMIN_COOKIE_PATH,
    maxAge,
  };
}
