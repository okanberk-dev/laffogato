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
 * The reset e-mail links to `/uye/sifre-sifirla?token=...`, and that page
 * loads GTM: GA4's page_location and any pixel's `dl` carry the full URL,
 * query string included, to a third party - with a token that opens the
 * account for an hour. The proxy takes the token out of the URL before the
 * page ever renders.
 */
describe("the password-reset link", () => {
  it("moves the token into a path-scoped httpOnly cookie and drops it from the URL", async () => {
    const { proxy } = await import("@/proxy");
    const token = "a".repeat(64);
    const res = await proxy(
      new NextRequest(`https://site.test/uye/sifre-sifirla?token=${token}`),
    );
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/uye/sifre-sifirla");
    expect(location.search).toBe("");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`laffogato_reset_token=${token}`);
    expect(cookie).toMatch(/Path=\/uye\/sifre-sifirla/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=3600/i);
  });

  it("does not park a value that cannot be a token", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        `https://site.test/uye/sifre-sifirla?token=${"b".repeat(500)}`,
      ),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie") ?? "").not.toContain(
      "laffogato_reset_token",
    );
  });

  it("leaves the bare page alone", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest("https://site.test/uye/sifre-sifirla"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("the page reads the parked cookie", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/uye/sifre-sifirla/page.tsx", "utf8");
    expect(page).toContain("get(RESET_TOKEN_COOKIE)");
  });
});
