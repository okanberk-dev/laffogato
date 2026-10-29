import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  REFUND_ROLE_NEEDED,
  bulkRefusal,
  orderActions,
  refundCapMinor,
  refundDestinationFor,
} from "@/lib/admin/order-actions";
import { refundRefusal } from "@/lib/admin/store";
import { parseMoneyInput } from "@/lib/utils/format";

const order = (status: string, totalMinor = 50000, refunded: number[] = []) =>
  ({
    status,
    totalMinor,
    refunds: refunded.map((amountMinor) => ({ amountMinor })),
  }) as Parameters<typeof refundRefusal>[0];

describe("refundRefusal - decided before the POS is asked for money", () => {
  it("refuses an order nothing was collected on", () => {
    expect(refundRefusal(order("pending_payment"), 1000, false)).toMatch(
      /Ödemesi alınmamış/,
    );
    expect(refundRefusal(order("cancelled"), 1000, false)).toMatch(
      /ödemesi alınmamış/,
    );
  });

  it("lets a cancelled order that WAS paid be refunded", () => {
    // A cancel never refunds (28 Eki 2026): the money comes back through
    // "İade başlat" on the cancelled order. Refusing this left the
    // customer's money with the shop.
    expect(refundRefusal(order("cancelled"), 50000, true)).toBeNull();
  });

  it("refuses more than what is left", () => {
    expect(refundRefusal(order("paid", 50000, [30000]), 20001, true)).toMatch(
      /kalan bakiyeyi aşıyor/,
    );
    expect(
      refundRefusal(order("paid", 50000, [30000]), 20000, true),
    ).toBeNull();
  });

  it("refuses a zero, negative or fractional amount", () => {
    for (const bad of [0, -100, 12.5]) {
      expect(refundRefusal(order("paid"), bad, true)).not.toBeNull();
    }
  });

  it("is what the refund checks before provider.refund", () => {
    // The refund lives in lib/admin/order-ops.ts (issueRefund), shared by
    // the İade modal and the two PayNkolay record buttons; a cancel never
    // calls it (below).
    const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
    const body = ops.slice(ops.indexOf("export async function issueRefund"));
    expect(body.indexOf("refundRefusal(")).toBeGreaterThan(-1);
    expect(body.indexOf("provider.refund(")).toBeGreaterThan(-1);
    expect(body.indexOf("refundRefusal(")).toBeLessThan(
      body.indexOf("provider.refund("),
    );
    // The ledger entry is reserved before the POS is asked, too.
    expect(body.indexOf("reserveRefund(")).toBeLessThan(
      body.indexOf("provider.refund("),
    );
  });

  it("caps the refund at what was collected, not the order total", () => {
    // An amount mismatch: the POS took ₺100 for a ₺500 order.
    expect(refundRefusal(order("cancelled"), 10001, true, 10000)).toMatch(
      /tahsil edilen tutarı aşıyor/,
    );
    expect(refundRefusal(order("cancelled"), 10000, true, 10000)).toBeNull();
    // No payment rows at all (a counter sale): the total stays the cap.
    expect(refundRefusal(order("paid"), 50000, true, null)).toBeNull();
    expect(refundCapMinor({ totalMinor: 50000 }, true, 90000)).toBe(50000);
    expect(refundCapMinor({ totalMinor: 50000 }, false, 50000)).toBe(0);
  });
});

describe("refunding a wallet-paid order (§18)", () => {
  it("credits the wallet instead of asking the POS to refund a card", () => {
    const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
    const body = ops.slice(ops.indexOf("export async function issueRefund"));
    const walletBranch = body.indexOf('if (destination === "wallet") {');
    expect(walletBranch).toBeGreaterThan(-1);
    expect(body.indexOf("creditWalletRefund(")).toBeGreaterThan(walletBranch);
    // The wallet branch comes first; the card refund is the `else`.
    expect(walletBranch).toBeLessThan(
      body.indexOf("provider.refund("),
    );
    expect(body).toContain('} else if (destination === "card" && ref) {');
  });

  it("decides the destination from the payment row, and skips manual rows", () => {
    expect(refundDestinationFor("wallet")).toBe("wallet");
    expect(refundDestinationFor("paynkolay")).toBe("card");
    expect(refundDestinationFor("manual:nakit")).toBe("none");
    expect(refundDestinationFor(null)).toBe("none");
  });
});

