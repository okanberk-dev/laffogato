import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

/**
 * Orders match their member by e-mail alone, and an admin's phone or counter
 * sale can carry the address of someone who never signed up. The site shows
 * history only to a verified address (lib/customer/member-orders.ts); the app
 * now does the same (docs/AUDIT.md §8, "Açık" 9). An unverified member cannot
 * have ordered anyway: POST /orders answers 403 email_unverified.
 */
const customerOrdersByEmail = vi.fn(async () => [
  {
    id: "ord-0001",
    orderNo: 10001,
    status: "paid",
    items: [],
    createdAt: "2026-09-23T08:00:00.000Z",
    paidAt: "2026-09-23T08:01:00.000Z",
  },
]);
vi.mock("@/lib/admin/store", () => ({
  customerOrdersByEmail,
  listActiveAppAnnouncements: async () => [],
  orderFulfillment: () => "pickup",
}));

describe("app order reads need a verified address", () => {
  it("lists and opens nothing for an unverified member", () => {
    const src = readFileSync("src/lib/mobile/orders.ts", "utf8");
    const list = src.slice(
      src.indexOf("export async function listAppOrders"),
      src.indexOf("export async function getAppOrder"),
    );
    const one = src.slice(
      src.indexOf("export async function getAppOrder"),
      src.indexOf("// ─── Promo preview"),
    );
    for (const body of [list, one]) {
      const gate = body.indexOf("if (!customer.emailVerified)");
      expect(gate).toBeGreaterThan(0);
      // Before any order is read.
      expect(gate).toBeLessThan(
        Math.max(
          body.indexOf("customerOrdersByEmail("),
          body.indexOf("getOrder("),
        ),
      );
    }
  });

  it("leaves order rows out of the inbox for an unverified member", async () => {
    const { deriveNotifications } = await import("@/lib/mobile/notifications");
    customerOrdersByEmail.mockClear();
    await deriveNotifications("yeni@laffogato.net", new Date(), undefined, {
      withOrders: false,
    });
    expect(customerOrdersByEmail).not.toHaveBeenCalled();

    await deriveNotifications("uye@laffogato.net");
    expect(customerOrdersByEmail).toHaveBeenCalledTimes(1);
  });

  it("the notifications route passes the member's verification through", () => {
    const route = readFileSync(
      "src/app/api/mobile/v1/notifications/route.ts",
      "utf8",
    );
    expect(route).toContain("withOrders: auth.customer.emailVerified");
  });
});

describe("transitionOrder writes only from the status it decided on", () => {
  it("is conditional on the status it read, and says so when it lost", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    const body = store.slice(
      store.indexOf("export async function transitionOrder("),
      store.indexOf("async function awardLoyalty("),
    );
    expect(body).toMatch(/\.eq\("status", existing\.status\)/);
    // Stock and loyalty follow only a write that actually happened.
    expect(body.indexOf("moved.length === 0")).toBeLessThan(
      body.indexOf("releaseOrderInventory(existing)"),
    );
  });
});
