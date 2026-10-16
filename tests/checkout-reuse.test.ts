import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { checkoutCartKey, type CartKeyInput } from "@/lib/checkout/cart-key";
import {
  orderMatchesSubmission,
  reuseDecision,
  type ReuseOrder,
} from "@/lib/checkout/reuse";
import { parseReuseClaim } from "@/lib/checkout/start-schema";

/**
 * A retry after a declined card pays for the order the first attempt made
 * (docs/PAYNKOLAY.md §15.5) - no second order, no second stock and coupon
 * claim - but only when every rule holds. Each refusal is its own branch.
 */

const submitted: CartKeyInput = {
  items: [
    { productId: "prd-0001", variantId: "v-250", name: "Çekirdek", qty: 2 },
  ],
  customerName: "Ada Lovelace",
  customerPhone: "0532 123 45 67",
  shippingAddress: "Postane Mah. 28, Tuzla, İstanbul",
  promoCode: "",
};

const order: ReuseOrder = {
  id: "ord-0284",
  customerEmail: "ada@example.com",
  customerName: "Ada Lovelace",
  customerPhone: "0532 123 45 67",
  shippingAddress: "Postane Mah. 28, Tuzla, İstanbul",
  status: "pending_payment",
  items: [
    {
      productId: "prd-0001",
      variantId: "v-250",
      productName: "Çekirdek",
      qty: 2,
      unitPriceMinor: 64005,
    },
  ] as ReuseOrder["items"],
  totalMinor: 128010,
  promoCode: "",
  channel: "web",
};

const claim = { orderId: "ord-0284", cartKey: checkoutCartKey(submitted) };
const payload = { clientRefCode: "ord-0284", amount: "1280.10" };

const base = {
  claim,
  payload,
  fresh: true,
  order,
  customerEmail: "Ada@Example.com",
  submitted,
};

describe("reuseDecision", () => {
  it("reuses the member's own pending web order when nothing changed", () => {
    expect(reuseDecision(base)).toEqual({ reuse: true });
  });

  it.each([
    ["no_claim", { claim: null }],
    ["bad_payload", { payload: null }],
    ["stale_payload", { fresh: false }],
    ["other_order", { payload: { ...payload, clientRefCode: "ord-9999" } }],
    ["no_order", { order: null }],
    ["no_order", { order: { ...order, id: "ord-0285" } }],
    ["not_owner", { customerEmail: "eve@example.com" }],
    ["not_pending", { order: { ...order, status: "paid" as const } }],
    ["not_pending", { order: { ...order, status: "cancelled" as const } }],
    ["not_web", { order: { ...order, channel: "app" as const } }],
    ["amount_changed", { payload: { ...payload, amount: "1180.10" } }],
    ["amount_changed", { order: { ...order, totalMinor: 99900 } }],
    ["cart_changed", { claim: { ...claim, cartKey: "00000000000000" } }],
    [
      "cart_changed",
      { submitted: { ...submitted, shippingAddress: "Başka bir adres 1" } },
    ],
  ] as const)("refuses: %s", (reason, over) => {
    expect(reuseDecision({ ...base, ...over })).toEqual({
      reuse: false,
      reason,
    });
  });

  it("refuses when the row says something else than the submission", () => {
    // The key matches (the browser kept it) but the order row disagrees:
    // the row is what ships and what is charged, so it decides.
    const changed = {
      ...submitted,
      items: [{ ...submitted.items[0], qty: 3 }],
    };
    expect(
      reuseDecision({
        ...base,
        submitted: changed,
        claim: { ...claim, cartKey: checkoutCartKey(changed) },
      }),
    ).toEqual({ reuse: false, reason: "cart_changed" });
  });
});

describe("orderMatchesSubmission", () => {
  it("never guesses a line without a product id", () => {
    expect(
      orderMatchesSubmission(order, {
        ...submitted,
        items: [{ name: "Çekirdek", qty: 2 }],
      }),
    ).toBe(false);
  });

  it("ignores spacing and case in the code", () => {
    expect(
      orderMatchesSubmission(
        { ...order, promoCode: "KAHVE10" },
        { ...submitted, promoCode: " kahve10 " },
      ),
    ).toBe(true);
  });
});

describe("checkoutCartKey", () => {
  it("is order-independent and whitespace-tolerant", () => {
    const a = checkoutCartKey({
      ...submitted,
      items: [
        { productId: "a", name: "A", qty: 1 },
        { productId: "b", name: "B", qty: 2 },
      ],
    });
    const b = checkoutCartKey({
      ...submitted,
      customerName: "  Ada   Lovelace ",
      items: [
        { productId: "b", name: "B", qty: 2 },
        { productId: "a", name: "A", qty: 1 },
      ],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{14}$/);
  });

  it("changes with the quantity, the address and the code", () => {
    const k = checkoutCartKey(submitted);
    expect(
      checkoutCartKey({
        ...submitted,
        items: [{ ...submitted.items[0], qty: 1 }],
      }),
    ).not.toBe(k);
    expect(
      checkoutCartKey({ ...submitted, shippingAddress: "X 12345" }),
    ).not.toBe(k);
    expect(checkoutCartKey({ ...submitted, promoCode: "KOD" })).not.toBe(k);
  });
});

describe("parseReuseClaim", () => {
  const raw = {
    reuseOrderId: "ord-0284",
    reuseData: "e1.abc",
    reuseSignature: "sig",
    reuseCartKey: claim.cartKey,
  };
  it("reads a well-formed claim", () => {
    expect(parseReuseClaim(raw)).toEqual({
      orderId: "ord-0284",
      data: "e1.abc",
      signature: "sig",
      cartKey: claim.cartKey,
    });
  });
  it.each([
    { reuseOrderId: "../../x" },
    { reuseCartKey: "nothex" },
    { reuseData: "" },
    { reuseData: "x".repeat(9000) },
    { reuseSignature: null },
  ])("drops a malformed one: %o", (over) => {
    expect(parseReuseClaim({ ...raw, ...over })).toBeNull();
  });
});

describe("startCheckoutAction's reuse path", () => {
  const action = readFileSync("src/app/odeme/actions.ts", "utf8");
  const body = action.slice(
    action.indexOf("export async function startCheckoutAction"),
    action.indexOf("export async function deleteSavedCardAction"),
  );

  it("verifies the payload and reads the order before deciding", () => {
    const at = (s: string) => body.indexOf(s);
    expect(
      at("direct.readBridgePost(claim.data, claim.signature)"),
    ).toBeGreaterThan(-1);
    expect(
      at(
        "direct.isBridgeFresh(post, new Date(Date.now() + REUSE_HEADROOM_MS))",
      ),
    ).toBeGreaterThan(-1);
    expect(at("reuseDecision(")).toBeGreaterThan(at("getOrder(claim.orderId)"));
    // A reuse answers before any new order is placed.
    expect(at("reuseDecision(")).toBeLessThan(at("await placeOrder("));
  });

  it("reserves its own budget, per member, before anything else is done", () => {
    const m = body.match(
      /reserveLoginAttempt\(\s*"checkout-start",\s*"",\s*customer\.email,?\s*\)/,
    );
    expect(m).not.toBeNull();
    const reserve = body.indexOf(m![0]);
    expect(reserve).toBeLessThan(body.indexOf("parseItems("));
    expect(reserve).toBeLessThan(body.indexOf("await placeOrder("));
  });

  it("sends no order mail before the payment", () => {
    expect(action).not.toMatch(/sendOrderPlacedEmail|sendOrderPaidEmail/);
  });
});
