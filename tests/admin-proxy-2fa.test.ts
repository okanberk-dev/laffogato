import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * `/admin/iki-asama` is where a 2FA-enrolled admin types the TOTP code, and
 * all they hold at that point is the pending cookie. The proxy used to demand
 * the full session there too, so it bounced them to /admin/giris - which sent
 * them back to /admin/iki-asama - and nobody with 2FA on could sign in.
 */
describe("admin proxy and the 2FA step", () => {
  it("lets /admin/iki-asama through without a full session", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest("https://site.test/admin/iki-asama?next=%2Fadmin"),
    );
    expect(res.headers.get("location") ?? "").not.toContain("/admin/giris");
  });

  it("still sends a visitor without a session away from the panel", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest("https://site.test/admin/siparisler"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(
      "/admin/giris?next=%2Fadmin%2Fsiparisler",
    );
  });

  it("carries the page's query in next, not on the sign-in URL", async () => {
    // A re-login used to land on the unfiltered list, and the original query
    // (here a customer e-mail) stayed on /admin/giris's own URL.
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        "https://site.test/admin/siparisler?durum=acik&q=ayse%40example.com",
      ),
    );
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/admin/giris");
    expect([...to.searchParams.keys()]).toEqual(["next"]);
    expect(to.searchParams.get("next")).toBe(
      "/admin/siparisler?durum=acik&q=ayse%40example.com",
    );
  });

  it("does not open look-alike paths", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest("https://site.test/admin/iki-asama-x"),
    );
    expect(res.status).toBe(307);
  });
});
