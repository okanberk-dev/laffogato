import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
    // The cancel dialog promises "İptal sonrası iade ayrıca başlatılır";
    // refusing this left the customer's money with the shop.
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

  it("is what the admin action checks before provider.refund", () => {
    const action = readFileSync("src/app/admin/siparisler/actions.ts", "utf8");
    const body = action.slice(
      action.indexOf("export async function refundOrderAction"),
    );
    expect(body.indexOf("refundRefusal(")).toBeGreaterThan(-1);
    expect(body.indexOf("refundRefusal(")).toBeLessThan(
      body.indexOf("getPaymentProvider().refund("),
    );
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
  it("needs the refunds permission one order at a time, as in bulk", () => {
    const action = readFileSync("src/app/admin/siparisler/actions.ts", "utf8");
    const body = action.slice(
      action.indexOf("export async function transitionOrderAction"),
      action.indexOf(
        "export async function",
        action.indexOf("export async function transitionOrderAction") + 10,
      ),
    );
    expect(body).toContain('transition === "cancel" && !canAccess("refunds"');
    expect(body).toContain('current.status !== "pending_payment"');
  });
});
