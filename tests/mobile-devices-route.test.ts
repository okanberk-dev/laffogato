import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `POST` / `DELETE /api/mobile/v1/devices` (docs/API-MOBILE.md §23): the
 * app's Expo push token, linked to the signed-in member. The token shape is
 * checked before anything is stored, the platform comes from the request,
 * and the answers are private, never cached.
 */

const auth = vi.hoisted(() => ({ requireMobileCustomer: vi.fn() }));
const devices = vi.hoisted(() => ({
  registerDevice: vi.fn(),
  unregisterDevice: vi.fn(),
}));
const limit = vi.hoisted(() => ({ reserveLoginAttempt: vi.fn() }));
vi.mock("@/lib/mobile/auth", () => auth);
vi.mock("@/lib/push/devices", () => devices);
vi.mock("@/lib/admin/rate-limit", () => limit);

const { POST, DELETE } = await import("@/app/api/mobile/v1/devices/route");

const TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuv]";
const URL_ = "https://laffogato.net/api/mobile/v1/devices";

function post(body: unknown, ua = "L'Affogato/3 CFNetwork/1568 Darwin/24.0.0") {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": ua, authorization: "Bearer x" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  auth.requireMobileCustomer.mockReset().mockResolvedValue({
    ok: true,
    customer: { email: "ayse@example.com" },
  });
  devices.registerDevice.mockReset().mockResolvedValue(0);
  devices.unregisterDevice.mockReset().mockResolvedValue(true);
  limit.reserveLoginAttempt.mockReset().mockResolvedValue({ blocked: false, retryAfterSeconds: 0, remaining: 19 });
});

describe("POST /devices", () => {
  it("answers the auth refusal as it is", async () => {
    auth.requireMobileCustomer.mockResolvedValueOnce({
      ok: false,
      response: new Response("{}", { status: 401 }),
    });
    expect((await POST(post({ token: TOKEN }))).status).toBe(401);
    expect(devices.registerDevice).not.toHaveBeenCalled();
  });

  it("refuses anything that is not an Expo push token", async () => {
    for (const token of ["", "abc", "ExponentPushToken[]", 42]) {
      const res = await POST(post({ token }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_request");
    }
    expect(devices.registerDevice).not.toHaveBeenCalled();
  });

  it("links the token to the member with the platform read from the request", async () => {
    const res = await POST(post({ token: TOKEN, platform: "android", appVersion: "1.2.0" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: TOKEN, registered: true });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(devices.registerDevice).toHaveBeenCalledWith({
      token: TOKEN,
      email: "ayse@example.com",
      platform: "ios",
    });
  });

  it("slows a loop down with 429 and Retry-After", async () => {
    limit.reserveLoginAttempt.mockResolvedValueOnce({ blocked: true, retryAfterSeconds: 60, remaining: 0 });
    const res = await POST(post({ token: TOKEN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await res.json()).error).toBe("rate_limited");
    expect(devices.registerDevice).not.toHaveBeenCalled();
  });

  it("is unavailable when the database is", async () => {
    const { DbUnreachableError } = await import("@/lib/db/health");
    devices.registerDevice.mockRejectedValueOnce(new DbUnreachableError("registerDevice", "connect ECONNREFUSED"));
    expect((await POST(post({ token: TOKEN }))).status).toBe(503);
  });
});

describe("DELETE /devices", () => {
  const del = (q: string) =>
    new Request(`${URL_}${q}`, { method: "DELETE", headers: { authorization: "Bearer x" } });

  it("forgets the member's own token", async () => {
    const res = await DELETE(del(`?token=${encodeURIComponent(TOKEN)}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: true });
    expect(devices.unregisterDevice).toHaveBeenCalledWith(TOKEN, "ayse@example.com");
  });

  it("answers removed:false when there was nothing of theirs", async () => {
    devices.unregisterDevice.mockResolvedValueOnce(false);
    const res = await DELETE(del(`?token=${encodeURIComponent(TOKEN)}`));
    expect(await res.json()).toEqual({ removed: false });
  });

  it("refuses a missing or malformed token", async () => {
    expect((await DELETE(del(""))).status).toBe(400);
    expect((await DELETE(del("?token=nope"))).status).toBe(400);
    expect(devices.unregisterDevice).not.toHaveBeenCalled();
  });
});
