import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin refund hands the provider what the payment row already knows -
 * the POS's day for the transaction and what it collected - so PayNkolay can
 * refund without searching thirteen monthly windows for the date
 * (docs/PAYNKOLAY.md §14.5). A row written before the column carries '' and
 * the provider falls back to that search; the action passes it on as is.
 */

const refund = vi.fn();
const getOrderPaymentRef = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "a@b.c" })),
  getAdminSession: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "paynkolay", refund }),
}));
vi.mock("@/lib/admin/store", () => ({
  getOrder: vi.fn(async () => ({ id: "ord-1", status: "paid" })),
  orderWasCollected: vi.fn(async () => true),
  refundRefusal: vi.fn(() => null),
  reserveRefund: vi.fn(async () => ({
    ok: true,
    refund: { id: "rfn-1" },
    order: { id: "ord-1" },
  })),
  releaseRefund: vi.fn(),
  finalizeRefund: vi.fn(),
  getOrderPaymentRef,
}));

const { refundOrderAction } = await import("@/app/admin/siparisler/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  refund.mockReset();
  refund.mockResolvedValue({ status: "succeeded" });
  getOrderPaymentRef.mockReset();
});

describe("refundOrderAction", () => {
  it("passes the payment row's day and collected amount to the provider", async () => {
    getOrderPaymentRef.mockResolvedValue({
      provider: "paynkolay",
      providerRef: "IKSIRPF102168",
      amountMinor: 128_010,
      trxDate: "2026-09-01",
    });
    const state = await refundOrderAction(
      {},
      form({ id: "ord-1", amount: "1.280,10", reason: "Müşteri iptali" }),
    );
    expect(state.error).toBeUndefined();
    expect(refund).toHaveBeenCalledWith("IKSIRPF102168", 128_010, {
      trxDate: "2026-09-01",
      paidMinor: 128_010,
    });
  });

  it("passes an unknown day through as '', for the provider to look up", async () => {
    getOrderPaymentRef.mockResolvedValue({
      provider: "paynkolay",
      providerRef: "IKSIRPF102168",
      amountMinor: 128_010,
      trxDate: "",
    });
    await refundOrderAction(
      {},
      form({ id: "ord-1", amount: "1280,10", reason: "Müşteri iptali" }),
    );
    expect(refund).toHaveBeenCalledWith("IKSIRPF102168", 128_010, {
      trxDate: "",
      paidMinor: 128_010,
    });
  });
});
