import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);

/**
 * "[supabase] getUser timed out; continuing unrefreshed" was logged 472
 * times on 9-17 Eki 2026, on every page a signed-in member opened: the
 * proxy waited on the identity service before the home page, the menu or
 * the checkout rendered, though none of them reads the Supabase session.
 * The refresh now runs only under `/uye`, and a timeout there leaves the
 * member's cookies exactly as they came.
 */

type SetAll = (
  cookies: Array<{ name: string; value: string; options: object }>,
  headers?: Record<string, string>,
) => void;

const getClaims = vi.fn(async () => ({ data: { claims: {} }, error: null }));
const setAlls: SetAll[] = [];
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: SetAll } },
  ) => {
    setAlls.push(options.cookies.setAll);
    return { auth: { getClaims } };
  },
}));

const SB = "sb-wvivcgctebyxojtyidfg-auth-token";
const SITE = "laffogato_customer_session";
const SIGNED_IN = `${SB}=base64-abc; ${SITE}=signed.site.token`;

function signedIn(path: string): NextRequest {
  return new NextRequest(`https://laffogato.net${path}`, {
    headers: { cookie: SIGNED_IN },
  });
}

/** The cookies the proxy forwards to the page, as Next reads them. */
function forwardedCookies(res: NextResponse): string | null {
  return res.headers.get("x-middleware-request-cookie");
}

afterEach(() => {
  getClaims.mockClear();
  setAlls.length = 0;
});

describe("where the session is refreshed", () => {
  it.each(["/uye", "/uye/giris", "/uye/kayit", "/uye/hesap/siparislerim"])(
    "refreshes on the member page %s",
    async (path) => {
      const { isSessionRefreshPath } = await import("@/lib/supabase/proxy");
      expect(isSessionRefreshPath(path)).toBe(true);
      const { proxy } = await import("@/proxy");
      await proxy(signedIn(path));
      expect(getClaims).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "/",
    "/menu",
    "/magaza/kahve",
    "/rehber/matcha-nedir",
    "/karaoke",
    "/odeme",
    "/odeme/basarili",
    "/masa/ABCDEFGHJK",
    "/admin/siparisler",
    "/admin/giris",
    "/uyelik",
    "/uyeler/x",
  ])("asks the identity service nothing on %s", async (path) => {
    const { isSessionRefreshPath } = await import("@/lib/supabase/proxy");
    expect(isSessionRefreshPath(path)).toBe(false);
    const { proxy } = await import("@/proxy");
    const res = await proxy(signedIn(path));
    expect(getClaims).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie") ?? "").not.toContain("sb-");
  });

  it.each(["/uye/giris", "/uye/hesap"])(
    "builds no client for an anonymous visitor on %s",
    async (path) => {
      const { proxy } = await import("@/proxy");
      await proxy(new NextRequest(`https://laffogato.net${path}`));
      expect(setAlls).toHaveLength(0);
      expect(getClaims).not.toHaveBeenCalled();
    },
  );

  it("keeps the checkout's nonce policy on the forwarded request", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(signedIn("/odeme"));
    expect(res.headers.get("Content-Security-Policy")).toContain("nonce-");
    expect(
      res.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(res.headers.get("Content-Security-Policy"));
  });
});

describe("a refresh that times out", () => {
  it("neither deletes nor rewrites the member's cookies", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let late!: () => void;
      getClaims.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            late = () => resolve({ data: { claims: {} }, error: null });
          }),
      );
      const { proxy } = await import("@/proxy");
      const pending = proxy(signedIn("/uye/hesap"));
      await vi.advanceTimersByTimeAsync(3000);
      const res = await pending;

      expect(error).toHaveBeenCalledWith(
        "[supabase] session refresh timed out; continuing unrefreshed",
      );
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(forwardedCookies(res)).toBe(SIGNED_IN);

      // The refresh finishes after the bound and its client clears the
      // cookies: too late for this request and its response, which have
      // already gone.
      expect(setAlls).toHaveLength(1);
      setAlls[0]!([
        { name: SB, value: "", options: { maxAge: 0 } },
        { name: SITE, value: "", options: { maxAge: 0 } },
      ]);
      late();
      await vi.advanceTimersByTimeAsync(0);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(forwardedCookies(res)).toBe(SIGNED_IN);
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does the same when the identity service cannot be reached", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getClaims.mockImplementationOnce(async () => {
        throw new Error("fetch failed");
      });
      const { proxy } = await import("@/proxy");
      const res = await proxy(signedIn("/uye/hesap"));
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(forwardedCookies(res)).toBe(SIGNED_IN);
    } finally {
      error.mockRestore();
    }
  });

  it("still writes a refresh that answers in time", async () => {
    getClaims.mockImplementationOnce(async () => {
      setAlls[0]!([
        { name: SB, value: "base64-rotated", options: { path: "/" } },
      ]);
      return { data: { claims: {} }, error: null };
    });
    const { proxy } = await import("@/proxy");
    const res = await proxy(signedIn("/uye/hesap"));
    expect(res.headers.get("set-cookie")).toContain(`${SB}=base64-rotated`);
    expect(forwardedCookies(res)).toContain(`${SB}=base64-rotated`);
    expect(forwardedCookies(res)).toContain(`${SITE}=signed.site.token`);
  });
});