describe("parseMoneyInput - lira typed into an admin form", () => {
  it("reads Turkish and plain spellings as the same amount", () => {
    expect(parseMoneyInput("1.250,00")).toBe(125000);
    expect(parseMoneyInput("1.250")).toBe(125000);
    expect(parseMoneyInput("1250")).toBe(125000);
    expect(parseMoneyInput("1250,5")).toBe(125050);
    expect(parseMoneyInput("1250.50")).toBe(125050);
    expect(parseMoneyInput("₺ 45,90")).toBe(4590);
    expect(parseMoneyInput("45 TL")).toBe(4500);
  });

  it("refuses what it cannot read unambiguously", () => {
    // parseFloat(replace(",", ".")) read "1.250,00" as 1.25.
    for (const bad of ["1,250.00", "12.5.0", "abc", "", "-5", "1,2,3"]) {
      expect(parseMoneyInput(bad), bad).toBeNull();
    }
  });
});

describe("cancelling a paid order", () => {
  const paid = { status: "paid" as const, totalMinor: 50000, refunds: [] };
  const unpaid = { status: "pending_payment" as const, totalMinor: 50000, refunds: [] };

  it("needs the refunds permission one order at a time, as in bulk", () => {
    const staff = orderActions(paid, "staff", true);
    expect(staff.cancel).toEqual({ enabled: false, reason: REFUND_ROLE_NEEDED });
    expect(orderActions(paid, "manager", true).cancel?.enabled).toBe(true);
    // An unpaid order's cancel is still a shift task.
    expect(orderActions(unpaid, "staff", false).cancel?.enabled).toBe(true);
    expect(bulkRefusal(paid, "cancel", "staff", true)).toMatch(/iade yetkisi/);
    expect(bulkRefusal(unpaid, "cancel", "staff", false)).toBeNull();
  });

  it("is checked again on the server with the order it just read", () => {
    const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
    const body = ops.slice(
      ops.indexOf("export async function cancelOrder"),
      ops.indexOf("// ── Payment"),
    );
    expect(body).toContain('gate(id, actor, "cancel")');
    expect(body.indexOf('gate(id, actor, "cancel")')).toBeLessThan(
      body.indexOf('transitionOrder(id, "cancel"'),
    );
  });

  it("never moves money in the same step (operator, 28 Eki 2026)", () => {
    // "e ticaret için de manuel işlem olsun, iade otomatik işlemesin": the
    // cancel flags the order "iade bekliyor" and the refund is a separate,
    // explicit step ("İade başlat", or the PayNkolay record buttons).
    const ops = readFileSync("src/lib/admin/order-ops.ts", "utf8");
    const requestStart = ops.indexOf("export interface CancelRequest");
    const request = ops.slice(requestStart, ops.indexOf("\n}\n", requestStart));
    expect(request).not.toMatch(/\brefund\b/);
    expect(request).not.toContain("refundToken");
    expect(request).not.toContain("expectedDestination");
    const body = ops.slice(
      ops.indexOf("export async function cancelOrder"),
      ops.indexOf("// ── Payment"),
    );
    expect(body).not.toContain("issueRefund(");
    expect(body).not.toContain("reserveRefund(");
    expect(body).not.toContain("provider.refund(");
    expect(body).not.toContain("creditWalletRefund(");
    expect(body).toContain('setOrderAttention(id, "refund_due")');
    expect(body).toContain("'İade başlat' ile iade et");
    // The bulk tool goes through the same cancel, with nothing to refund.
    const bulk = ops.slice(
      ops.indexOf("export async function runBulkOrderAction"),
    );
    expect(bulk).not.toMatch(/refund:\s*(true|false)/);

    // The Server Action reads no refund, token or destination field.
    const actions = readFileSync("src/app/admin/siparisler/actions.ts", "utf8");
    const action = actions.slice(
      actions.indexOf("export async function cancelOrderAction"),
      actions.indexOf("export async function refundOrderAction"),
    );
    expect(action).not.toMatch(
      /field\(formData, "(refund|token|destination)"\)/,
    );
    expect(action).not.toContain("destinationOf(");

    // The modal has no refund box and no refund token.
    const ui = readFileSync(
      "src/components/admin/order-actions-ui.tsx",
      "utf8",
    );
    const modal = ui.slice(
      ui.indexOf("function CancelOrderModal"),
      ui.indexOf("function RefundOrderModal"),
    );
    expect(modal).not.toContain('name="refund"');
    expect(modal).not.toContain("Tutarın tamamını");
    expect(modal).not.toContain("refundToken");
    expect(modal).not.toContain("DestinationNote");
    // The money decision stays: the order number is still typed out.
    expect(modal).toContain(
      "confirmPhrase={money.collected ? String(order.orderNo) : undefined}",
    );
    // "İade başlat" keeps its own one-time token.
    const refundModal = ui.slice(
      ui.indexOf("function RefundOrderModal"),
      ui.indexOf("function OutsideRefundModal"),
    );
    expect(refundModal).toContain("token: refundToken");
  });
});
