/**
 * The admin panel's documents and their own Content-Security-Policy
 * (docs/AUDIT.md §13, decision D34).
 *
 * The site policy (next.config.ts) admits `'unsafe-inline'` scripts and
 * Google Tag Manager. The panel renders no tags (site-tags.tsx), but a policy
 * that lets them in is one a stray inline script or an injected tag could
 * use next to customer names, addresses and phones and an admin session. So
 * every /admin response also carries this narrower policy, built per request
 * in src/proxy.ts with a fresh nonce, the way /odeme does
 * (`checkout-csp.ts`). Two policies on one response are both enforced: the
 * site policy stays on /admin and this one takes away what it allowed
 * beyond it.
 *
 * - Scripts: this origin's files and the inline scripts Next.js stamps with
 *   the nonce (it reads it from the request's `Content-Security-Policy`).
 *   No `'unsafe-inline'`, no `'unsafe-eval'` outside `next dev`, no third
 *   party. Every /admin page is dynamic (the admin layout reads the session
 *   cookie), so each view gets its own nonce; the panel writes no inline
 *   script of its own.
 * - `connect-src 'self'`: the panel talks to this site only (its Server
 *   Actions, route handlers and polls).
 * - `worker-src 'self' blob:`: the order alert poller runs as a blob: worker
 *   (components/admin/order-alert-poller.ts).
 * - `img-src` keeps `https:` and `blob:`: product, menu and hero images are
 *   addresses the operator typed, and uploads are previewed before saving.
 * - `frame-src 'none'`: the campaign preview is a sandboxed `srcdoc` frame,
 *   which loads nothing.
 * - `frame-ancestors 'none'` (and X-Frame-Options DENY, next.config.ts): no
 *   page, the site's own included, can hold a panel page in a frame and
 *   script it.
 *
 * Pure; the nonce comes from `newCspNonce` (checkout-csp.ts).
 * `tests/admin-document.test.ts` reads every directive.
 */

/**
 * The panel's own paths: `/admin` and everything under it, the sign-in and
 * 2FA screens included. Not `/administrator` or `/admin-x`: those are the
 * site's (not-found) pages.
 *
 * Read decoded: Next.js also matches a request's decoded path to its pages,
 * so `/%61dmin/musteriler/...` opens the panel, while `usePathname()` and a
 * request's pathname keep the escapes as the address bar has them.
 */
export function isAdminDocumentPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape: no page matches it either; test it as it is.
  }
  return path === "/admin" || path.startsWith("/admin/");
}

const NONCE = /^[A-Za-z0-9+/]{16,64}={0,2}$/;

export function adminCsp(
  nonce: string,
  { development = false }: { development?: boolean } = {},
): string {
  // A malformed nonce would be dropped by Next.js, which would then render
  // scripts without it: a panel that never hydrates. Fail loudly.
  if (!NONCE.test(nonce)) throw new Error("adminCsp: malformed nonce");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
