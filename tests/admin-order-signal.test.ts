import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two counts the panel polls for.
 *
 * A gel-al order lands in the database with nobody touching the browser, and
 * every admin page is `force-dynamic` - rendered once, then dead. These two
 * actions are the only thing that makes an order arriving from the app
 * visible on a screen that is already open, so what matters is that they
 * answer cheaply, that they never redirect a background poll, and that a role
 * without order access gets nothing rather than a number.
 */

const countOpenOrders = vi.fn();
const countOrdersAfter = vi.fn();
const getAdminSession = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession,
  requireRole: vi.fn(async () => ({ email: "a@b.c", role: "owner" })),
}));
vi.mock("@/lib/admin/store", () => ({
  bulkUpdateOrders: vi.fn(),
  countOpenOrders,
  countOrdersAfter,
  createManualOrder: vi.fn(),
  getOrderPaymentRef: vi.fn(),
  refundOrder: vi.fn(),
  setOrderInternalNote: vi.fn(),
  setOrderItemStatus: vi.fn(),
  setOrderTracking: vi.fn(),
  transitionOrder: vi.fn(),
  updateOrderDetails: vi.fn(),
}));

const { newOrderCountAction, openOrderCountAction } = await import(
  "@/app/admin/siparisler/actions"
);

beforeEach(() => {
  countOpenOrders.mockReset();
  countOpenOrders.mockResolvedValue(4);
  countOrdersAfter.mockReset();
  countOrdersAfter.mockResolvedValue(2);
  getAdminSession.mockReset();
  getAdminSession.mockResolvedValue({ email: "a@b.c", role: "owner" });
});

describe("openOrderCountAction", () => {
  it("counts the open orders for the nav badge", async () => {
    await expect(openOrderCountAction()).resolves.toBe(4);
  });

  it("answers null for a signed-out caller instead of redirecting a poll", async () => {
    getAdminSession.mockResolvedValue(null);
    await expect(openOrderCountAction()).resolves.toBeNull();
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it("answers null for a cashier - the till role may not see the order list", async () => {
    getAdminSession.mockResolvedValue({ email: "kasa@b.c", role: "cashier" });
    await expect(openOrderCountAction()).resolves.toBeNull();
    expect(countOpenOrders).not.toHaveBeenCalled();
  });

  it("swallows a database failure: a background poll must not break the panel", async () => {
    countOpenOrders.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(openOrderCountAction()).resolves.toBeNull();
  });
});

describe("newOrderCountAction", () => {
  it("counts strictly above the highest orderNo the page has rendered", async () => {
    await expect(newOrderCountAction(1042)).resolves.toBe(2);
    expect(countOrdersAfter).toHaveBeenCalledWith(1042);
  });

  it("counts only open orders for the Açık tab, anything else as before", async () => {
    // The tab shows open orders only: a newer order already completed or
    // swept must not raise a banner "Listeyi yenile" cannot answer.
    await expect(newOrderCountAction(1042, "open")).resolves.toBe(2);
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042, [
      "pending_payment",
      "paid",
      "preparing",
      "shipped",
    ]);
    await newOrderCountAction(1042, "everything; drop table");
    expect(countOrdersAfter).toHaveBeenLastCalledWith(1042);
  });

  it("is gated like the badge", async () => {
    getAdminSession.mockResolvedValue(null);
    await expect(newOrderCountAction(1042)).resolves.toBeNull();
    expect(countOrdersAfter).not.toHaveBeenCalled();
  });

  it("swallows a database failure", async () => {
    countOrdersAfter.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(newOrderCountAction(1042)).resolves.toBeNull();
  });
});
