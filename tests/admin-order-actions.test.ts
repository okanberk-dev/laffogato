import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  markShippedLabel,
  orderFulfillment,
  shippedStatusLabel,
} from "@/lib/admin/order-channel";
import {
  REFUND_ROLE_NEEDED,
  attentionText,
  bulkRefusal,
  bulkSummary,
  nextStep,
  orderActions,
  orderPaymentState,
  outcomeSentence,
  refundSentence,
  refusalFor,
  type OrderActionInput,
} from "@/lib/admin/order-actions";
import { PaymentRefusedError } from "@/lib/payment/provider";

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

// ── orderActions: the one rule both the menus and the server read ────────

function input(over: Partial<OrderActionInput> = {}): OrderActionInput {
  return { status: "paid", totalMinor: 50_000, refunds: [], ...over };
}

describe("orderActions", () => {
  it("offers nothing to a role without order access (the cashier)", () => {
    expect(orderActions(input(), "cashier", true)).toEqual({});
  });

  it("draws a paid order's cancel and refund disabled, with the reason, for staff", () => {
    const staff = orderActions(input(), "staff", true);
    expect(staff.cancel).toEqual({ enabled: false, reason: REFUND_ROLE_NEEDED });
    expect(staff.refund).toEqual({ enabled: false, reason: REFUND_ROLE_NEEDED });
    // The shift's own moves stay open.
    expect(staff.start_preparing).toEqual({ enabled: true });
    const owner = orderActions(input(), "owner", true);
    expect(owner.cancel).toEqual({ enabled: true });
    expect(owner.refund).toEqual({ enabled: true });
  });

  it("lets staff cancel an order nothing was collected on", () => {
    const pending = orderActions(input({ status: "pending_payment" }), "staff", false);
    expect(pending.cancel).toEqual({ enabled: true });
    expect(pending.refund).toBeUndefined();
  });

  it("never offers 'Hazırlamaya başla' on an unpaid order", () => {
    // It used to settle the order silently: paidAt, the stamp, "ödemen alındı".
    const pending = orderActions(input({ status: "pending_payment" }), "owner", false);
    expect(pending.start_preparing).toBeUndefined();
    expect(pending.mark_paid).toEqual({ enabled: true });
    expect(pending.check_pos).toEqual({ enabled: true });
  });

  it("asks a manual order nothing at the POS", () => {
    const manual = orderActions(
      input({ status: "pending_payment", source: "manual" }),
      "owner",
      false,
    );
    expect(manual.check_pos).toBeUndefined();
    expect(manual.mark_paid).toEqual({ enabled: true });
  });

  it("ships a parcel through 'Kargoya ver' (with the number), a coffee in one click", () => {
    const parcel = orderActions(input({ fulfillment: "shipping", status: "preparing" }), "staff", true);
    expect(parcel.ship).toEqual({ enabled: true });
    expect(parcel.mark_shipped).toBeUndefined();
    // A parcel completes from Kargoda only, so the number is never skipped.
    expect(parcel.complete).toBeUndefined();
    const coffee = orderActions(input({ fulfillment: "pickup", status: "preparing" }), "staff", true);
    expect(coffee.mark_shipped).toEqual({ enabled: true });
    expect(coffee.complete).toEqual({ enabled: true });
  });

  it("opens the tracking form only once the parcel has left", () => {
    for (const status of ["pending_payment", "paid", "preparing", "cancelled", "refunded"] as const) {
      expect(orderActions(input({ fulfillment: "shipping", status }), "owner", true).edit_tracking).toBeUndefined();
    }
    expect(orderActions(input({ fulfillment: "shipping", status: "shipped" }), "owner", true).edit_tracking).toEqual({ enabled: true });
    // Not a parcel, no tracking number.
    expect(orderActions(input({ fulfillment: "pickup", status: "shipped" }), "owner", true).edit_tracking).toBeUndefined();
  });

  it("keeps the lines read-only on unpaid, cancelled and refunded orders", () => {
    for (const status of ["pending_payment", "cancelled", "refunded"] as const) {
      expect(orderActions(input({ status }), "owner", true).item_status).toBeUndefined();
    }
    expect(orderActions(input({ status: "preparing" }), "staff", true).item_status).toEqual({ enabled: true });
  });

  it("refunds no more than what was collected", () => {
    const short = orderActions(input({ status: "cancelled" }), "owner", true, 0);
    expect(short.refund).toBeUndefined();
    const refunded = orderActions(
      input({ refunds: [{ amountMinor: 50_000 }] as never }),
      "owner",
      true,
    );
    expect(refunded.refund).toBeUndefined();
  });

  it("offers 'Stoğu geri al' only for a cancel whose release did not land", () => {
    expect(orderActions(input({ status: "cancelled", stockReleasedAt: "" }), "staff", false).release_stock).toEqual({ enabled: true });
    expect(orderActions(input({ status: "cancelled", stockReleasedAt: "2026-10-17" }), "staff", false).release_stock).toBeUndefined();
  });

  it("puts the attention flag in the hands of those who may refund", () => {
    const flagged = input({ attention: "duplicate_payment" });
    expect(orderActions(flagged, "staff", true).clear_attention?.enabled).toBe(false);
    expect(orderActions(flagged, "owner", true).clear_attention?.enabled).toBe(true);
  });

  it("names one next step: the POS first for a pending card order", () => {
    const pending = input({ status: "pending_payment" });
    expect(nextStep(pending, orderActions(pending, "staff", false))).toBe("check_pos");
    const parcel = input({ status: "paid", fulfillment: "shipping" });
    expect(nextStep(parcel, orderActions(parcel, "staff", true))).toBe("start_preparing");
    const done = input({ status: "completed" });
    expect(nextStep(done, orderActions(done, "staff", true))).toBeNull();
  });

  it("answers the server with the reason the menu would show", () => {
    const staff = orderActions(input(), "staff", true);
    expect(refusalFor(staff, "cancel")).toBe(REFUND_ROLE_NEEDED);
    expect(refusalFor(staff, "mark_paid")).toMatch(/şu anki durumunda yapılamaz/);
    expect(refusalFor(staff, "start_preparing")).toBeNull();
  });
});

