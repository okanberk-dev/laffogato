import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The site sent none: no HSTS, no framing rule, no sniffing rule, and no
 * Content-Security-Policy, so a single injected script had the whole origin —
 * including the admin session cookie's neighbourhood — to work with.
 *
 * `script-src` still carries 'unsafe-inline'. Tightening it needs a per-request
 * nonce, which means reading headers() in the root layout and turning every
 * static page (the guides, the twenty-four legal documents) dynamic. The rest
 * of the policy is enforced strictly, so an injected script cannot exfiltrate
 * to an arbitrary host, load a remote payload, or reframe the site.
 */
/**
 * React's development build uses `eval()` — for hot reload and for
 * reconstructing stack traces across environments — so a CSP without
 * 'unsafe-eval' breaks `npm run dev` outright. It is added ONLY outside a
 * production build; the deployed policy never carries it.
 */
const DEV_SCRIPT_SRC =
  process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

/**
 * Two paths this policy does NOT cover, each because it sends a narrower
 * policy of its own (two CSP headers on one response are both enforced, so
 * the site policy could only ever add to theirs):
 *
 * - /odeme/paynkolay hands the customer's browser to forms that post
 *   elsewhere - the POS's hosted page, or the card's own bank for 3D Secure,
 *   whose host differs per bank (docs/PAYNKOLAY.md §15). Its policy:
 *   `default-src 'none'`, scripts only by the SHA-256 of its own inline
 *   blocks, no third party at all (`src/lib/payment/paynkolay-page.ts`).
 * - /odeme is where the card is typed (§15.5). Google Tag Manager and
 *   `'unsafe-inline'` scripts have no business on a page with a card field;
 *   src/proxy.ts sends it a per-request nonce policy with no third party
 *   (`src/lib/security/checkout-csp.ts`).
 *
 * `$` keeps each exclusion to that exact path: /odeme/donus, /odeme/basarili
 * and /odeme/app-hata stay under this policy (`tests/security-headers.test.ts`).
 */
const CSP_SOURCE = "/:path((?!odeme$|odeme/paynkolay$).*)";

const CSP = [
  "default-src 'self'",
  // Google Tag Manager, and only it. 'unsafe-inline' covers the consent
  // bootstrap and the JSON-LD blocks until a nonce is threaded through.
  `script-src 'self' 'unsafe-inline'${DEV_SCRIPT_SRC} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts every face; nothing is fetched from a font CDN.
  "font-src 'self' data:",
  // data: for the inline SVG art and base64 uploads; https: for admin-entered
  // product and hero image URLs.
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  // The visit page's Google Maps embed.
  "frame-src https://www.google.com https://maps.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Where a form on this site may submit: this site only. The forms that
  // post cross-origin live on /odeme/paynkolay, outside this policy
  // (CSP_SOURCE above), and name their destination in its own policy.
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * vercel.json repeats these values for the edge and the two
 * copies must not drift: they did (X-Frame-Options DENY here, SAMEORIGIN
 * there; a one-year HSTS there under this two-year one) and a response could
 * carry both. `tests/security-headers.test.ts` compares them key by key.
 */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // strict-: never send even the origin from an https page to an http one.
  // Same-origin requests keep the full URL, which the reset and verification
  // pages need nothing from; other sites get the origin only, as before.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // `camera=(self)`, not `camera=()`: the till desk at /admin/kasa reads the
    // member's QR through getUserMedia, and an empty allowlist denies the
    // camera to every origin INCLUDING this one. The cashier's browser refuses
    // the stream before any permission prompt appears, so nothing on screen
    // says why. Same-origin only - no embedded frame inherits it.
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Every response said `X-Powered-By: Next.js`: a free fingerprint for
  // whoever is matching the site against a framework advisory.
  poweredByHeader: false,
  experimental: {
    /**
     * The admin posts a product's photos as base64 data URLs, all of them on
     * every save: up to eight, each at most 2 MB after the client-side
     * resize. Next's default server action body limit is 1 MB, so a product
     * with more than two or three photos failed to save with an error the
     * form never surfaced.
     *
     * This number is not the ceiling in production. A Vercel Function
     * refuses a request body over 4.5 MB with 413 before the action runs,
     * whatever this says, and the panel's error page then replaces the form.
     * So the uploader keeps one save's photos under 4 MB and tells the
     * operator when a photo does not fit (`MAX_UPLOAD_TOTAL_LENGTH` in
     * src/lib/admin/image-encode.ts). The lasting fix is object storage.
     */
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    // AVIF first: the home hero and the /ziyaret photo are each page's
    // largest paint, and AVIF carries them in roughly half the bytes of WebP
    // at the same quality. Browsers without it still get WebP.
    formats: ["image/avif", "image/webp"],
    // A month at the edge: the sources in public/ change only on deploy.
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: CSP_SOURCE,
        headers: [{ key: "Content-Security-Policy", value: CSP }],
      },
      {
        // Brand art and venue photos are not content-hashed, so a day in the
        // browser with a week of stale-while-revalidate - they used to be
        // max-age=0 and re-validated on every visit. The site's drawings
        // (public/illustrations) are the same kind of file.
        source: "/:dir(brand|photos|menu|illustrations)/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // The 610 KB pour widget (pour-module.tsx) was served max-age=0 and
        // re-validated on every home visit. Not the day-long rule above: the
        // file is rebuilt IN PLACE under the same name (be2e506 did), so a
        // long cache would pin visitors to an old build. An hour, then a day
        // of background revalidation, bounds that to one stale load.
        source: "/laffogato-pour.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
