import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A refund made outside this panel (operator, 22 Oct 2026: "siparişi iptal
 * edince PayNkolay'dan manuel iade ediyorum ama panelde iade edildi
 * işaretleyemiyorum"), src/lib/admin/order-ops.ts:
 *
 * - "PayNkolay'da iade ettim" records what the operator typed;
 * - "PayNkolay'dan iadeyi bul" asks PayNkolay's list and records the part
 *   the ledger does not have yet.
 *
 * Neither sends anything to the POS (a second request would refund twice);
 * both go through the same ledger, status, stock and mail as a refund.
 */

const refund = vi.fn();
const lookupRefunds = vi.fn();
const getOrderPaymentRef = vi.fn();
const listPaymentTransactions = vi.fn();
const reserveRefund = vi.fn();
const finalizeRefund = vi.fn();
const safeAudit = vi.fn(async () => true);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "a@b.c", role: "owner" })),
  getAdminSession: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(), safeAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "paynkolay", refund, lookupRefunds }),
}));

let order: Record<string, unknown>;

vi.mock("@/lib/admin/store", () => ({
  getOrder: vi.fn(async () => order),
  orderMoney: vi.fn(async () => ({
    collected: true,
    collectedMinor: 128_010,
    destination: "card",
  })),
  refundRefusal: vi.fn(() => null),
  reserveRefund,
  releaseRefund: vi.fn(),
  finalizeRefund,
  restockOrderLines: vi.fn(async () => []),
  setOrderAttention: vi.fn(async () => true),
  getOrderPaymentRef,
  listPaymentTransactions,
}));

const { recordOutsideRefundAction, findPosRefundAction } =
  await import("@/app/admin/siparisler/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  order = {
    id: "ord-1",
    orderNo: 10023,
    status: "cancelled",
    totalMinor: 128_010,
    refunds: [],
    items: [],
    paidAt: "2026-10-16T10:00:00.000Z",
    createdAt: "2026-10-16T09:58:00.000Z",
    attention: "refund_due",
  };
  refund.mockReset();
  lookupRefunds.mockReset();
  getOrderPaymentRef.mockReset();
  getOrderPaymentRef.mockResolvedValue({
    provider: "paynkolay",
    providerRef: "IKSIRPF102168",
    amountMinor: 128_010,
    trxDate: "2026-10-16",
  });
  listPaymentTransactions.mockReset();
  listPaymentTransactions.mockResolvedValue([
    { provider: "paynkolay", status: "succeeded", amountMinor: 128_010 },
  ]);
  reserveRefund.mockReset();
  reserveRefund.mockImplementation(
    async (_id: string, input: { amountMinor: number }) => ({
      ok: true,
      refund: { id: "rfn-1", amountMinor: input.amountMinor },
      order: {
        ...order,
        refunds: [{ id: "rfn-1", amountMinor: input.amountMinor }],
      },
    }),
  );
  finalizeRefund.mockReset();
  finalizeRefund.mockImplementation(async (o: unknown) => ({
    order: o,
    mail: "sent",
  }));
  safeAudit.mockClear();
});

describe("PayNkolay'da iade ettim", () => {
  it("records the typed amount as a refund made outside, without calling the POS", async () => {
    const state = await recordOutsideRefundAction(
      null,
      form({
        id: "ord-1",
        amount: "1.280,10",
        reason: "PayNkolay panelinden iade edildi.",
        confirm: "10023",
        token: "tok-1",
      }),
    );
    expect(state).toMatchObject({ ok: true });
    expect(refund).not.toHaveBeenCalled();
    expect(reserveRefund).toHaveBeenCalledWith(
      "ord-1",
      expect.objectContaining({
        amountMinor: 128_010,
        destination: "card",
        outside: "paynkolay_panel",
        token: "tok-1",
      }),
    );
    // The status, the stamps and the buyer's "iade edildi" mail follow.
    expect(finalizeRefund).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ viaCard: true }),
    );
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "refund",
        payload: expect.objectContaining({ outside: "paynkolay_panel" }),
      }),
    );
    expect((state as { message: string }).message).toContain(
      "POS'a istek gönderilmedi",
    );
  });

  it("asks for the order number first", async () => {
    const state = await recordOutsideRefundAction(
      null,
      form({ id: "ord-1", amount: "100", reason: "Elle iade", confirm: "1" }),
    );
    expect(state).toMatchObject({ ok: false });
    expect(reserveRefund).not.toHaveBeenCalled();
  });

  it("refuses an order that was not paid through PayNkolay", async () => {
    getOrderPaymentRef.mockResolvedValue({
      provider: "manual:nakit",
      providerRef: "",
      amountMinor: 128_010,
      trxDate: "",
    });
    const state = await recordOutsideRefundAction(
      null,
      form({
        id: "ord-1",
        amount: "100",
        reason: "Elle iade",
        confirm: "10023",
      }),
    );
    expect(state).toMatchObject({ ok: false });
    expect(reserveRefund).not.toHaveBeenCalled();
  });
});