describe("bulk rules", () => {
  it("refuses per order, with a reason the summary can name", () => {
    expect(bulkRefusal(input({ status: "pending_payment" }), "start_preparing", "owner", false)).toBe("ödemesi alınmadı");
    expect(bulkRefusal(input({ fulfillment: "shipping", status: "preparing" }), "mark_shipped", "owner", true)).toMatch(/takip numarası yok/);
    expect(bulkRefusal(input({ fulfillment: "shipping", status: "preparing", trackingNumber: "YK1" }), "mark_shipped", "owner", true)).toBeNull();
    expect(bulkRefusal(input({ status: "shipped" }), "cancel", "owner", true)).toMatch(/yola çıkmış/);
    expect(bulkRefusal(input(), "cancel", "staff", true)).toMatch(/iade yetkisi/);
    expect(bulkRefusal(input({ status: "pending_payment" }), "cancel", "staff", false)).toBeNull();
  });

  it("names the skipped orders and why", () => {
    const s = bulkSummary("cancel", [
      { orderNo: 10001, ok: true },
      { orderNo: 10002, ok: false, note: "ödemesi alınmış, iade yetkisi gerekiyor" },
      { orderNo: 10003, ok: true, note: "iade bekliyor" },
    ]);
    expect(s.done).toBe(2);
    expect(s.tone).toBe("warning");
    expect(s.message).toContain("2 sipariş iptal edildi.");
    expect(s.message).toContain("#10002 ödemesi alınmış");
    expect(s.message).toContain("#10003 iade bekliyor");
    expect(bulkSummary("complete", [{ orderNo: 1, ok: true }]).tone).toBe("success");
  });
});

describe("result sentences", () => {
  it("joins the parts the way the toast reads", () => {
    expect(
      outcomeSentence([
        "sipariş #10023 iptal edildi",
        "3 ürün stoğa döndü",
        refundSentence(45_000, "card"),
        "",
        "e-posta gönderildi",
      ]),
    ).toBe(
      "Sipariş #10023 iptal edildi · 3 ürün stoğa döndü · ₺450,00 karta iade edildi · e-posta gönderildi.",
    );
  });

  it("never says 'karta' for money that did not move", () => {
    expect(refundSentence(1_000, "none")).toContain("para hareket etmedi");
    expect(refundSentence(1_000, "wallet")).toContain("cüzdana");
  });

  it("explains every attention flag, and an unknown one too", () => {
    expect(attentionText("")).toBeNull();
    expect(attentionText("duplicate_payment")?.title).toMatch(/ikinci bir ödeme/);
    expect(attentionText("something_new")?.title).toBeTruthy();
  });

  it("reads the payment column from what was collected", () => {
    expect(orderPaymentState({ status: "pending_payment", totalMinor: 100, refunds: [] }).label).toBe("Ödenmedi");
    // Paid after the sweep cancelled it: no paidAt, but money was taken.
    expect(orderPaymentState({ status: "cancelled", totalMinor: 100, refunds: [] }, true).label).toBe("Ödendi");
    expect(orderPaymentState({ status: "paid", paidAt: "x", totalMinor: 100, refunds: [{ amountMinor: 40 }] }).label).toBe("Kısmi iade");
  });
});

// ── The Server Actions, through order-ops, against a mocked store ────────

const store = vi.hoisted(() => ({
  getOrder: vi.fn(),
  orderMoney: vi.fn(),
  transitionOrder: vi.fn(),
  checkOrderWithPos: vi.fn(),
  markOrderPaidManually: vi.fn(),
  setOrderItemStatus: vi.fn(),
  setOrderTracking: vi.fn(),
  shipParcel: vi.fn(),
  setOrderAttention: vi.fn(async () => true),
  getOrdersByIds: vi.fn(),
  listOrderMoney: vi.fn(),
  refundRefusal: vi.fn(() => null),
  getOrderPaymentRef: vi.fn(async (): Promise<unknown> => null),
  reserveRefund: vi.fn(),
  releaseRefund: vi.fn(),
  finalizeRefund: vi.fn(),
  restockOrderLines: vi.fn(async () => []),
  retryOrderRelease: vi.fn(),
  BULK_ORDER_TRANSITIONS: {
    preparing: "start_preparing",
    shipped: "mark_shipped",
    completed: "complete",
    cancelled: "cancel",
  },
  countOpenOrders: vi.fn(),
  countOrdersAfter: vi.fn(),
  createManualOrder: vi.fn(),
  setOrderInternalNote: vi.fn(),
  updateOrderDetails: vi.fn(),
}));
const safeAudit = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => true));
const resendOrderNotice = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ role: "owner" as string }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "a@b.c", role: session.role })),
  getAdminSession: vi.fn(),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(), safeAudit }));
const setAdminFlash = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
const providerRefund = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ status: "succeeded" })),
);
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({ name: "paynkolay", refund: providerRefund }),
}));
vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/email/order-notices", () => ({ resendOrderNotice }));

const actions = await import("@/app/admin/siparisler/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function order(over: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNo: 10023,
    status: "paid",
    totalMinor: 50_000,
    refunds: [],
    items: [
      { productId: "prd-1", productName: "Çekirdek", qty: 2, unitPriceMinor: 25_000, status: "pending" },
    ],
    fulfillment: "shipping",
    channel: "web",
    kind: "shop",
    source: "",
    attention: "",
    paidAt: "2026-10-17T08:00:00.000Z",
    stockReleasedAt: "",
    customerEmail: "eda@example.com",
    ...over,
  };
}

type Money = { collected: boolean; collectedMinor: number | null; destination: string };
const PAID_MONEY: Money = { collected: true, collectedMinor: 50_000, destination: "card" };
const UNPAID_MONEY: Money = { collected: false, collectedMinor: null, destination: "none" };

