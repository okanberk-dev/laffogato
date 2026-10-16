import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { checkoutCsp, newCspNonce } from "@/lib/security/checkout-csp";

/**
 * The checkout document's own policy (docs/PAYNKOLAY.md §15.5): the card is
 * typed on /odeme, so that document admits no third party and no inline
 * script without this request's nonce.
 */

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );
}

describe("checkoutCsp", () => {
  const nonce = newCspNonce();
  const csp = directives(checkoutCsp(nonce));

  it("runs only this origin's scripts and the nonce's", () => {
    expect(csp.get("script-src")).toEqual(["'self'", `'nonce-${nonce}'`]);
  });

  it("admits no third party anywhere a script could load or send from", () => {
    const all = [...csp.values()].flat().join(" ");
    expect(all).not.toMatch(/googletagmanager|google-analytics|doubleclick/);
    expect(all).not.toContain("'unsafe-eval'");
    expect(csp.get("script-src")).not.toContain("'unsafe-inline'");
    expect(csp.get("script-src")).not.toContain("https:");
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.get("frame-src")).toEqual(["'none'"]);
    expect(csp.get("worker-src")).toEqual(["'none'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
  });

  it("loads images from this origin and data: only", () => {
    expect(csp.get("img-src")).toEqual(["'self'", "data:"]);
    expect(csp.get("img-src")).not.toContain("https:");
    expect(csp.get("img-src")).not.toContain("blob:");
  });

  it("closes the injection and framing primitives", () => {
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
  });

  it("allows eval only for next dev", () => {
    const dev = directives(checkoutCsp(nonce, { development: true }));
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
  });

  it("mints a fresh, well-formed nonce each time and refuses a bad one", () => {
    const a = newCspNonce();
    const b = newCspNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(() => checkoutCsp("bad nonce'; script-src *")).toThrow();
    expect(() => checkoutCsp("")).toThrow();
  });
});

describe("the proxy's wiring", () => {
  it("puts the policy on the request (for Next's nonce) and the response", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest("https://laffogato.net/odeme", {
        // A client cannot choose its own nonce: whatever it sends is replaced.
        headers: {
          "content-security-policy":
            "script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAAAA'",
        },
      }),
    );
    const sent = res.headers.get("content-security-policy") ?? "";
    expect(sent).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]{24}'/);
    expect(sent).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAA");
    // NextResponse.next({ request }) forwards overridden request headers as
    // x-middleware-request-*; Next reads the nonce from there.
    expect(
      res.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(sent);
    // Fresh per request.
    const again = await proxy(new NextRequest("https://laffogato.net/odeme"));
    expect(again.headers.get("content-security-policy")).not.toBe(sent);
  });

  it("leaves every other page to the site policy", async () => {
    const { proxy } = await import("@/proxy");
    for (const path of ["/", "/odeme/donus", "/odeme/basarili", "/magaza"]) {
      const res = await proxy(new NextRequest(`https://laffogato.net${path}`));
      expect(res.headers.get("content-security-policy"), path).toBeNull();
    }
  });

  it("keeps /odeme dynamic, so every view gets its own nonce", () => {
    const page = readFileSync("src/app/odeme/(checkout)/page.tsx", "utf8");
    expect(page).toContain('export const dynamic = "force-dynamic";');
  });
});
