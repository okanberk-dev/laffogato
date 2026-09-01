import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

async function headerMap() {
  const rules = await nextConfig.headers!();
  const entries = rules[0].headers.map((h) => [h.key, h.value] as const);
  return Object.fromEntries(entries) as Record<string, string>;
}

describe("security headers", () => {
  it("sends a Content-Security-Policy on every route", async () => {
    const h = await headerMap();
    expect(h["Content-Security-Policy"]).toBeTruthy();
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/:path*");
  });

  it("confines scripts to this origin and Google Tag Manager", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "))!;
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
    // The whole point: no wildcard host and no bare scheme may serve script.
    const sources = scriptSrc.split(/\s+/).slice(1);
    expect(sources).not.toContain("https:");
    expect(sources.some((src) => src.includes("*"))).toBe(false);
  });

  it("blocks the injection primitives an XSS would reach for", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("does not let an injected script exfiltrate to an arbitrary host", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    const connect = csp.split("; ").find((d) => d.startsWith("connect-src "))!;
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/connect-src[^;]*\shttps:(\s|$)/);
  });

  it("sends HSTS, nosniff and a framing rule", async () => {
    const h = await headerMap();
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBeTruthy();
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });
});