beforeEach(() => {
  for (const fn of Object.values(store)) {
    if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  }
  store.setOrderAttention.mockResolvedValue(true);
  store.refundRefusal.mockReturnValue(null);
  store.getOrderPaymentRef.mockResolvedValue(null);
  store.restockOrderLines.mockResolvedValue([]);
  resendOrderNotice.mockReset();
  safeAudit.mockReset();
  safeAudit.mockResolvedValue(true);
  providerRefund.mockReset();
  providerRefund.mockResolvedValue({ status: "succeeded" });
  revalidatePath.mockClear();
  session.role = "owner";
});

describe("transitionOrderAction", () => {
  it("hands the store's refusal back and refreshes the page, without an audit row", async () => {
    store.getOrder.mockResolvedValue(order({ fulfillment: "pickup", status: "preparing" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    });
    const res = await actions.transitionOrderAction(
      null,
      form({ id: "ord-1", transition: "mark_shipped" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Sipariş bu arada değişti. Sayfa yenilendi, tekrar bak.",
    });
    expect(safeAudit).not.toHaveBeenCalled();
    // The menu the click came from was stale: the page is redrawn.
    expect(revalidatePath).toHaveBeenCalledWith("/admin/siparisler/ord-1");
  });

  it("audits the reached status only when the order actually moved", async () => {
    store.getOrder.mockResolvedValue(order({ fulfillment: "pickup", status: "preparing" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ fulfillment: "pickup", status: "shipped" }),
      mail: "not_due",
    });
    const res = await actions.transitionOrderAction(
      null,
      form({ id: "ord-1", transition: "mark_shipped" }),
    );
    expect(res).toMatchObject({ ok: true, message: "Sipariş #10023 teslime hazır." });
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transition",
        entityId: "ord-1",
        payload: { transition: "mark_shipped", to: "shipped" },
      }),
    );
  });

  it("rejects an unknown transition without touching the store", async () => {
    const res = await actions.transitionOrderAction(
      null,
      form({ id: "ord-1", transition: "teleport" }),
    );
    expect(res.ok).toBe(false);
    expect(store.getOrder).not.toHaveBeenCalled();
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("refuses 'Hazırlamaya başla' on an unpaid order without the 'ödeme alındı' flag", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    const res = await actions.transitionOrderAction(
      null,
      form({ id: "ord-1", transition: "start_preparing" }),
    );
    expect(res.ok).toBe(false);
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("with the flag, it is 'Ödendi olarak işaretle' first: POS asked, payment row written", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.checkOrderWithPos.mockResolvedValue("unpaid");
    store.markOrderPaidManually.mockResolvedValue({ ok: true, order: order(), mail: "sent" });
    store.transitionOrder.mockResolvedValue({ ok: true, order: order({ status: "preparing" }) });
    const res = await actions.transitionOrderAction(
      null,
      form({ id: "ord-1", transition: "start_preparing", paymentReceived: "1", method: "nakit" }),
    );
    expect(res.ok).toBe(true);
    expect(store.checkOrderWithPos).toHaveBeenCalledWith(expect.objectContaining({ id: "ord-1" }), "pay");
    expect(store.markOrderPaidManually).toHaveBeenCalledWith("ord-1", "nakit", "a@b.c");
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-1", "start_preparing", {
      actor: "a@b.c",
      expectStatus: "paid",
    });
  });
});

describe("cancelOrderAction", () => {
  it("wants a reason", async () => {
    const res = await actions.cancelOrderAction(null, form({ id: "ord-1", reason: " " }));
    expect(res).toMatchObject({ ok: false, fieldErrors: { reason: expect.any(String) } });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("asks the POS first and does not cancel an order it shows as paid", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.checkOrderWithPos.mockResolvedValue("paid");
    const res = await actions.cancelOrderAction(null, form({ id: "ord-1", reason: "Vazgeçti" }));
    expect(res.ok).toBe(false);
    expect(store.checkOrderWithPos).toHaveBeenCalledWith(expect.anything(), "cancel");
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("does not read an unreachable POS as unpaid (rule 29)", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.checkOrderWithPos.mockResolvedValue("unknown");
    const res = await actions.cancelOrderAction(null, form({ id: "ord-1", reason: "Vazgeçti" }));
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/POS'a ulaşılamadı/) });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("refuses staff on a collected order, checked on the server", async () => {
    session.role = "staff";
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    const res = await actions.cancelOrderAction(
      null,
      form({ id: "ord-1", reason: "Vazgeçti", confirm: "10023" }),
    );
    expect(res).toEqual({ ok: false, error: REFUND_ROLE_NEEDED });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("wants the order number typed when money was taken", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    const res = await actions.cancelOrderAction(null, form({ id: "ord-1", reason: "Vazgeçti" }));
    expect(res).toMatchObject({ ok: false, fieldErrors: { confirm: expect.any(String) } });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("wants the stock decision for a parcel on the road", async () => {
    store.getOrder.mockResolvedValue(order({ status: "shipped" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    const res = await actions.cancelOrderAction(
      null,
      form({ id: "ord-1", reason: "Kargo kayboldu", confirm: "10023" }),
    );
    expect(res).toMatchObject({ ok: false, fieldErrors: { restock: expect.any(String) } });
  });

  it("cancels and refunds in one step, in one sentence", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ status: "cancelled" }),
      mail: "sent",
      release: { released: true, units: 2, lines: [] },
    });
    store.getOrderPaymentRef.mockResolvedValue({
      provider: "paynkolay",
      providerRef: "REF1",
      amountMinor: 50_000,
      trxDate: "2026-10-17",
    });
    store.reserveRefund.mockResolvedValue({
      ok: true,
      refund: { id: "rfn-1", amountMinor: 50_000 },
      order: order({ status: "cancelled", refunds: [{ id: "rfn-1", amountMinor: 50_000 }] }),
    });
    store.finalizeRefund.mockImplementation(async (o: unknown) => ({ order: o, mail: "sent" }));
    const res = await actions.cancelOrderAction(
      null,
      form({
        id: "ord-1",
        reason: "Stokta yok",
        restock: "1",
        refund: "1",
        token: "tok-1",
        destination: "card",
        confirm: "#10023",
      }),
    );
    expect(res).toEqual({
      ok: true,
      tone: "success",
      message:
        "Sipariş #10023 iptal edildi · 2 ürün stoğa döndü · ₺500,00 karta iade edildi · e-posta gönderildi.",
    });
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-1", "cancel", {
      restock: true,
      actor: "a@b.c",
      // From the status the decision was made on, never from a newer one.
      expectStatus: "paid",
    });
    expect(store.reserveRefund).toHaveBeenCalledWith(
      "ord-1",
      expect.objectContaining({ amountMinor: 50_000, token: "tok-1", destination: "card" }),
    );
    expect(store.setOrderAttention).not.toHaveBeenCalledWith("ord-1", "refund_due");
  });

  it("a cancel that keeps the money flags the order 'iade bekliyor'", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ status: "cancelled" }),
      mail: "failed",
      release: { released: true, units: 0, lines: [] },
    });
    const res = await actions.cancelOrderAction(
      null,
      form({ id: "ord-1", reason: "Stokta yok", restock: "0", confirm: "10023" }),
    );
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("GÖNDERİLEMEDİ");
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-1", "cancel", {
      restock: false,
      actor: "a@b.c",
      expectStatus: "paid",
    });
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_due");
  });
});

