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
const CSP = [
  "default-src 'self'",
  // Google Tag Manager, and only it. 'unsafe-inline' covers the consent
  // bootstrap and the JSON-LD blocks until a nonce is threaded through.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
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
  // Where a form on this site may submit. Nothing posts cross-origin: the
  // virtual POS is reached by redirect and returns to our own callback.
  "form-action 'self'",
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
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
