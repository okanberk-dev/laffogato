import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WS1-02 at the wire: a spent reopen budget is 429 `rate_limited` with a
 * `Retry-After`, on both doors that reopen the POS for an existing order.
 * The budget itself is tested in `mobile-order-idempotency`.
 */

const requireMobileCustomer = vi.fn();
const payAppOrder = vi.fn();
const createAppOrder = vi.fn();

vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/mobile/orders", () => ({
  payAppOrder,
  createAppOrder,
  listAppOrders: vi.fn(),
}));

const payment = await import("@/app/api/mobile/v1/orders/[id]/payment/route");
const orders = await import("@/app/api/mobile/v1/orders/route");

const LIMITED = {
  status: 429,
  code: "rate_limited",
  message: "Ödeme sayfasını çok sık açtın. 9 dakika sonra tekrar dene.",
  headers: { "Retry-After": "540" },
};

beforeEach(() => {
  requireMobileCustomer.mockReset();
  requireMobileCustomer.mockResolvedValue({
    ok: true,
    customer: { email: "eda@example.com", emailVerified: true },
  });
  payAppOrder.mockReset();
  createAppOrder.mockReset();
});

describe("POST /orders/{id}/payment", () => {
  it("is 429 rate_limited with Retry-After once the reopen budget is spent", async () => {
    payAppOrder.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
      failure: LIMITED,
    });
    const res = await payment.POST(
      new Request("https://laffogato.net/api/mobile/v1/orders/ord-1/payment", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ id: "ord-1" }) },
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("540");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
    expect(body.message).toBe(LIMITED.message);
  });
});

describe("POST /orders (a clientOrderId replay)", () => {
  it("carries the refusal's Retry-After to the wire", async () => {
    createAppOrder.mockResolvedValue({ ok: false, failure: LIMITED });
    const res = await orders.POST(
      new Request("https://laffogato.net/api/mobile/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "cafe",
          fulfillment: "pickup",
          lines: [{ menuItemId: "mnu-0007", qty: 1, size: "M" }],
          legalConsent: true,
          clientOrderId: "attempt-1",
        }),
      }) as never,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("540");
    expect((await res.json()).error).toBe("rate_limited");
  });
});
