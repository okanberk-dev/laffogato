import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

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

  it("never ships 'unsafe-eval' in a production build", () => {
    // React's dev build needs eval(); adding it unconditionally would carry
    // the weakest possible script policy into production.
    const config = readFileSync("next.config.ts", "utf8");
    // The production branch of the ternary is the empty string, so the
    // directive cannot carry it in a deployed build.
    expect(config).toContain(
      'process.env.NODE_ENV === "production" ? "" : " \'unsafe-eval\'"',
    );
    // And nothing else in the policy names it.
    const withoutComments = config.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments.match(/unsafe-eval/g) ?? []).toHaveLength(1);
  });

  it("blocks the injection primitives an XSS would reach for", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("lets the PayNkolay bridge form reach the POS, and no other host", async () => {
    // docs/PAYNKOLAY.md §14.6/1: with `form-action 'self'` the browser refused
    // the bridge page's POST to the hosted payment page — no payment started.
    const csp = (await headerMap())["Content-Security-Policy"];
    const formAction = csp
      .split("; ")
      .find((d) => d.startsWith("form-action "))!;
    expect(formAction.split(" ").slice(1).sort()).toEqual(
      [
        "'self'",
        "https://paynkolay.nkolayislem.com.tr",
        "https://paynkolaytest.nkolayislem.com.tr",
      ].sort(),
    );
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

  /**
   * The till reads QR codes with getUserMedia. `camera=()` is an EMPTY
   * allowlist - it denies the camera to every origin, this one included - so
   * shipping it turns /admin/kasa into a scanner that never opens a camera,
   * with no prompt and no error the cashier can act on. Both header sources
   * are checked because Vercel serves vercel.json's copy at the edge and
   * Next serves its own; one of them saying `camera=()` is enough to break it.
   */
  it("lets this origin - and only this origin - open the camera", async () => {
    const policy = (await headerMap())["Permissions-Policy"];
    expect(policy).toContain("camera=(self)");
    expect(policy).not.toMatch(/camera=\(\)/);

    const vercel = readFileSync("vercel.json", "utf8");
    expect(vercel).toContain("camera=(self)");
    expect(vercel).not.toMatch(/camera=\(\)/);
  });
});