describe("cancelOrderAction, when the refund does not go through", () => {
  function cancelled() {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ status: "cancelled" }),
      mail: "sent",
      release: { released: true, units: 2, lines: [] },
    });
    store.getOrderPaymentRef.mockResolvedValue({
      provider: "paynkolay",
      providerRef: "REF1",
      amountMinor: 50_000,
      trxDate: "2026-10-17",
    });
    store.reserveRefund.mockResolvedValue({
      ok: true,
      refund: { id: "rfn-1", amountMinor: 50_000 },
      order: order({ status: "cancelled", refunds: [{ id: "rfn-1", amountMinor: 50_000 }] }),
    });
    store.finalizeRefund.mockImplementation(async (o: unknown) => ({ order: o, mail: null }));
  }
  const fields = {
    id: "ord-1",
    reason: "Stokta yok",
    restock: "1",
    refund: "1",
    token: "tok-1",
    destination: "card",
    confirm: "10023",
  };

  it("a POS that did not answer: cancelled, refund kept as 'sonucu bilinmiyor', not 'iade bekliyor'", async () => {
    cancelled();
    providerRefund.mockRejectedValue(new Error("socket hang up"));
    const res = await actions.cancelOrderAction(null, form(fields));
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toMatch(/iptal edildi .*POS yanıt vermedi/);
    expect(store.releaseRefund).not.toHaveBeenCalled();
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_unknown");
    // "İade başlat" would invite the second refund this guards against.
    expect(store.setOrderAttention).not.toHaveBeenCalledWith("ord-1", "refund_due");
  });

  it("a POS that refused: cancelled, the money still owed, and the sentence says so", async () => {
    cancelled();
    providerRefund.mockRejectedValue(new PaymentRefusedError("responseCode=0"));
    const res = await actions.cancelOrderAction(null, form(fields));
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("iade yapılamadı");
    expect(res.ok && res.message).toContain("'İade başlat' ile iade et");
    expect(store.releaseRefund).toHaveBeenCalledWith("ord-1", "rfn-1");
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_due");
  });

  it("says the money is still owed over the e-Arşiv refund flag", async () => {
    cancelled();
    store.getOrder.mockResolvedValue(order({ attention: "invoice_refund" }));
    providerRefund.mockRejectedValue(new PaymentRefusedError("responseCode=0"));
    await actions.cancelOrderAction(null, form(fields));
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_due");
  });

  it("cancels a parcel on the road without a stock question when no line has stock to give back", async () => {
    store.getOrder.mockResolvedValue(
      order({
        status: "shipped",
        items: [
          // A line with no catalogue product, and one already restocked.
          { productName: "Hediye paketi", qty: 1, unitPriceMinor: 0, status: "pending" },
          { productId: "prd-1", productName: "Çekirdek", qty: 2, restockedQty: 2, unitPriceMinor: 25_000, status: "pending" },
        ],
      }),
    );
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ status: "cancelled" }),
      mail: "sent",
      release: { released: true, units: 0, lines: [] },
    });
    const res = await actions.cancelOrderAction(
      null,
      form({ id: "ord-1", reason: "Kargo kayboldu", confirm: "10023" }),
    );
    expect(res.ok).toBe(true);
    expect(store.transitionOrder).toHaveBeenCalledWith(
      "ord-1",
      "cancel",
      expect.objectContaining({ expectStatus: "shipped" }),
    );
  });
});

describe("cancelOrderAction, when the facts move", () => {
  it("does not cancel when the POS check just booked a payment of another amount", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney
      .mockResolvedValueOnce(UNPAID_MONEY)
      .mockResolvedValueOnce({ collected: true, collectedMinor: 100, destination: "card" });
    store.checkOrderWithPos.mockResolvedValue("unpaid");
    const res = await actions.cancelOrderAction(null, form({ id: "ord-1", reason: "Vazgeçti" }));
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/farklı tutarlı bir ödeme/) });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("keeps a flag the order already carries instead of 'iade bekliyor'", async () => {
    store.getOrder.mockResolvedValue(order({ attention: "duplicate_payment" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: order({ status: "cancelled", attention: "duplicate_payment" }),
      mail: "sent",
      release: { released: true, units: 2, lines: [] },
    });
    const res = await actions.cancelOrderAction(
      null,
      form({ id: "ord-1", reason: "Stokta yok", restock: "1", confirm: "10023" }),
    );
    expect(res.ok).toBe(true);
    expect(store.setOrderAttention).not.toHaveBeenCalled();
  });
});

