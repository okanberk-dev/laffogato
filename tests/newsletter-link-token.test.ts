import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * The newsletter's confirm link (`/bulten/onay?token=`) and unsubscribe link
 * (`/bulten/cikis?token=`, also reached through `/api/bulten/cikis`) land on
 * pages that load the site's tags, and GTM's report the full URL. As with
 * the password reset link (reset-link-token.test.ts), the proxy parks the
 * token in a cookie scoped to the page and reloads without it
 * (docs/AUDIT.md §11).
 */
describe("the newsletter links", () => {
  const token = "c".repeat(48);

  it.each([
    ["/bulten/onay", "laffogato_bulten_onay"],
    ["/bulten/cikis", "laffogato_bulten_cikis"],
  ])(
    "%s moves the token into a path-scoped httpOnly cookie and drops it from the URL",
    async (path, cookieName) => {
      const { proxy } = await import("@/proxy");
      const res = await proxy(
        new NextRequest(`https://site.test${path}?token=${token}`),
      );
      expect(res.status).toBe(303);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe(path);
      expect(location.search).toBe("");
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain(`${cookieName}=${token}`);
      expect(cookie).toMatch(
        new RegExp(`Path=${path.replace(/\//g, "\\/")}`, "i"),
      );
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Max-Age=3600/i);
    },
  );

  it("an impossible token is not parked, and clears the previous link's", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        `https://site.test/bulten/cikis?token=${"d".repeat(500)}`,
      ),
    );
    expect(res.status).toBe(303);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).not.toContain("d".repeat(500));
    expect(cookie).toMatch(/laffogato_bulten_cikis=;/);
  });

  it("leaves the answer pages and a posted button alone", async () => {
    const { proxy } = await import("@/proxy");
    for (const url of [
      "https://site.test/bulten/onay?sonuc=tamam",
      "https://site.test/bulten/cikis?sonuc=tamam&adres=a***%40example.com",
    ]) {
      const res = await proxy(new NextRequest(url));
      expect(res.headers.get("location"), url).toBeNull();
    }
    // The page's own button posts a Server Action to the bare path; a POST
    // with a token in the address is not a page view either.
    const posted = await proxy(
      new NextRequest(`https://site.test/bulten/cikis?token=${token}`, {
        method: "POST",
      }),
    );
    expect(posted.headers.get("location")).toBeNull();
  });

  it("the pages read the parked cookie, and the buttons drop it", () => {
    for (const [page, key] of [
      ["src/app/bulten/onay/page.tsx", '"/bulten/onay"'],
      ["src/app/bulten/cikis/page.tsx", '"/bulten/cikis"'],
    ]) {
      expect(readFileSync(page, "utf8")).toContain(
        `get(NEWSLETTER_LINK_COOKIES[${key}])`,
      );
    }
    const actions = readFileSync("src/app/newsletter/actions.ts", "utf8");
    expect(actions).toContain('await forgetLinkToken("/bulten/onay");');
    expect(actions).toContain('await forgetLinkToken("/bulten/cikis");');
    // A helper in a "use server" file would be a public endpoint (rule 27).
    expect(actions).not.toMatch(/export async function forgetLinkToken/);
  });

  it("the mail client's one-click POST is outside the proxy and unchanged", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain("api/bulten");
  });
});
