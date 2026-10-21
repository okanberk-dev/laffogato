import { beforeEach, describe, expect, it, vi } from "vitest";

import { DbUnreachableError } from "@/lib/db/health";
import { apiError } from "@/lib/mobile/respond";

/**
 * `POST /staff/stamp` - a barista scanning a member's QR from the app
 * (docs/API-MOBILE.md §21). The rules of the scan itself belong to
 * `redeemCounterToken` (tests/mobile-counter.test.ts, and the real-database
 * run in tests/db-integration-staff-stamp.test.ts); this file holds the
 * gates in front of it and how its answers reach the wire.
 */

const requireMobileCustomer = vi.fn();
const isActiveBarista = vi.fn();
const redeemCounterToken = vi.fn();
const logAudit = vi.fn();
const checkLoginLimit = vi.fn();
const recordLoginFailure = vi.fn();

vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/admin/staff-members", () => ({ isActiveBarista }));
vi.mock("@/lib/mobile/counter", () => ({ redeemCounterToken }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/rate-limit", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/rate-limit")>();
  return {
    clientIpFrom: real.clientIpFrom,
    checkLoginLimit,
    recordLoginFailure,
  };
});

const { POST } = await import("@/app/api/mobile/v1/staff/stamp/route");

const BARISTA = "bora@ornek.com";

function request(body: unknown): Request {
  return new Request("https://laffogato.net/api/mobile/v1/staff/stamp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.0.0.9",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

function refused(error: string, message = "Sunucu mesajı.") {
  redeemCounterToken.mockResolvedValue({ ok: false, error, message });
}

beforeEach(() => {
  requireMobileCustomer.mockReset();
  requireMobileCustomer.mockResolvedValue({
    ok: true,
    customer: { email: BARISTA, emailVerified: true },
  });
  isActiveBarista.mockReset();
  isActiveBarista.mockResolvedValue(true);
  checkLoginLimit.mockReset();
  checkLoginLimit.mockResolvedValue({
    blocked: false,
    retryAfterSeconds: 0,
    remaining: 15,
  });
  recordLoginFailure.mockReset();
  logAudit.mockReset();
  logAudit.mockResolvedValue(undefined);
  redeemCounterToken.mockReset();
  redeemCounterToken.mockResolvedValue({
    ok: true,
    redemption: {
      name: "Eda",
      memberLabel: "e***@ornek.com",
      code: "K7P42M9X",
      stampsGiven: 1,
      loyalty: {
        stamps: 4,
        stampTarget: 6,
        rewardsReady: 0,
        lifetimeStamps: 10,
      },
    },
  });
});

describe("gates", () => {
  it("passes the bearer refusal through untouched", async () => {
    requireMobileCustomer.mockResolvedValue({
      ok: false,
      response: apiError(401, "unauthorized", "Giriş yapman gerekiyor."),
    });
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(res.status).toBe(401);
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("refuses an unverified address before looking at the grant", async () => {
    requireMobileCustomer.mockResolvedValue({
      ok: true,
      customer: { email: BARISTA, emailVerified: false },
    });
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe("email_unverified");
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("answers 403 not_staff to a member without a grant, before reading the body", async () => {
    isActiveBarista.mockResolvedValue(false);
    const res = await POST(request("bu JSON değil"));
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe("not_staff");
    expect(isActiveBarista).toHaveBeenCalledWith(BARISTA);
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("has no e-mail path: only a scanned token or a typed code", async () => {
    const res = await POST(request({ kind: "email", value: "eda@ornek.com" }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("invalid_request");
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After while the barista is locked out", async () => {
    checkLoginLimit.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 42,
      remaining: 0,
    });
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await errorOf(res)).toBe("rate_limited");
    expect(checkLoginLimit).toHaveBeenCalledWith(
      "staff-stamp",
      "10.0.0.9",
      BARISTA,
    );
    expect(redeemCounterToken).not.toHaveBeenCalled();
  });
});

describe("the scan", () => {
  it("runs the till's redeemCounterToken as the barista, refusing their own code", async () => {
    await POST(request({ kind: "token", value: " jeton " }));
    expect(redeemCounterToken).toHaveBeenCalledWith({
      kind: "token",
      value: "jeton",
      stamps: 1,
      actor: BARISTA,
      note: "Uygulama",
      refuseOwner: BARISTA,
    });
  });

  it("hands a stamp count on unclamped, for the till's own range check", async () => {
    await POST(request({ kind: "code", value: "K7P42M9X", stamps: 99 }));
    expect(redeemCounterToken).toHaveBeenCalledWith(
      expect.objectContaining({ stamps: 99 }),
    );
  });

  it("answers the till's result shape, private", async () => {
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({
      name: "Eda",
      memberLabel: "e***@ornek.com",
      code: "K7P42M9X",
      stampsGiven: 1,
      stamps: 4,
      stampTarget: 6,
      rewardsReady: 0,
    });
  });

  it("audits the scan with the barista as the actor", async () => {
    await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "counter_token",
      entityId: "K7P42M9X",
      payload: { kind: "code", stamps: 1, via: "app" },
      actor: BARISTA,
    });
  });

  it("does not turn given stamps into a 500 when the audit row fails", async () => {
    logAudit.mockRejectedValue(new Error("audit down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    spy.mockRestore();
    expect(res.status).toBe(200);
  });

  it.each([
    ["self_stamp", 403],
    ["already_used", 409],
    ["expired", 409],
    ["not_found", 404],
    ["invalid_stamps", 400],
  ])("maps %s to %i with the same code", async (code, status) => {
    refused(code);
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(res.status).toBe(status);
    expect(await errorOf(res)).toBe(code);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("counts only a code that matched nothing against the limiter", async () => {
    refused("not_found");
    await POST(request({ kind: "code", value: "ZZZZZZZZ" }));
    expect(recordLoginFailure).toHaveBeenCalledWith(
      "staff-stamp",
      "10.0.0.9",
      BARISTA,
    );

    recordLoginFailure.mockReset();
    refused("already_used");
    await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("answers a stamp run that stopped half-way exactly as the throw it was", async () => {
    // The till now says "verilmiş olabilir"; the app's contract is unchanged.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    redeemCounterToken.mockResolvedValue({
      ok: false,
      error: "partial",
      message: "Damga verilmiş olabilir, üyenin kartını kontrol et.",
      stampsWritten: 1,
      stampsAsked: 2,
      code: "K7P42M9X",
      memberLabel: "e***@ornek.com",
      cause: new DbUnreachableError("addCounterStamp", "ECONNRESET"),
    });
    const down = await POST(request({ kind: "code", value: "K7P42M9X" }));
    expect(down.status).toBe(503);
    expect(await errorOf(down)).toBe("unavailable");
    redeemCounterToken.mockResolvedValue({
      ok: false,
      error: "partial",
      message: "x",
      stampsWritten: 0,
      stampsAsked: 1,
      code: "K7P42M9X",
      memberLabel: "e***@ornek.com",
      cause: new Error("insert failed"),
    });
    const broken = await POST(request({ kind: "code", value: "K7P42M9X" }));
    spy.mockRestore();
    expect(broken.status).toBe(500);
    expect(await errorOf(broken)).toBe("internal");
    expect(logAudit).not.toHaveBeenCalled();
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("answers 503 when the database is unreachable", async () => {
    isActiveBarista.mockRejectedValue(new DbUnreachableError("staff", "down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(request({ kind: "code", value: "K7P42M9X" }));
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toBe("unavailable");
  });
});
