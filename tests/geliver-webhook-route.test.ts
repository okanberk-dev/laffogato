import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/webhooks/geliver — the route, end to end, with the store mocked.
 *
 * `tests/mobile-shipment.test.ts` pins the READER (Geliver's vocabulary → the
 * contract's six words). This file pins what the route does with it: that
 * nothing is read before the caller is authenticated, that each failure has
 * its own status so a Vercel log filter can name it, and that the four
 * "accepted but nothing written" outcomes stay 200 — a webhook sender retries
 * anything else forever.
 *
 * The secret is compared constant-time against `GELIVER_WEBHOOK_SECRET`;
 * Geliver signs nothing today (the SDK's verifier is a stub), so the static
 * header the panel attaches is the whole of the authentication.
 */
const setOrderShipmentStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({ setOrderShipmentStatus }));

const { POST } = await import("@/app/api/webhooks/geliver/route");

const SECRET = "test-secret-0123456789abcdef0123456789";
const URL = "https://laffogato.net/api/webhooks/geliver";

function post(body: string | null, headers: Record<string, string> = {}) {
  return POST(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: body ?? undefined,
    }),
  );
}

const SIGNED = { "x-geliver-signature": SECRET };

/** The documented shape: `{ event, data: Shipment }`, `trackingStatus` an object. */
const REAL = JSON.stringify({
  event: "TRACK_UPDATED",
  data: {
    statusCode: "SHIPPED",
    trackingNumber: "1234567890123",
    trackingUrl: "https://kargo.example/t/123",
    updatedAt: "2026-09-22T09:00:00Z",
    trackingStatus: { trackingStatusCode: "IN_TRANSIT", statusDate: "2026-09-22T08:55:00Z" },
  },
});

const ORDER = { id: "ord-1", orderNo: 284 };

beforeEach(() => {
  process.env.GELIVER_WEBHOOK_SECRET = SECRET;
  setOrderShipmentStatus.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.GELIVER_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe("authentication comes first", () => {
  it("503 while the secret is unset — never a guessable door", async () => {
    delete process.env.GELIVER_WEBHOOK_SECRET;
    const res = await post(REAL, SIGNED);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "geliver_secret_unset" });
    expect(setOrderShipmentStatus).not.toHaveBeenCalled();
  });

  it("401 with no header, and 401 with the wrong one", async () => {
    expect((await post(REAL)).status).toBe(401);
    expect((await post(REAL, { "x-geliver-signature": "nope" })).status).toBe(401);
    // Same length, one byte off: the constant-time compare must still say no.
    const off = SECRET.slice(0, -1) + (SECRET.endsWith("9") ? "8" : "9");
    expect((await post(REAL, { "x-geliver-signature": off })).status).toBe(401);
    expect(setOrderShipmentStatus).not.toHaveBeenCalled();
  });

  it("accepts the same secret as a bearer token", async () => {
    setOrderShipmentStatus.mockResolvedValue({ outcome: "applied", order: ORDER });
    const res = await post(REAL, { authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
  });

  it("does not read the body before authenticating: garbage + wrong secret is 401, not 400", async () => {
    const res = await post("{not json", { "x-geliver-signature": "nope" });
    expect(res.status).toBe(401);
  });
});

describe("a broken delivery is a 400, so it shows in the logs", () => {
  it("empty body", async () => {
    const res = await post("", SIGNED);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "empty_body" });
  });

  it("body that is not JSON", async () => {
    const res = await post("{not json", SIGNED);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_json" });
  });

  it("JSON that is not an object", async () => {
    expect((await post("[1,2,3]", SIGNED)).status).toBe(400);
    expect((await post('"SHIPPED"', SIGNED)).status).toBe(400);
    expect((await post("null", SIGNED)).status).toBe(400);
    expect(setOrderShipmentStatus).not.toHaveBeenCalled();
  });
});

describe("what Geliver sent correctly", () => {
  it("writes the documented shape — statusCode under data, the code inside trackingStatus", async () => {
    setOrderShipmentStatus.mockResolvedValue({ outcome: "applied", order: ORDER });
    const res = await post(REAL, SIGNED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, orderNo: 284, status: "in_transit" });
    // The scan's own instant, not the row's: statusDate before updatedAt.
    expect(setOrderShipmentStatus).toHaveBeenCalledWith(
      "1234567890123",
      "in_transit",
      "https://kargo.example/t/123",
      "2026-09-22T08:55:00Z",
    );
  });

  it("answers a test delivery and writes nothing, whatever number it carries", async () => {
    const body = JSON.parse(REAL) as { data: { trackingStatus: Record<string, unknown> } };
    body.data.trackingStatus.test = true;
    const res = await post(JSON.stringify(body), SIGNED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, test: true, wouldApply: "in_transit", written: false });
    expect(setOrderShipmentStatus).not.toHaveBeenCalled();
  });

  it("200 + ignored for a number no order carries", async () => {
    setOrderShipmentStatus.mockResolvedValue({ outcome: "unknown" });
    const res = await post(REAL, SIGNED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: "unknown_tracking_number" });
    // The number itself is never logged — its length is.
    const logged = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toContain("1234567890123");
    expect(logged).toContain("13 karakter");
  });

  it("200 + ignored for an event older than the row", async () => {
    setOrderShipmentStatus.mockResolvedValue({ outcome: "stale", order: ORDER });
    const res = await post(REAL, SIGNED);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: "stale", orderNo: 284 });
  });

  it("200 + the field NAMES for a shape it cannot map — never a value", async () => {
    const res = await post(JSON.stringify({ hello: "gizli-deger", data: { foo: "gizli" } }), SIGNED);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; ignored: string; fields: string };
    expect(body.ignored).toBe("unmapped");
    expect(body.fields).toContain("hello");
    expect(body.fields).toContain("foo");
    expect(body.fields).not.toContain("gizli");
    expect(setOrderShipmentStatus).not.toHaveBeenCalled();
  });

  it("never caches", async () => {
    setOrderShipmentStatus.mockResolvedValue({ outcome: "applied", order: ORDER });
    const res = await post(REAL, SIGNED);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
