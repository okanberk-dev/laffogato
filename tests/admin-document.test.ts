import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_PENDING_COOKIE,
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_PENDING_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
} from "@/lib/admin/session-cookie";
import { adminSessionKey } from "@/lib/admin/session-key";
import { adminCsp, isAdminDocumentPath } from "@/lib/security/admin-document";
import { newCspNonce } from "@/lib/security/checkout-csp";

import nextConfig from "../next.config";

const SECRET = "x".repeat(40);
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * The panel against a tag on the site (docs/AUDIT.md §13): its documents
 * carry their own nonce policy with no third party and cannot be framed, and
 * its cookies are scoped to /admin, the whole-origin ones of before moved
 * there on the next page view.
 */

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );
}

/** A session token as auth.ts signs it (email|role|exp|fingerprint|sig). */
function sessionToken(expiresAt: number, secret = SECRET): string {
  const payload = `sahip@laffogato.net|owner|${expiresAt}|abcdef0123456789abcdef01`;
  const sig = createHmac("sha256", adminSessionKey(secret))
    .update(payload)
    .digest("hex");
  return `${payload}|${sig}`;
}

function request(
  path: string,
  init: { method?: string; cookies?: Record<string, string> } = {},
): NextRequest {
  const cookie = Object.entries(init.cookies ?? {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
  return new NextRequest(`https://laffogato.net${path}`, {
    method: init.method ?? "GET",
    headers: cookie ? { cookie } : {},
  });
}

/** The Set-Cookie lines of a response, by name. */
function setCookies(res: Response): Map<string, string> {
  return new Map(
    res.headers.getSetCookie().map((line) => [line.split("=")[0], line]),
  );
}

/** The cookie header Next forwards to the render (proxy request override). */
function forwardedCookies(res: Response): string {
  return res.headers.get("x-middleware-request-cookie") ?? "";
}

describe("adminCsp", () => {
  const nonce = newCspNonce();
  const csp = directives(adminCsp(nonce));

  it("runs only this origin's scripts and the nonce's", () => {
    expect(csp.get("script-src")).toEqual(["'self'", `'nonce-${nonce}'`]);
  });

  it("admits no third party a script could load from or send to", () => {
    const all = [...csp.values()].flat().join(" ");
    expect(all).not.toMatch(/googletagmanager|google-analytics|doubleclick/);
    expect(all).not.toContain("'unsafe-eval'");
    expect(csp.get("script-src")).not.toContain("'unsafe-inline'");
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("frame-src")).toEqual(["'none'"]);
    // The order alert poller's blob: worker.
    expect(csp.get("worker-src")).toEqual(["'self'", "blob:"]);
  });

  it("cannot be framed, by the site's own pages either", () => {
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
  });

  it("allows eval only for next dev and refuses a bad nonce", () => {
    const dev = directives(adminCsp(nonce, { development: true }));
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(() => adminCsp("bad nonce'; script-src *")).toThrow();
    expect(() => adminCsp("")).toThrow();
  });
});

describe("isAdminDocumentPath", () => {
  it("is the panel and its sign-in screens, read decoded", () => {
    for (const p of [
      "/admin",
      "/admin/",
      "/admin/giris",
      "/admin/iki-asama",
      "/admin/musteriler/ayse%40example.com",
      "/%61dmin/siparisler",
    ]) {
      expect(isAdminDocumentPath(p), p).toBe(true);
    }
    for (const p of ["/", "/administrator", "/admin-x", "/x/admin", "/odeme"]) {
      expect(isAdminDocumentPath(p), p).toBe(false);
    }
  });
});

describe("the proxy on panel documents", () => {
  it("sends the panel policy on every /admin document, sign-in and 2FA included", async () => {
    const { proxy } = await import("@/proxy");
    for (const path of [
      "/admin/giris",
      "/admin/iki-asama",
      "/admin",
      "/admin/siparisler",
      "/%61dmin/siparisler",
    ]) {
      const res = await proxy(request(path));
      const sent = res.headers.get("content-security-policy") ?? "";
      expect(sent, path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]{24}'/);
      expect(sent, path).toContain("frame-ancestors 'none'");
      expect(sent, path).not.toContain("googletagmanager");
      expect(sent, path).not.toContain("'unsafe-inline' https://www.google");
      // Next reads the nonce from the request header it forwards (a page
      // that renders; the signed-out ones here are a redirect).
      if (res.status === 307) continue;
      expect(
        res.headers.get("x-middleware-request-content-security-policy"),
        path,
      ).toBe(sent);
    }
  });

  it("mints a fresh nonce per view and ignores one the client sends", async () => {
    const { proxy } = await import("@/proxy");
    const a = await proxy(
      new NextRequest("https://laffogato.net/admin/giris", {
        headers: {
          "content-security-policy":
            "script-src 'nonce-AAAAAAAAAAAAAAAAAAAAAAAA'",
        },
      }),
    );
    const b = await proxy(request("/admin/giris"));
    const sentA = a.headers.get("content-security-policy");
    expect(sentA).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAA");
    expect(sentA).not.toBe(b.headers.get("content-security-policy"));
  });

  it("leaves the site's pages to the site policy", async () => {
    const { proxy } = await import("@/proxy");
    for (const path of ["/", "/magaza", "/administrator", "/uye/giris"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("content-security-policy"), path).toBeNull();
    }
  });

  it("sends the panel without a session to the sign-in page", async () => {
    // What a site page's fetch("/admin/...") gets when the browser holds no
    // panel cookie for it.
    const { proxy } = await import("@/proxy");
    const res = await proxy(request("/admin/musteriler"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/giris");
  });

  it("keeps the panel unframeable in the site-wide headers too", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    expect(
      getPathMatch(all.source, { strict: true, removeUnnamedParams: true })(
        "/admin/giris",
      ),
    ).toBeTruthy();
    expect(all.headers).toContainEqual({
      key: "X-Frame-Options",
      value: "DENY",
    });
  });

  it("keeps every panel page dynamic, so each view gets its own nonce", async () => {
    // The admin layout reads the session cookie for every page under it.
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    expect(layout).toMatch(/await getAdminSession\(\)/);
  });
});

describe("the whole-origin admin cookies of before", () => {
  const hour = 60 * 60 * 1000;

  it("are moved under /admin on a page view, the session's own life kept", async () => {
    const { proxy } = await import("@/proxy");
    const token = sessionToken(Date.now() + 2 * hour);
    const res = await proxy(
      request("/admin/siparisler", {
        cookies: { [LEGACY_ADMIN_SESSION_COOKIE]: token },
      }),
    );
    // Signed in on this very view: no bounce to the sign-in page.
    expect(res.status).not.toBe(307);
    const set = setCookies(res);
    const moved = set.get(ADMIN_SESSION_COOKIE)!;
    expect(moved).toContain(
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    );
    expect(moved).toMatch(/Path=\/admin(;|$)/);
    expect(moved).toMatch(/HttpOnly/i);
    expect(moved).toMatch(/SameSite=lax/i);
    const maxAge = Number(/Max-Age=(\d+)/.exec(moved)![1]);
    expect(maxAge).toBeGreaterThan(2 * 3600 - 60);
    expect(maxAge).toBeLessThanOrEqual(2 * 3600);
    // The old copy expires where it lived.
    const old = set.get(LEGACY_ADMIN_SESSION_COOKIE)!;
    expect(old).toMatch(/Path=\/(;|$)/);
    expect(old).toMatch(/Expires=Thu, 01 Jan 1970/);
    // The render sees the panel cookie, not the old one.
    const fwd = forwardedCookies(res);
    expect(fwd).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(fwd).not.toContain(`${LEGACY_ADMIN_SESSION_COOKIE}=`);
  });

  it("move the pending 2FA cookie too", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      request("/admin/iki-asama", {
        cookies: { [LEGACY_ADMIN_PENDING_COOKIE]: "pending|x|owner|db|1|sig" },
      }),
    );
    const set = setCookies(res);
    expect(set.get(ADMIN_PENDING_COOKIE)).toMatch(/Path=\/admin(;|$)/);
    expect(set.get(LEGACY_ADMIN_PENDING_COOKIE)).toMatch(/Path=\/(;|$)/);
    expect(forwardedCookies(res)).toContain(`${ADMIN_PENDING_COOKIE}=`);
  });

  it("leave a Server Action's answer alone but still sign the action in", async () => {
    // The action may sign out: a panel cookie written here too would race
    // its own Set-Cookie. Sign-out expires the old cookie itself.
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      request("/admin/siparisler", {
        method: "POST",
        cookies: {
          [LEGACY_ADMIN_SESSION_COOKIE]: sessionToken(Date.now() + hour),
        },
      }),
    );
    expect(res.status).not.toBe(307);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(forwardedCookies(res)).toContain(`${ADMIN_SESSION_COOKIE}=`);
  });

  it("are expired, not moved, when forged or expired", async () => {
    const { proxy } = await import("@/proxy");
    for (const token of [
      sessionToken(Date.now() + hour, "another-secret-another-secret-xx"),
      sessionToken(Date.now() - 1000),
    ]) {
      const res = await proxy(
        request("/admin/siparisler", {
          cookies: { [LEGACY_ADMIN_SESSION_COOKIE]: token },
        }),
      );
      expect(res.status).toBe(307);
      const set = setCookies(res);
      expect(set.has(ADMIN_SESSION_COOKIE)).toBe(false);
      expect(set.get(LEGACY_ADMIN_SESSION_COOKIE)).toMatch(/Path=\/(;|$)/);
    }
  });

  it("give way to a panel session the browser already holds", async () => {
    const { proxy } = await import("@/proxy");
    const current = sessionToken(Date.now() + 3 * hour);
    const res = await proxy(
      request("/admin/siparisler", {
        cookies: {
          [ADMIN_SESSION_COOKIE]: current,
          [LEGACY_ADMIN_SESSION_COOKIE]: sessionToken(Date.now() + hour),
        },
      }),
    );
    const set = setCookies(res);
    expect(set.has(ADMIN_SESSION_COOKIE)).toBe(false);
    expect(set.get(LEGACY_ADMIN_SESSION_COOKIE)).toMatch(/Path=\/(;|$)/);
    expect(forwardedCookies(res)).toContain(
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(current)}`,
    );
  });

  it("are not touched on the site's pages", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      request("/magaza", {
        cookies: {
          [LEGACY_ADMIN_SESSION_COOKIE]: sessionToken(Date.now() + hour),
        },
      }),
    );
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("do not open the panel under the old name any more", async () => {
    // Only the proxy reads the old name; the panel reads the new one.
    const { readFileSync } = await import("node:fs");
    const auth = readFileSync("src/lib/admin/auth.ts", "utf8");
    expect(auth).not.toContain('"laffogato_admin_session"');
    expect(auth).toContain("const COOKIE_NAME = ADMIN_SESSION_COOKIE;");
  });
});
