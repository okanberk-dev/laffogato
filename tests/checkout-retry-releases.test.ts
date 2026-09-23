import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * A retry after a declined card must get the coupon and stock the first,
 * unpaid attempt was holding (docs/AUDIT.md §8). The behaviour itself is
 * proved against Postgres in tests/db-integration-payment-sweep.test.ts; this
 * pins where it happens, which CI can check without a database.
 */
const store = readFileSync("src/lib/admin/store.ts", "utf8");
const placeOrder = store.slice(
  store.indexOf("export async function placeOrder("),
  store.indexOf("export type ManualOrderStatus"),
);

describe("checkout retry releases the abandoned attempt", () => {
  it("supersedes the member's unpaid web orders before claiming anything", () => {
    const supersede = placeOrder.indexOf("supersedeUnpaidWebOrders(");
    expect(supersede).toBeGreaterThan(0);
    expect(supersede).toBeLessThan(placeOrder.indexOf("claimOrderStock("));
    expect(supersede).toBeLessThan(placeOrder.indexOf("finalizeOrder("));
  });

  it("never lets that housekeeping fail the new order", () => {
    const around = placeOrder.slice(
      placeOrder.indexOf("supersedeUnpaidWebOrders(") - 80,
      placeOrder.indexOf("supersedeUnpaidWebOrders(") + 200,
    );
    expect(around).toMatch(/try \{/);
    expect(around).toMatch(/catch \(err\)/);
  });

  it("asks the POS before an unpaid order is cancelled", () => {
    const cancel = store.slice(
      store.indexOf("async function cancelUnpaidOrder("),
      store.indexOf("export async function expireStalePendingOrders("),
    );
    expect(cancel.indexOf("settlePendingFromProvider(")).toBeGreaterThan(0);
    expect(cancel.indexOf("settlePendingFromProvider(")).toBeLessThan(
      cancel.indexOf('status: "cancelled"'),
    );
  });

  it("does not cancel from the POS's return POST, which carries no session", () => {
    const donus = readFileSync("src/app/odeme/donus/route.ts", "utf8");
    expect(donus).not.toMatch(/transitionOrder|status: "cancelled"/);
  });
});
