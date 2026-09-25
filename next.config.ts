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

/** The hosts the PayNkolay bridge form posts to (docs/PAYNKOLAY.md §1). */
const PAYNKOLAY_FORM_HOSTS = [
  "https://paynkolay.nkolayislem.com.tr",
  "https://paynkolaytest.nkolayislem.com.tr",
];

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
  // Where a form on this site may submit. One form posts cross-origin: the
  // PayNkolay bridge page (/odeme/paynkolay) sends the signed checkout to the POS's
  // hosted payment page, test or live host (docs/PAYNKOLAY.md §14.6/1). With
  // 'self' alone the browser refused that POST and no payment could start.
  // Chrome checks redirects after a form submission against this list too;
  // the live run in §13 confirms the POS answers without leaving it.
  `form-action 'self' ${PAYNKOLAY_FORM_HOSTS.join(" ")}`,
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
