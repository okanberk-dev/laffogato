import { randomBytes } from "node:crypto";

/**
 * The Content-Security-Policy of the checkout document, `/odeme`.
 *
 * The card is typed on /odeme itself (operator, 16 Eki 2026: "kart girerken
 * başka sayfaya vs atmasın"; docs/PAYNKOLAY.md §15.5). The site-wide policy
 * in next.config.ts allows `'unsafe-inline'` scripts and Google Tag Manager,
 * which is exactly what a skimmer needs on a page with a card field, so
 * /odeme is outside it (`CSP_SOURCE`) and gets this policy instead, built per
 * request in src/proxy.ts with a fresh nonce:
 *
 * - Scripts: this origin's own files and the inline scripts Next.js stamps
 *   with the nonce (it reads the nonce from the request's
 *   `Content-Security-Policy` header). No `'unsafe-inline'`, no
 *   `'unsafe-eval'` outside `next dev`, no third-party origin at all.
 * - `connect-src 'self'`: the page talks to this site only (its Server
 *   Actions). Nothing can be sent anywhere else from it.
 * - `form-action 'self'`: the pay form posts to /odeme/paynkolay, which
 *   answers with the bank's 3D page under that route's own policy.
 * - `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`.
 *
 * The other directives follow the site policy minus its third parties (no
 * Google Analytics, no Maps frame) and minus remote images (`img-src` is
 * this origin and `data:` only). `style-src` keeps `'unsafe-inline'`: the
 * page's React `style=` attributes need it, and this was NOT tried without
 * it in a browser (a nonce on styles would also need `style-src-attr`). Pure apart from the nonce generator;
 * `tests/checkout-csp.test.ts` reads every directive.
 */

/**
 * A fresh, unguessable nonce: 18 random bytes, base64 (24 characters, no
 * padding). Next.js accepts `[A-Za-z0-9+/_-]` with optional padding.
 */
export function newCspNonce(): string {
  return randomBytes(18).toString("base64");
}

const NONCE = /^[A-Za-z0-9+/]{16,64}={0,2}$/;

export function checkoutCsp(
  nonce: string,
  { development = false }: { development?: boolean } = {},
): string {
  // A malformed nonce would be silently dropped by Next.js, which would then
  // render scripts without it - a page that never hydrates. Fail loudly.
  if (!NONCE.test(nonce)) throw new Error("checkoutCsp: malformed nonce");
  return [
    "default-src 'self'",
    // React's development build needs eval() (stack traces, hot reload);
    // `next build` output never does.
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // The page draws everything itself (inline SVG marks, no photo): images
    // from this origin and data: URIs, no other host. A card page that may
    // load `https:` images is a page a skimmer can beacon from.
    "img-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
