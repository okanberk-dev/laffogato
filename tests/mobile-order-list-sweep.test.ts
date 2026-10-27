import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";

/**
 * `GET /orders` and a checkout nobody paid for (handoff (g) 2, 27 Oct 2026).
 *
 * The 45-minute sweep ran only when someone placed an order, so on a quiet
 * day a dead checkout sat in the app as an order in progress. The list now
 * runs the sweep itself - but only when the member's own list holds a
 * pending order past its window, so the common read costs nothing more - and
 * reads the list again when the sweep moved anything.
 */

const MIN = 60_000;
const rows: AdminOrder[] = [];

function order(
  id: string,
  status: string,
  ageMs: number,
  extra: Partial<AdminOrder> = {},
): AdminOrder {
  return {
    id,
    orderNo: 100,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status,
    items: [],
    subtotalMinor: 24500,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 24500,
    refunds: [],
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    legalConsent: {},
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    source: "",
    ...extra,
  } as unknown as AdminOrder;
}

const customerOrdersByEmail = vi.fn(async () => rows.map((r) => ({ ...r })));
const expireStalePendingOrders = vi.fn(async () => {
  let n = 0;
  for (const r of rows) {
    if (
      r.status === "pending_payment" &&
      r.source !== "manual" &&
      Date.now() - Date.parse(r.createdAt) >= 45 * MIN
    ) {
      r.status = "cancelled";
      n += 1;
    }
  }
  return n;
});

vi.mock("@/lib/admin/store", () => ({
  PENDING_ORDER_TTL_MINUTES: 45,
  customerOrdersByEmail,
  expireStalePendingOrders,
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  getOrderStamps: async () => new Map<string, number>(),
}));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => ({}) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}), TABLES: {} }));

const { listAppOrders, holdsExpiredCheckout } =
  await import("@/lib/mobile/orders");

const customer = {
  id: "cst-1",
  email: "eda@example.com",
  emailVerified: true,
} as unknown as PublicCustomer;

beforeEach(() => {
  rows.length = 0;
  customerOrdersByEmail.mockClear();
  expireStalePendingOrders.mockClear();
});

describe("GET /orders closes a dead checkout", () => {
  it("sweeps when the member's list holds an unpaid order past its window, and shows it closed", async () => {
    rows.push(order("ord-0001", "pending_payment", 50 * MIN));
    const list = await listAppOrders(customer);
    expect(expireStalePendingOrders).toHaveBeenCalledTimes(1);
    expect(customerOrdersByEmail).toHaveBeenCalledTimes(2);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("cancelled");
  });

  it("does not sweep for an unpaid order still inside its window", async () => {
    // The member may be on the bank's page right now.
    rows.push(order("ord-0002", "pending_payment", 5 * MIN));
    const list = await listAppOrders(customer);
    expect(expireStalePendingOrders).not.toHaveBeenCalled();
    expect(customerOrdersByEmail).toHaveBeenCalledTimes(1);
    expect(list[0].status).toBe("pending_payment");
  });

  it("does not sweep for a list with nothing unpaid in it", async () => {
    rows.push(order("ord-0003", "completed", 3 * 24 * 60 * MIN));
    await listAppOrders(customer);
    expect(expireStalePendingOrders).not.toHaveBeenCalled();
  });

  it("reads the list once when the sweep moved nothing (the POS could not be asked)", async () => {
    rows.push(order("ord-0004", "pending_payment", 50 * MIN));
    expireStalePendingOrders.mockResolvedValueOnce(0);
    const list = await listAppOrders(customer);
    expect(customerOrdersByEmail).toHaveBeenCalledTimes(1);
    expect(list[0].status).toBe("pending_payment");
  });

  it("still answers with the list when the sweep throws", async () => {
    rows.push(order("ord-0005", "pending_payment", 50 * MIN));
    expireStalePendingOrders.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const list = await listAppOrders(customer);
    expect(list).toHaveLength(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("holdsExpiredCheckout", () => {
  const now = Date.now();
  it("is the sweep's own rule: unpaid, not manual, older than 45 minutes", () => {
    expect(
      holdsExpiredCheckout([order("a", "pending_payment", 46 * MIN)], now),
    ).toBe(true);
    expect(
      holdsExpiredCheckout([order("b", "pending_payment", 44 * MIN)], now),
    ).toBe(false);
    expect(
      holdsExpiredCheckout(
        [order("c", "pending_payment", 90 * MIN, { source: "manual" })],
        now,
      ),
    ).toBe(false);
    expect(holdsExpiredCheckout([order("d", "paid", 90 * MIN)], now)).toBe(
      false,
    );
  });

  it("does not read an unreadable timestamp as expired", () => {
    expect(
      holdsExpiredCheckout(
        [{ status: "pending_payment", source: "", createdAt: "" }],
        now,
      ),
    ).toBe(false);
  });
});