describe("PayNkolay'dan iadeyi bul", () => {
  it("records only what PayNkolay shows beyond the ledger", async () => {
    order.refunds = [{ id: "rfn-0", amountMinor: 20_000 }];
    lookupRefunds.mockResolvedValue({
      refundedMinor: 128_010,
      rows: [
        { kind: "refund", amountMinor: 20_000, day: "2026-10-17" },
        { kind: "refund", amountMinor: 108_010, day: "2026-10-21" },
      ],
      from: "2026-10-15",
      to: "2026-10-22",
    });
    const state = await findPosRefundAction(null, form({ id: "ord-1" }));
    expect(state).toMatchObject({ ok: true });
    expect(lookupRefunds).toHaveBeenCalledWith(
      "ord-1",
      new Date("2026-10-16T10:00:00.000Z"),
    );
    expect(refund).not.toHaveBeenCalled();
    expect(reserveRefund).toHaveBeenCalledWith(
      "ord-1",
      expect.objectContaining({
        amountMinor: 108_010,
        outside: "paynkolay_lookup",
        // Two presses at once compute the same token: the ledger keeps one.
        token: "pos-find-128010-20000",
      }),
    );
  });

  it("says so when PayNkolay shows no refund, and records nothing", async () => {
    lookupRefunds.mockResolvedValue({
      refundedMinor: 0,
      rows: [],
      from: "2026-10-15",
      to: "2026-10-22",
    });
    const state = await findPosRefundAction(null, form({ id: "ord-1" }));
    expect(state).toMatchObject({
      ok: false,
      error: expect.stringContaining("iade ya da iptal görünmüyor"),
    });
    expect(reserveRefund).not.toHaveBeenCalled();
  });

  it("says so when everything PayNkolay shows is already recorded", async () => {
    order.refunds = [{ id: "rfn-0", amountMinor: 128_010 }];
    lookupRefunds.mockResolvedValue({
      refundedMinor: 128_010,
      rows: [{ kind: "cancel", amountMinor: 128_010, day: "2026-10-16" }],
      from: "2026-10-15",
      to: "2026-10-22",
    });
    const state = await findPosRefundAction(null, form({ id: "ord-1" }));
    expect(state).toMatchObject({ ok: false });
    expect(reserveRefund).not.toHaveBeenCalled();
  });

  it("never reads a PayNkolay that did not answer as 'no refund'", async () => {
    lookupRefunds.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await findPosRefundAction(null, form({ id: "ord-1" }));
    expect(state).toMatchObject({
      ok: false,
      error: expect.stringContaining("PayNkolay'a sorulamadı"),
    });
    expect(reserveRefund).not.toHaveBeenCalled();
  });
});

describe("an order PayNkolay charged twice (duplicate_payment)", () => {
  beforeEach(() => {
    order = { ...order, status: "completed", attention: "duplicate_payment" };
    listPaymentTransactions.mockResolvedValue([
      { provider: "paynkolay", status: "succeeded", amountMinor: 128_010 },
      { provider: "paynkolay", status: "succeeded", amountMinor: 128_010 },
    ]);
  });

  it("does not book the duplicate's cancel as this order's refund", async () => {
    // The operator cancelled the extra charge in PayNkolay, as its banner
    // says; PaymentList shows that cancel under the order's clientRefCode.
    lookupRefunds.mockResolvedValue({
      refundedMinor: 128_010,
      rows: [{ kind: "cancel", amountMinor: 128_010, day: "2026-10-16" }],
      from: "2026-10-15",
      to: "2026-10-22",
    });
    const state = await findPosRefundAction(null, form({ id: "ord-1" }));
    expect(state).toMatchObject({
      ok: false,
      error: expect.stringContaining("birden çok PayNkolay tahsilatı"),
    });
    expect(lookupRefunds).not.toHaveBeenCalled();
    expect(reserveRefund).not.toHaveBeenCalled();
    expect(finalizeRefund).not.toHaveBeenCalled();
  });

  it("a refund PayNkolay refuses as done already sends the operator to the order's own charge", async () => {
    const { PaymentRefusedError } = await import("@/lib/payment/provider");
    refund.mockRejectedValue(
      new PaymentRefusedError(
        "paynkolay refund reddedildi: responseCode=0 Bu kayıt daha önce iptal edilmiştir..!",
      ),
    );
    const { refundOrderAction } =
      await import("@/app/admin/siparisler/actions");
    const state = await refundOrderAction(
      null,
      form({
        id: "ord-1",
        amount: "1.280,10",
        reason: "İptal",
        token: "tok-2",
        destination: "card",
        confirm: "10023",
      }),
    );
    expect(state).toMatchObject({
      ok: false,
      error: expect.stringMatching(
        /birden çok PayNkolay tahsilatı.*asıl ödemesini PayNkolay panelinden iade et/,
      ),
    });
    expect(state.ok === false && state.error).not.toContain("iadeyi bul");
    expect(finalizeRefund).not.toHaveBeenCalled();
  });
});
