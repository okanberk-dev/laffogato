import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

import { durableCopyResponse } from "@/lib/legal/durable-copy-http";

import nextConfig from "../next.config";

/**
 * The site's CSP rule: every path but the two pages that send a narrower
 * policy of their own - the checkout (/odeme, a nonce policy from
 * src/proxy.ts, tests/checkout-csp.test.ts) and the payment page
 * (/odeme/paynkolay). Changed deliberately on 16 Eki 2026, when the card
 * moved onto /odeme (docs/PAYNKOLAY.md §15.5).
 */
const CSP_SOURCE = "/:path((?!odeme$|odeme/paynkolay$).*)";

/**
 * The headers an ordinary page gets: the catch-all rule plus the CSP rule.
 * The CSP sits in a rule of its own because /odeme and /odeme/paynkolay are
 * outside it.
 */
async function headerMap() {
  const rules = await nextConfig.headers!();
  const entries = rules
    .filter((r) => r.source === "/:path*" || r.source === CSP_SOURCE)
    .flatMap((r) => r.headers.map((h) => [h.key, h.value] as const));
  return Object.fromEntries(entries) as Record<string, string>;
}

/** The contract downloads (ASK-DURABLE): each rule's source and a path it serves. */
const DURABLE_COPY_PATHS = [
  [
    "/uye/hesap/siparislerim/:orderNo/sozlesme",
    "/uye/hesap/siparislerim/10042/sozlesme",
  ],
  ["/rezervasyon/sozlesme", "/rezervasyon/sozlesme"],
] as const;

/** Next's own matcher for a `source` - what decides which paths get a rule. */
function matches(source: string, path: string): boolean {
  return !!getPathMatch(source, { strict: true, removeUnnamedParams: true })(
    path,
  );
}