describe("bulk 'Kargoda / Hazır'", () => {
  it("ships a parcel with its own number, and a coffee in one move", async () => {
    const parcel = order({ id: "ord-1", orderNo: 10001, status: "preparing", trackingNumber: "YK1", carrier: "Aras" });
    const coffee = order({ id: "ord-2", orderNo: 10002, status: "preparing", fulfillment: "pickup", kind: "cafe" });
    const bare = order({ id: "ord-3", orderNo: 10003, status: "preparing", trackingNumber: "" });
    store.getOrdersByIds.mockResolvedValue([parcel, coffee, bare]);
    store.listOrderMoney.mockResolvedValue(
      new Map([
        ["ord-1", PAID_MONEY],
        ["ord-2", PAID_MONEY],
        ["ord-3", PAID_MONEY],
      ]),
    );
    store.getOrder.mockImplementation(async (id: string) =>
      id === "ord-1" ? parcel : id === "ord-2" ? coffee : bare,
    );
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.shipParcel.mockResolvedValue({ ok: true, order: { ...parcel, status: "shipped" }, mail: "sent" });
    store.transitionOrder.mockResolvedValue({ ok: true, order: { ...coffee, status: "shipped" } });
    const res = await actions.bulkOrdersAction(
      null,
      form({ ids: "ord-1,ord-2,ord-3", value: "shipped" }),
    );
    expect(store.shipParcel).toHaveBeenCalledWith("ord-1", {
      carrier: "Aras",
      trackingNumber: "YK1",
      actor: "a@b.c",
    });
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-2", "mark_shipped", {
      actor: "a@b.c",
      expectStatus: "preparing",
    });
    expect(res.ok && res.message).toContain("2 sipariş kargoda / hazır.");
    expect(res.ok && res.message).toContain("#10003 takip numarası yok");
  });
});

describe("refundOrderAction", () => {
  it("refuses when the destination the modal showed is no longer true", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue({ ...PAID_MONEY, destination: "none" });
    store.getOrderPaymentRef.mockResolvedValue({
      provider: "paynkolay",
      providerRef: "REF1",
      amountMinor: 50_000,
      trxDate: "",
    });
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "100", reason: "Hasarlı", destination: "none", confirm: "10023" }),
    );
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/iade yapılmadı/) });
    expect(store.reserveRefund).not.toHaveBeenCalled();
  });

  it("a second submit of the same modal is refused by the ledger, not refunded again", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.reserveRefund.mockResolvedValue({
      ok: false,
      duplicate: true,
      error: "Bu iade zaten kaydedildi. Sayfa yenilendi, iadeler bölümüne bak.",
    });
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "100", reason: "Hasarlı", token: "tok-1", confirm: "10023" }),
    );
    expect(res.ok).toBe(false);
    expect(store.reserveRefund).toHaveBeenCalledWith("ord-1", expect.objectContaining({ token: "tok-1" }));
  });

  it("says 'para hareket etmez' for an order with no POS or wallet payment", async () => {
    store.getOrder.mockResolvedValue(order({ source: "manual" }));
    store.orderMoney.mockResolvedValue({ collected: true, collectedMinor: null, destination: "none" });
    store.reserveRefund.mockResolvedValue({
      ok: true,
      refund: { id: "rfn-1", amountMinor: 10_000 },
      order: order({ refunds: [{ id: "rfn-1", amountMinor: 10_000 }] }),
    });
    store.finalizeRefund.mockImplementation(async (o: unknown) => ({ order: o, mail: "not_due" }));
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "100", reason: "Kasada iade", destination: "none", confirm: "10023", restock_0: "1" }),
    );
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toContain("para hareket etmedi");
    expect(store.restockOrderLines).toHaveBeenCalledWith(expect.anything(), [{ index: 0, qty: 1 }], "a@b.c");
  });

  it("keeps a success a success when the audit row cannot be written", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue({ ...PAID_MONEY, destination: "none" });
    store.reserveRefund.mockResolvedValue({
      ok: true,
      refund: { id: "rfn-1", amountMinor: 10_000 },
      order: order({ refunds: [{ id: "rfn-1", amountMinor: 10_000 }] }),
    });
    store.finalizeRefund.mockRejectedValue(new Error("db down"));
    safeAudit.mockResolvedValue(false);
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "100", reason: "Hasarlı", confirm: "10023" }),
    );
    // The money moved: never an error the operator would retry.
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("olay kaydı yazılamadı");
  });

  const CARD_REF = {
    provider: "paynkolay",
    providerRef: "REF1",
    amountMinor: 50_000,
    trxDate: "2026-10-17",
  };

  function reservedFull() {
    store.reserveRefund.mockResolvedValue({
      ok: true,
      refund: { id: "rfn-1", amountMinor: 50_000, token: "tok-1" },
      order: order({ refunds: [{ id: "rfn-1", amountMinor: 50_000, token: "tok-1" }] }),
    });
    store.finalizeRefund.mockImplementation(async (o: unknown) => ({ order: o, mail: null }));
  }

  it("keeps the entry when the POS does not answer, so a retry cannot refund twice", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.getOrderPaymentRef.mockResolvedValue(CARD_REF);
    reservedFull();
    // A timeout after the request left: the card may have been credited.
    providerRefund.mockRejectedValue(new Error("timed out after 20000 ms"));
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "500", reason: "Hasarlı", token: "tok-1", destination: "card", confirm: "10023" }),
    );
    // The entry, and with it the modal's token and the amount, stays.
    expect(store.releaseRefund).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("POS yanıt vermedi");
    expect(res.ok && res.message).not.toContain("karta iade edildi");
    // Nobody tells the buyer "iade edildi" before a person has checked.
    expect(store.finalizeRefund).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_unknown");
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "refund",
        payload: expect.objectContaining({ outcome: "unknown" }),
      }),
    );
  });

  // Post-merge review (22 Eki 2026): the e-Arşiv "Faturalı siparişte iade"
  // flag took the order's only attention slot, so an unanswered refund was
  // never flagged. Money comes first; the invoice row keeps its own mark.
  it("flags an unanswered refund over the e-Arşiv refund flag", async () => {
    store.getOrder.mockResolvedValue(order({ attention: "invoice_refund" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.getOrderPaymentRef.mockResolvedValue(CARD_REF);
    reservedFull();
    providerRefund.mockRejectedValue(new Error("timed out after 20000 ms"));
    await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "500", reason: "Hasarlı", token: "tok-1", destination: "card", confirm: "10023" }),
    );
    expect(store.setOrderAttention).toHaveBeenCalledWith("ord-1", "refund_unknown");
  });

  it("takes the entry back only when the POS certainly refunded nothing", async () => {
    store.getOrder.mockResolvedValue(order());
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.getOrderPaymentRef.mockResolvedValue(CARD_REF);
    reservedFull();
    providerRefund.mockRejectedValue(
      new PaymentRefusedError("paynkolay refund reddedildi: responseCode=0 limit"),
    );
    const res = await actions.refundOrderAction(
      null,
      form({ id: "ord-1", amount: "500", reason: "Hasarlı", token: "tok-1", destination: "card", confirm: "10023" }),
    );
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/reddetti, para geri gönderilmedi/) });
    expect(store.releaseRefund).toHaveBeenCalledWith("ord-1", "rfn-1");
    expect(store.finalizeRefund).not.toHaveBeenCalled();
    expect(store.setOrderAttention).not.toHaveBeenCalledWith("ord-1", "refund_unknown");
  });
});

