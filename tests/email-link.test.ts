import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_LINK_COOKIE,
  EMAIL_LINK_PATH,
  decodeEmailLink,
  encodeEmailLink,
  parseEmailLink,
} from "@/lib/customer/email-link";

process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";

const h = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  deleted: [] as unknown[],
  redirected: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    delete: (c: unknown) => h.deleted.push(c),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/supabase/anon", () => ({
  getSupabaseAnonClient: () => ({ auth: { verifyOtp: h.verifyOtp } }),
}));

/**
 * The sign-up mail's confirmation link (operator, 5 Kas 2026; docs/AUTH.md
 * §5d in lafmobil): `/uygulama/dogrula?token_hash=…&type=email`, the same
 * address the app's screen opens. On the site the token is parked in a
 * cookie before the page loads its tags, and spent only on the button's POST.
 */
const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef01234567";

describe("parseEmailLink", () => {
  it("reads a token hash and the two confirmation types", () => {
    expect(parseEmailLink(HASH, "email")).toEqual({
      tokenHash: HASH,
      type: "email",
    });
    expect(parseEmailLink(HASH, "signup")).toEqual({
      tokenHash: HASH,
      type: "signup",
    });
    expect(parseEmailLink(HASH, null)).toEqual({
      tokenHash: HASH,
      type: "email",
    });
  });

  it("refuses a mangled token or another kind of link", () => {
    expect(parseEmailLink("kisa", "email")).toBeNull();
    expect(parseEmailLink(`${HASH}"><script>`, "email")).toBeNull();
    expect(parseEmailLink(HASH, "recovery")).toBeNull();
  });

  it("survives the trip through its cookie", () => {
    const link = parseEmailLink(HASH, "email")!;
    expect(decodeEmailLink(encodeEmailLink(link))).toEqual(link);
    expect(decodeEmailLink("bozuk")).toBeNull();
  });
});

describe("the proxy parks the token", () => {
  it("moves it into a path-scoped httpOnly cookie and drops it from the URL", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(
        `https://site.test${EMAIL_LINK_PATH}?token_hash=${HASH}&type=email`,
      ),
    );
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe(EMAIL_LINK_PATH);
    expect(location.search).toBe("");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${EMAIL_LINK_COOKIE}=email%3A${HASH}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/uygulama\/dogrula/i);
  });

  it("leaves the answer page alone", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(`https://site.test${EMAIL_LINK_PATH}?sonuc=tamam`),
    );
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("confirmEmailLinkAction", () => {
  beforeEach(() => {
    h.verifyOtp.mockReset();
    h.deleted.length = 0;
    h.redirected = null;
  });

  async function press(fields: Record<string, string>) {
    const { confirmEmailLinkAction } =
      await import("@/app/uygulama/dogrula/actions");
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    await expect(confirmEmailLinkAction(form)).rejects.toThrow("NEXT_REDIRECT");
  }

  it("confirms on the button and says so", async () => {
    h.verifyOtp.mockResolvedValue({ data: {}, error: null });
    await press({ token_hash: HASH, type: "email" });
    expect(h.verifyOtp).toHaveBeenCalledWith({
      token_hash: HASH,
      type: "email",
    });
    expect(h.redirected).toBe(`${EMAIL_LINK_PATH}?sonuc=tamam`);
    // The parked token goes whatever the answer.
    expect(h.deleted).toHaveLength(1);
  });

  it("reads a spent or expired token as a request for a new mail", async () => {
    h.verifyOtp.mockResolvedValue({
      data: {},
      error: { status: 403, message: "Email link is invalid or has expired" },
    });
    await press({ token_hash: HASH, type: "email" });
    expect(h.redirected).toBe(`${EMAIL_LINK_PATH}?sonuc=gecersiz`);
  });

  it("tells a failure of the identity service apart from a bad link", async () => {
    h.verifyOtp.mockResolvedValue({
      data: {},
      error: { status: 503, message: "upstream" },
    });
    await press({ token_hash: HASH, type: "email" });
    expect(h.redirected).toBe(`${EMAIL_LINK_PATH}?sonuc=hata`);
  });

  it("spends no request on a form without a real token", async () => {
    await press({ token_hash: "x", type: "email" });
    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(h.redirected).toBe(`${EMAIL_LINK_PATH}?sonuc=gecersiz`);
  });
});