describe("security headers", () => {
  it("sends a Content-Security-Policy on every route but the checkout and the payment page", async () => {
    const h = await headerMap();
    expect(h["Content-Security-Policy"]).toBeTruthy();
    const rules = await nextConfig.headers!();
    expect(rules[0].source).toBe("/:path*");
    const csp = rules.filter((r) =>
      r.headers.some((x) => x.key === "Content-Security-Policy"),
    );
    // The site policy, then the two contract downloads replacing it with
    // their own, narrower one (the last describe below).
    expect(csp.map((r) => r.source)).toEqual([
      CSP_SOURCE,
      ...DURABLE_COPY_PATHS.map(([source]) => source),
    ]);
    // Exactly two paths are outside it, each sending its own, narrower
    // policy: /odeme/paynkolay on every response
    // (tests/paynkolay-card-page.test.ts) and /odeme from the proxy
    // (tests/checkout-csp.test.ts). Everything else under /odeme stays in.
    for (const path of [
      "/",
      "/odeme/donus",
      "/odeme/basarili",
      "/odeme/app-hata",
      "/odemex",
      "/odeme/x",
      "/odeme/paynkolayx",
      "/odeme/paynkolay/x",
      "/admin/kasa",
      "/uye/giris",
    ]) {
      expect(matches(CSP_SOURCE, path), path).toBe(true);
    }
    expect(matches(CSP_SOURCE, "/odeme/paynkolay")).toBe(false);
    expect(matches(CSP_SOURCE, "/odeme")).toBe(false);
  });

  it("confines scripts to this origin, Google Tag Manager and the Meta Pixel", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "))!;
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
    // fbevents.js (25 Ekim 2026): that one host, never a wildcard.
    expect(scriptSrc).toContain("https://connect.facebook.net");
    expect(scriptSrc).not.toMatch(/facebook\.com/);
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

  it("lets a form on an ordinary page post to this site only", async () => {
    // The PayNkolay hosts used to be listed here for the bridge page's POST
    // (docs/PAYNKOLAY.md §14.6/1). That page is outside this policy now and
    // names the POS - or the bank - in its own (§15), so no other page may
    // post a form off-site.
    const csp = (await headerMap())["Content-Security-Policy"];
    const formAction = csp
      .split("; ")
      .find((d) => d.startsWith("form-action "))!;
    expect(formAction).toBe("form-action 'self'");
  });

  it("does not let an injected script exfiltrate to an arbitrary host", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    const connect = csp.split("; ").find((d) => d.startsWith("connect-src "))!;
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/connect-src[^;]*\shttps:(\s|$)/);
  });

  it("lets the Meta Pixel report to Meta and nowhere else new", async () => {
    const csp = (await headerMap())["Content-Security-Policy"];
    const connect = csp.split("; ").find((d) => d.startsWith("connect-src "))!;
    expect(connect).toContain("https://www.facebook.com");
    expect(connect).toContain("https://connect.facebook.net");
    expect(connect).not.toMatch(/\*\.facebook/);
    // The pixel's beacon is an image request: img-src already admits https:,
    // and was left alone.
    expect(csp).toContain("img-src 'self' data: blob: https:");
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

  /**
   * Vercel serves vercel.json's catch-all headers at the edge and Next serves
   * its own. They had drifted (X-Frame-Options SAMEORIGIN vs DENY, a one-year
   * HSTS without includeSubDomains, a Permissions-Policy without payment=()),
   * so a response could carry two disagreeing copies of a header. Every key
   * vercel.json sets must say exactly what next.config.ts says.
   */
  it("keeps vercel.json's copies identical to next.config.ts", async () => {
    const next = await headerMap();
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const catchAll = vercel.headers.find((h) => h.source === "/(.*)");
    expect(catchAll).toBeTruthy();
    for (const { key, value } of catchAll!.headers) {
      expect(next[key], key).toBe(value);
    }
  });

  it("sends no referrer to an http page and only the origin cross-site", async () => {
    const h = await headerMap();
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("does not announce the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  /**
   * The files in public/ that are not content-hashed - brand art, venue and
   * menu photos, the site's drawings - get a day in the browser and a week of
   * background revalidation instead of a revalidation on every visit.
   */
  it("caches the brand art, photos and drawings for a day", async () => {
    const rules = await nextConfig.headers!();
    const cacheFor = (path: string) =>
      rules
        .filter((r) => matches(r.source, path))
        .flatMap((r) => r.headers)
        .filter((h) => h.key === "Cache-Control")
        .map((h) => h.value);
    for (const path of [
      "/brand/laf-monogram.svg",
      "/photos/kosk.webp",
      "/menu/affogato.webp",
      "/illustrations/spot-siparis.svg",
      "/illustrations/karaoke-room.webp",
    ]) {
      expect(cacheFor(path), path).toEqual([
        "public, max-age=86400, stale-while-revalidate=604800",
      ]);
    }
    expect(cacheFor("/illustrations-x/a.svg")).toEqual([]);
    expect(cacheFor("/kampanyalar")).toEqual([]);
  });

  /**
   * The pour widget is rebuilt in place under one name, so it gets an hour
   * (plus a day of background revalidation), not the day-long art rule - and
   * vercel.json must not serve a second, different Cache-Control for it.
   */
  it("caches the pour widget for an hour, in one place", async () => {
    const rules = await nextConfig.headers!();
    const pour = rules.find((r) => r.source === "/laffogato-pour.js");
    expect(pour?.headers).toEqual([
      {
        key: "Cache-Control",
        value: "public, max-age=3600, stale-while-revalidate=86400",
      },
    ]);
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    for (const rule of vercel.headers) {
      if (!new RegExp(`^${rule.source}$`).test("/laffogato-pour.js")) continue;
      for (const h of rule.headers) {
        if (h.key.toLowerCase() === "cache-control") {
          expect(h.value).toBe(
            "public, max-age=3600, stale-while-revalidate=86400",
          );
        }
      }
    }
  });

  /**
   * A route handler's header reaches the wire only when no rule in
   * next.config.ts has set the same key (Next's send-response copies it
   * "if it is not present in the outbound response"). The site rules set
   * Content-Security-Policy and Referrer-Policy on every path, so before
   * 21 Eki 2026 the downloads went out with the site policy (scripts
   * allowed, no sandbox) and the signed karaoke link in a Referer. A later
   * rule for the two paths carries the route's own values; vercel.json,
   * which decides on Vercel, repeats it after its catch-all.
   */
  describe("the contract downloads keep their own headers", () => {
    type Rule = {
      source: string;
      headers: Array<{ key: string; value: string }>;
    };
    /** Every matching rule in order, a later one winning a key. */
    function onTheWire(rules: Rule[], path: string, match: typeof matches) {
      const out: Record<string, string> = {};
      for (const rule of rules) {
        if (!match(rule.source, path)) continue;
        for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
      }
      return out;
    }
    const route = durableCopyResponse({ filename: "x.html", html: "<p>x</p>" });

    it.each(DURABLE_COPY_PATHS)(
      "%s: next.config.ts shadows none of the route's headers",
      async (_source, path) => {
        const config = onTheWire(await nextConfig.headers!(), path, matches);
        const shadowed = [...route.headers.entries()].filter(
          ([name, value]) => name in config && config[name] !== value,
        );
        expect(shadowed).toEqual([]);
        expect(config["content-security-policy"]).toContain("sandbox");
        expect(config["referrer-policy"]).toBe("no-referrer");
      },
    );

    it.each(DURABLE_COPY_PATHS)(
      "%s: vercel.json says the same after its catch-all",
      async (_source, path) => {
        const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
          headers: Rule[];
        };
        // vercel.json's sources are path-to-regexp too; "/(.*)" included.
        const edge = onTheWire(vercel.headers, path, matches);
        const shadowed = [...route.headers.entries()].filter(
          ([name, value]) => name in edge && edge[name] !== value,
        );
        expect(shadowed).toEqual([]);
        expect(edge["referrer-policy"]).toBe("no-referrer");
        expect(edge["content-security-policy"]).toBe(
          route.headers.get("content-security-policy"),
        );
      },
    );
  });
});
