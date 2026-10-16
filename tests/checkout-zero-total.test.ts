import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/odeme/actions.ts", "utf8");
// The one-page checkout's action (16 Eki 2026) replaced placeOrderAction.
const body = action.slice(
  action.indexOf("export async function startCheckoutAction"),
  action.indexOf("export async function deleteSavedCardAction"),
);

describe("web checkout", () => {
  it("settles a ₺0 order itself instead of sending 0.00 to the POS", () => {
    // PayNkolay refuses a zero charge and confirmReturn rejects amount <= 0,
    // so a 100% promo produced an order that could never complete.
    const zero = body.indexOf("if (order.totalMinor === 0)");
    expect(zero).toBeGreaterThan(-1);
    expect(zero).toBeLessThan(body.indexOf("provider.createCheckoutSession("));
    expect(body).toContain('provider: "free"');
    expect(body).toContain("applyPaymentSucceeded(");
    // And the browser is sent to the success page, not to a card form.
    expect(body).toMatch(/kind: "paid",\s+url: `\/odeme\/basarili\?ref=/);
  });

  it("uses the same 'free' provider name as the app's zero-total path", () => {
    const mobile = readFileSync("src/lib/mobile/orders.ts", "utf8");
    expect(mobile).toContain('const FREE_PROVIDER = "free";');
  });

  it("resolves the payment provider before the order exists", () => {
    // Looked up after placeOrder, a misconfigured provider left a pending
    // order holding stock and a mailed customer behind a 500.
    expect(body.indexOf("getPaymentProvider()")).toBeGreaterThan(-1);
    expect(body.indexOf("getPaymentProvider()")).toBeLessThan(
      body.indexOf("await placeOrder("),
    );
  });
});