describe("markPaidAction", () => {
  it("does not mark a card order paid while the POS cannot be asked", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.checkOrderWithPos.mockResolvedValue("unknown");
    const res = await actions.markPaidAction(null, form({ id: "ord-1", method: "nakit" }));
    expect(res.ok).toBe(false);
    expect(store.markOrderPaidManually).not.toHaveBeenCalled();
  });

  it("books what the POS shows instead of a manual row", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.checkOrderWithPos.mockResolvedValue("paid");
    const res = await actions.markPaidAction(null, form({ id: "ord-1", method: "nakit" }));
    expect(res).toMatchObject({ ok: true });
    expect(store.markOrderPaidManually).not.toHaveBeenCalled();
  });

  it("wants the method", async () => {
    const res = await actions.markPaidAction(null, form({ id: "ord-1", method: "bitcoin" }));
    expect(res).toMatchObject({ ok: false, fieldErrors: { method: expect.any(String) } });
  });

  it("asks a manual order nothing at the POS", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "", source: "manual" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.markOrderPaidManually.mockResolvedValue({ ok: true, order: order({ source: "manual" }), mail: "sent" });
    const res = await actions.markPaidAction(null, form({ id: "ord-1", method: "havale" }));
    expect(res).toMatchObject({ ok: true });
    expect(store.checkOrderWithPos).not.toHaveBeenCalled();
    expect(store.markOrderPaidManually).toHaveBeenCalledWith("ord-1", "havale", "a@b.c");
  });
});

