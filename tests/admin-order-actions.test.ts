import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  markShippedLabel,
  orderFulfillment,
  shippedStatusLabel,
} from "@/lib/admin/order-channel";

/**
 * `shipped` is one status with three meanings, and the app already tells the
 * member which one: ready at the counter, with the courier, with the carrier.
 * The panel called all three "kargo", so staff pressed "Kargoya ver" to say a
 * coffee was ready.
 */
describe("fulfillment vocabulary", () => {
  it("names the shipped status the way the app does", () => {
    expect(shippedStatusLabel("pickup")).toBe("Hazır");
    expect(shippedStatusLabel("delivery")).toBe("Kuryede");
    expect(shippedStatusLabel("shipping")).toBe("Kargoda");
  });

  it("names the button that gets an order there", () => {
    expect(markShippedLabel("pickup")).not.toContain("Kargo");
    expect(markShippedLabel("delivery")).toBe("Kuryeye ver");
    expect(markShippedLabel("shipping")).toBe("Kargoya ver");
  });

  it("still defaults rows written before the column existed to shipping", () => {
    expect(shippedStatusLabel(orderFulfillment({}))).toBe("Kargoda");
  });
});

const transitionOrder = vi.fn();
const logAudit = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "a@b.c" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  bulkUpdateOrders: vi.fn(),
  createManualOrder: vi.fn(),
  getOrderPaymentRef: vi.fn(),
  refundOrder: vi.fn(),
  setOrderInternalNote: vi.fn(),
  setOrderItemStatus: vi.fn(),
  setOrderTracking: vi.fn(),
  transitionOrder,
  updateOrderDetails: vi.fn(),
}));

const { transitionOrderAction } =
  await import("@/app/admin/siparisler/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  transitionOrder.mockReset();
  logAudit.mockClear();
});

describe("transitionOrderAction", () => {
  it("hands the store's refusal back instead of logging a move that never happened", async () => {
    transitionOrder.mockResolvedValue({
      ok: false,
      error: "Bu işlem 'shipped' durumunda yapılamaz.",
    });
    const state = await transitionOrderAction(
      {},
      form({ id: "ord-1", transition: "mark_shipped" }),
    );
    expect(state.error).toBe("Bu işlem 'shipped' durumunda yapılamaz.");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("audits the reached status only when the order actually moved", async () => {
    transitionOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-1", status: "shipped" },
    });
    const state = await transitionOrderAction(
      {},
      form({ id: "ord-1", transition: "mark_shipped" }),
    );
    expect(state.error).toBeUndefined();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transition",
        entityId: "ord-1",
        payload: { transition: "mark_shipped", to: "shipped" },
      }),
    );
  });

  it("rejects an unknown transition without touching the store", async () => {
    const state = await transitionOrderAction(
      {},
      form({ id: "ord-1", transition: "teleport" }),
    );
    expect(state.error).toBeTruthy();
    expect(transitionOrder).not.toHaveBeenCalled();
  });
});
