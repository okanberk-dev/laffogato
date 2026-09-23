import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/bulten/cikis` - the address in every commercial message's
 * `List-Unsubscribe` header and footer link (docs/EMAIL-RESEND.md §7).
 *
 * POST is the RFC 8058 one-click: a mail client posts
 * `List-Unsubscribe=One-Click` and expects a 200, no page. GET is a person
 * following the link: a 303 to the page, which spends the token itself. The
 * two must not swap - a GET that spends the token lets link scanners
 * unsubscribe people; a POST that redirects makes the client's button do
 * nothing, which is exactly the bug the route was written to fix.
 */

const unsubscribeByToken = vi.fn();
const unsubscribeCustomerByToken = vi.fn();
const checkLoginLimit = vi.fn();
const recordLoginFailure = vi.fn();

vi.mock("@/lib/newsletter/store", () => ({ unsubscribeByToken }));
vi.mock("@/lib/customer/unsubscribe", () => ({ unsubscribeCustomerByToken }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIpFrom: (h: Headers) =>
    h.get("x-forwarded-for")?.split(",")[0].trim() ?? "",
  checkLoginLimit,
  recordLoginFailure,
}));

const { GET, POST } = await import("@/app/api/bulten/cikis/route");

const ORIGIN = "https://laffogato.net";
const OPEN = { blocked: false, retryAfterSeconds: 0, remaining: 19 };

function post(query: string, init: RequestInit = {}): Request {
  return new Request(`${ORIGIN}/api/bulten/cikis${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      ...(init.headers ?? {}),
    },
    body: "List-Unsubscribe=One-Click",
    ...init,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  unsubscribeByToken.mockResolvedValue(null);
  unsubscribeCustomerByToken.mockResolvedValue(null);
  checkLoginLimit.mockResolvedValue(OPEN);
  recordLoginFailure.mockResolvedValue(OPEN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST - RFC 8058 one-click", () => {
  it("spends a subscriber token and answers 200 plain text, without trying the member store", async () => {
    unsubscribeByToken.mockResolvedValue("abone@ornek.com");
    const res = await POST(post("?token=t1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Abonelikten çıkıldı.");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(unsubscribeByToken).toHaveBeenCalledWith("t1");
    expect(unsubscribeCustomerByToken).not.toHaveBeenCalled();
  });

  it("falls through to the member store only when the subscriber list has no such token", async () => {
    unsubscribeCustomerByToken.mockResolvedValue("uye@ornek.com");
    const res = await POST(post("?token=m1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Abonelikten çıkıldı.");
    expect(unsubscribeByToken).toHaveBeenCalledWith("m1");
    expect(unsubscribeCustomerByToken).toHaveBeenCalledWith("m1");
    expect(unsubscribeByToken.mock.invocationCallOrder[0]).toBeLessThan(
      unsubscribeCustomerByToken.mock.invocationCallOrder[0],
    );
  });

  it("answers 200 for an unknown or spent token - the address is off the list either way", async () => {
    const res = await POST(post("?token=onizleme"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("geçersiz");
    expect(unsubscribeByToken).toHaveBeenCalledWith("onizleme");
    expect(unsubscribeCustomerByToken).toHaveBeenCalledWith("onizleme");
  });

  it("touches no store without a token, and counts the hit as a miss", async () => {
    const res = await POST(post(""));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("geçersiz");
    expect(unsubscribeByToken).not.toHaveBeenCalled();
    expect(unsubscribeCustomerByToken).not.toHaveBeenCalled();
    expect(recordLoginFailure).toHaveBeenCalledTimes(1);
  });

  it("trims the token and never redirects", async () => {
    unsubscribeByToken.mockResolvedValue("abone@ornek.com");
    const res = await POST(post("?token=%20t2%20"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(unsubscribeByToken).toHaveBeenCalledWith("t2");
  });

  it("reports a store failure as 500 rather than a false 'çıkıldı'", async () => {
    unsubscribeByToken.mockRejectedValue(new Error("db down"));
    const res = await POST(post("?token=t3"));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Şu an işlenemedi.");
  });

  describe("throttles failures, not opt-outs", () => {
    // The POST comes from the mail provider's shared servers, not the
    // person's device, and opt-outs from one provider cluster right after a
    // campaign: a valid token must never fill the bucket, or the twentieth
    // person's legally mandated opt-out is refused while their address
    // stays in the audience.
    it("checks the bucket first and never counts a valid token", async () => {
      unsubscribeByToken.mockResolvedValue("abone@ornek.com");
      const res = await POST(post("?token=t4"));
      expect(res.status).toBe(200);
      expect(checkLoginLimit).toHaveBeenCalledWith(
        "unsubscribe",
        "203.0.113.9",
        "one-click",
      );
      expect(checkLoginLimit.mock.invocationCallOrder[0]).toBeLessThan(
        unsubscribeByToken.mock.invocationCallOrder[0],
      );
      expect(recordLoginFailure).not.toHaveBeenCalled();
    });

    it("counts a token that matched nothing - unknown or already spent", async () => {
      const res = await POST(post("?token=harcanmis"));
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("geçersiz");
      expect(recordLoginFailure).toHaveBeenCalledTimes(1);
      expect(recordLoginFailure).toHaveBeenCalledWith(
        "unsubscribe",
        "203.0.113.9",
        "one-click",
      );
    });

    it("answers 429 once the bucket is full, touching no store and counting nothing", async () => {
      checkLoginLimit.mockResolvedValue({
        blocked: true,
        retryAfterSeconds: 42,
        remaining: 0,
      });
      const res = await POST(post("?token=t5"));
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("42");
      expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(unsubscribeByToken).not.toHaveBeenCalled();
      expect(unsubscribeCustomerByToken).not.toHaveBeenCalled();
      expect(recordLoginFailure).not.toHaveBeenCalled();
    });

    it("lets a real opt-out through even when the limiter cannot be read", async () => {
      // checkLoginLimit fails open on a database error (it returns OPEN);
      // what the route must not do is turn that into a refusal.
      unsubscribeByToken.mockResolvedValue("abone@ornek.com");
      checkLoginLimit.mockResolvedValue(OPEN);
      const res = await POST(post("?token=t6"));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("Abonelikten çıkıldı.");
    });
  });
});

describe("GET - a person following the footer link", () => {
  it("303-redirects to the page with the token, spending nothing", async () => {
    const res = await GET(new Request(`${ORIGIN}/api/bulten/cikis?token=t9`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/bulten/cikis?token=t9`);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(unsubscribeByToken).not.toHaveBeenCalled();
    expect(unsubscribeCustomerByToken).not.toHaveBeenCalled();
    // No database work of its own, so no bucket either.
    expect(checkLoginLimit).not.toHaveBeenCalled();
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("redirects a tokenless link to the page without a token parameter", async () => {
    const res = await GET(new Request(`${ORIGIN}/api/bulten/cikis`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/bulten/cikis`);
  });
});