describe("shipOrderAction and the tracking form", () => {
  it("wants the tracking number for a parcel", async () => {
    const res = await actions.shipOrderAction(null, form({ id: "ord-1", carrier: "Yurtiçi", trackingNumber: " " }));
    expect(res).toMatchObject({ ok: false, fieldErrors: { trackingNumber: expect.any(String) } });
    expect(store.shipParcel).not.toHaveBeenCalled();
  });

  it("reports the mail result of 'Kargoya ver'", async () => {
    store.getOrder.mockResolvedValue(order({ status: "preparing" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.shipParcel.mockResolvedValue({ ok: true, order: order({ status: "shipped" }), mail: "sent" });
    const res = await actions.shipOrderAction(null, form({ id: "ord-1", carrier: "Yurtiçi", trackingNumber: "YK123" }));
    expect(res).toMatchObject({ ok: true, message: "Sipariş #10023 kargoya verildi · e-posta gönderildi." });
  });

  it("refuses the tracking form on an order whose parcel has not left", async () => {
    store.getOrder.mockResolvedValue(order({ status: "cancelled" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    const res = await actions.saveOrderTrackingAction(null, form({ id: "ord-1", trackingNumber: "YK1" }));
    expect(res.ok).toBe(false);
    expect(store.setOrderTracking).not.toHaveBeenCalled();
  });
});

describe("setItemStatusAction", () => {
  it("checks the store's answer before writing an audit row", async () => {
    store.getOrder.mockResolvedValue(order({ status: "preparing" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    store.setOrderItemStatus.mockResolvedValue(null);
    const res = await actions.setItemStatusAction(null, form({ id: "ord-1", index: "0", status: "ready" }));
    expect(res.ok).toBe(false);
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("refuses a line that does not exist", async () => {
    store.getOrder.mockResolvedValue(order({ status: "preparing" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    const res = await actions.setItemStatusAction(null, form({ id: "ord-1", index: "7", status: "ready" }));
    expect(res.ok).toBe(false);
    expect(store.setOrderItemStatus).not.toHaveBeenCalled();
  });
});

describe("bulkOrdersAction", () => {
  it("answers in Turkish when nothing is chosen", async () => {
    const res = await actions.bulkOrdersAction(null, form({ ids: "ord-1", op: "set_status", value: "" }));
    expect(res).toEqual({ ok: false, error: "Bir işlem seç." });
    const none = await actions.bulkOrdersAction(null, form({ ids: "", op: "set_status", value: "completed" }));
    expect(none).toEqual({ ok: false, error: "Hiç kayıt seçilmedi." });
  });

  it("a cancel needs a reason and the count typed out", async () => {
    const noReason = await actions.bulkOrdersAction(
      null,
      form({ ids: "ord-1,ord-2", value: "cancelled", confirm: "2" }),
    );
    expect(noReason).toMatchObject({ ok: false, fieldErrors: { reason: expect.any(String) } });
    const noCount = await actions.bulkOrdersAction(
      null,
      form({ ids: "ord-1,ord-2", value: "cancelled", reason: "Toplu iptal", confirm: "3" }),
    );
    expect(noCount).toMatchObject({ ok: false, fieldErrors: { confirm: expect.any(String) } });
    expect(store.getOrdersByIds).not.toHaveBeenCalled();
  });

  it("decides the refunds role per order and writes one audit row per order", async () => {
    session.role = "staff";
    const unpaid = order({ id: "ord-1", orderNo: 10001, status: "pending_payment", paidAt: "", source: "manual" });
    const paid = order({ id: "ord-2", orderNo: 10002 });
    store.getOrdersByIds.mockResolvedValue([unpaid, paid]);
    store.listOrderMoney.mockResolvedValue(
      new Map([
        ["ord-1", UNPAID_MONEY],
        ["ord-2", PAID_MONEY],
      ]),
    );
    store.getOrder.mockResolvedValue(unpaid);
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: { ...unpaid, status: "cancelled" },
      mail: "not_due",
      release: { released: true, units: 2, lines: [] },
    });
    const res = await actions.bulkOrdersAction(
      null,
      form({ ids: "ord-1,ord-2", value: "cancelled", reason: "Toplu iptal", confirm: "2" }),
    );
    expect(res).toMatchObject({ ok: true, tone: "warning" });
    expect(res.ok && res.message).toContain("1 sipariş iptal edildi.");
    expect(res.ok && res.message).toContain("#10002 ödemesi alınmış, iade yetkisi gerekiyor");
    expect(store.transitionOrder).toHaveBeenCalledTimes(1);
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-1", "cancel", expect.anything());
    const rows = safeAudit.mock.calls.map((c) => c[0] as { entityId: string; payload: Record<string, unknown> });
    expect(rows).toEqual([
      expect.objectContaining({
        entityId: "ord-1",
        payload: expect.objectContaining({ bulk: true, reason: "Toplu iptal" }),
      }),
    ]);
  });
});

describe("resendMailAction", () => {
  it("sends a customer mail again and says so", async () => {
    store.getOrder.mockResolvedValue(order({ status: "cancelled" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    resendOrderNotice.mockResolvedValue("sent");
    const res = await actions.resendMailAction(null, form({ id: "ord-1", kind: "cancelled" }));
    expect(res).toEqual({
      ok: true,
      tone: "success",
      message: "Sipariş #10023: İptal e-postası yeniden gönderildi.",
    });
    expect(resendOrderNotice).toHaveBeenCalledWith(expect.objectContaining({ id: "ord-1" }), "cancelled", { collected: true });
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { event: "mail_resent", kind: "cancelled" } }),
    );
  });

  it("refuses the staff mail, and a mail that is no longer true", async () => {
    store.getOrder.mockResolvedValue(order({ status: "paid" }));
    store.orderMoney.mockResolvedValue(PAID_MONEY);
    expect((await actions.resendMailAction(null, form({ id: "ord-1", kind: "staff-new" }))).ok).toBe(false);
    expect(resendOrderNotice).not.toHaveBeenCalled();
    resendOrderNotice.mockResolvedValue("not_due");
    expect((await actions.resendMailAction(null, form({ id: "ord-1", kind: "cancelled" }))).ok).toBe(false);
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("is not offered for an unpaid attempt, which was mailed nothing", async () => {
    store.getOrder.mockResolvedValue(order({ status: "pending_payment", paidAt: "" }));
    store.orderMoney.mockResolvedValue(UNPAID_MONEY);
    expect((await actions.resendMailAction(null, form({ id: "ord-1", kind: "paid" }))).ok).toBe(false);
    expect(resendOrderNotice).not.toHaveBeenCalled();
  });
});

describe("saveOrderDetailsAction (ORD-16, karar D2)", () => {
  /** The store as far as the action sees it: the rule asked about `stored`. */
  function storedAs(over: Record<string, unknown> = {}) {
    const existing = order({
      status: "preparing",
      customerName: "Eda Mancuso",
      customerPhone: "+90 532 000 00 00",
      shippingAddress: "Eski adres",
      ...over,
    });
    store.updateOrderDetails.mockImplementation(
      async (
        _id: string,
        input: Record<string, unknown>,
        refuse?: (o: unknown) => string | null,
      ) => {
        const refusal = refuse?.(existing) ?? null;
        if (refusal) return { ok: false, error: refusal };
        const clean = Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        );
        return { ok: true, before: existing, order: { ...existing, ...clean } };
      },
    );
  }

  const edit = (fields: Record<string, string>) =>
    actions.saveOrderDetailsAction(
      {},
      form({
        id: "ord-1",
        customerName: "Eda Mancuso",
        customerPhone: "+90 532 000 00 00",
        shippingAddress: "Eski adres",
        ...fields,
      }),
    );

  it("lets staff fix the address of an open order, with before and after in the audit", async () => {
    session.role = "staff";
    storedAs();
    const res = await edit({ shippingAddress: "Yeni adres" });
    expect(res.savedAt).toBeTruthy();
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityId: "ord-1",
        payload: {
          fields: "customer_delivery",
          changed: ["shippingAddress"],
          before: { shippingAddress: "Eski adres" },
          after: { shippingAddress: "Yeni adres" },
        },
      }),
    );
    // The form offered no e-mail field: the stored one is not touched.
    expect(store.updateOrderDetails.mock.calls[0][1].customerEmail).toBeUndefined();
  });

  it("refuses a staff e-mail change and writes no audit row", async () => {
    session.role = "staff";
    storedAs();
    const res = await edit({ customerEmail: "baska@example.com", emailConfirm: "1" });
    expect(res.error).toMatch(/yalnız sahip ya da yönetici/);
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("refuses staff on a closed order", async () => {
    session.role = "staff";
    storedAs({ status: "completed" });
    const res = await edit({ shippingAddress: "Yeni adres" });
    expect(res.error).toMatch(/Kapanmış sipariş/);
  });

  it("wants the owner's confirm, then keeps the old e-mail in full", async () => {
    storedAs();
    const unconfirmed = await edit({ customerEmail: "eda.m@example.com" });
    expect(unconfirmed.error).toMatch(/onayla/);
    const res = await edit({ customerEmail: "eda.m@example.com", emailConfirm: "1" });
    expect(res.savedAt).toBeTruthy();
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          changed: ["customerEmail"],
          before: { customerEmail: "eda@example.com" },
          after: { customerEmail: "eda.m@example.com" },
        }),
      }),
    );
  });

  it("refuses the e-mail of a closed order even for the owner", async () => {
    storedAs({ status: "refunded" });
    const res = await edit({ customerEmail: "eda.m@example.com", emailConfirm: "1" });
    expect(res.error).toMatch(/e-postası değişmez/);
  });

  it("writes no audit row for a save that changed nothing", async () => {
    storedAs();
    const res = await edit({ customerEmail: "eda@example.com" });
    expect(res.savedAt).toBeTruthy();
    expect(safeAudit).not.toHaveBeenCalled();
  });
});

describe("createManualOrderAction", () => {
  const fields = {
    items: JSON.stringify([{ productId: "prd-1", qty: 1 }]),
    customerName: "Eda Mancuso",
    promoCode: "ESKI10",
    status: "pending_payment",
  };

  it("tells the admin when the promo code no longer applied", async () => {
    store.createManualOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-9", orderNo: 10099, totalMinor: 10_000 },
      priceAdjusted: false,
      promoDropped: true,
    });
    await actions.createManualOrderAction({}, form(fields));
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining('"ESKI10" promosyon kodu artık geçerli değil'),
      "warning",
    );
    expect(redirect).toHaveBeenCalledWith("/admin/siparisler/ord-9");
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ promoDropped: "ESKI10" }) }),
    );
  });

  it("confirms a plain one with a success flash", async () => {
    setAdminFlash.mockClear();
    store.createManualOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-9", orderNo: 10099, totalMinor: 10_000 },
      priceAdjusted: false,
      promoDropped: false,
    });
    await actions.createManualOrderAction({}, form(fields));
    expect(setAdminFlash).toHaveBeenCalledWith("Sipariş #10099 oluşturuldu.", "success");
  });

  it("hands the store the delivery and, for a paid start, how it was paid", async () => {
    store.createManualOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-9", orderNo: 10099, totalMinor: 10_000 },
      priceAdjusted: false,
      promoDropped: false,
      payment: "recorded",
    });
    await actions.createManualOrderAction(
      {},
      form({ ...fields, promoCode: "", status: "paid", paymentMethod: "kart" }),
    );
    expect(store.createManualOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        fulfillment: "pickup",
        paymentMethod: "kart",
      }),
    );
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          fulfillment: "pickup",
          paymentMethod: "kart",
        }),
      }),
    );
  });

  // Verifier C3: the form's attempt id reaches the store, and the same
  // attempt again lands on its order with no second audit row.
  it("lands a repeated attempt on the order it made, writing no second audit row", async () => {
    setAdminFlash.mockClear();
    safeAudit.mockClear();
    store.createManualOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-9", orderNo: 10099, totalMinor: 10_000 },
      priceAdjusted: false,
      promoDropped: false,
      payment: "none",
      replay: true,
    });
    await actions.createManualOrderAction(
      {},
      form({
        ...fields,
        clientOrderId: "8d3c2f4e-0b1a-4c5d-9e6f-7a8b9c0d1e2f",
      }),
    );
    expect(store.createManualOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        clientOrderId: "8d3c2f4e-0b1a-4c5d-9e6f-7a8b9c0d1e2f",
      }),
    );
    expect(setAdminFlash).toHaveBeenCalledWith(
      "Sipariş #10099 zaten oluşturulmuştu, ikinci gönderim yeni sipariş açmadı.",
      "warning",
    );
    expect(redirect).toHaveBeenCalledWith("/admin/siparisler/ord-9");
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("refuses a paid start without a method before the store is asked", async () => {
    const res = await actions.createManualOrderAction(
      {},
      form({ ...fields, status: "paid" }),
    );
    expect(res.fieldErrors?.paymentMethod).toBe("Ödemenin nasıl alındığını seç.");
    expect(store.createManualOrder).not.toHaveBeenCalled();
  });

  it("puts a stock refusal under the product list", async () => {
    redirect.mockClear();
    store.createManualOrder.mockResolvedValue({
      ok: false,
      reason: "out_of_stock",
      productName: "Sirena Espresso",
      available: 2,
    });
    const res = await actions.createManualOrderAction({}, form(fields));
    expect(res.fieldErrors?.items).toBe(
      "Yetersiz stok: Sirena Espresso (mevcut: 2).",
    );
    expect(res.error).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("asks for a variant when a product sold by its variants has none", async () => {
    redirect.mockClear();
    store.createManualOrder.mockResolvedValue({
      ok: false,
      reason: "not_found",
      productName: "Sirena Espresso",
      variantRequired: true,
    });
    const res = await actions.createManualOrderAction({}, form(fields));
    expect(res.fieldErrors?.items).toBe(
      "Sirena Espresso için bir varyant seç.",
    );
    expect(redirect).not.toHaveBeenCalled();
    store.createManualOrder.mockResolvedValue({
      ok: false,
      reason: "not_found",
      productName: "prd-1",
    });
    const gone = await actions.createManualOrderAction({}, form(fields));
    expect(gone.fieldErrors?.items).toBe("Ürün bulunamadı: prd-1");
  });

  it("warns when the payment row could not be written, the order made", async () => {
    setAdminFlash.mockClear();
    store.createManualOrder.mockResolvedValue({
      ok: true,
      order: { id: "ord-9", orderNo: 10099, totalMinor: 10_000 },
      priceAdjusted: false,
      promoDropped: false,
      payment: "failed",
    });
    await actions.createManualOrderAction(
      {},
      form({ ...fields, promoCode: "", status: "paid", paymentMethod: "nakit" }),
    );
    expect(setAdminFlash).toHaveBeenCalledWith(
      expect.stringContaining("Ödeme kaydı yazılamadı"),
      "warning",
    );
  });
});
