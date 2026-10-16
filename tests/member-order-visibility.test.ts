import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { memberMaySeeOrder } from "@/lib/customer/member-order-visibility";

/**
 * Operator, 16 Eki 2026: an order whose payment never completed is not in
 * the member's profile ("ödeme tam alınmadan ... profilde gözükmesin").
 */
describe("memberMaySeeOrder", () => {
  it.each([
    ["pending_payment", "", 0, false],
    ["cancelled", "", 0, false],
    ["cancelled", "2026-10-16T10:00:00Z", 0, true],
    ["cancelled", "", 1, true],
    ["paid", "2026-10-16T10:00:00Z", 0, true],
    ["preparing", "", 0, true],
    ["shipped", "2026-10-16T10:00:00Z", 0, true],
    ["completed", "2026-10-16T10:00:00Z", 0, true],
    ["refunded", "2026-10-16T10:00:00Z", 1, true],
  ] as const)(
    "%s (paidAt %s, %d refunds) → %s",
    (status, paidAt, refunds, seen) => {
      expect(
        memberMaySeeOrder({
          status,
          paidAt,
          refunds: Array.from({ length: refunds }, (_, i) => ({
            id: `r${i}`,
          })) as never,
        }),
      ).toBe(seen);
    },
  );

  it("filters the list, its detail page and the account summary alike", () => {
    const lib = readFileSync("src/lib/customer/member-orders.ts", "utf8");
    expect(lib).toContain("orders.filter(memberMaySeeOrder)");
    for (const page of [
      "src/app/uye/hesap/page.tsx",
      "src/app/uye/hesap/siparislerim/page.tsx",
      "src/app/uye/hesap/siparislerim/[orderNo]/page.tsx",
    ]) {
      const src = readFileSync(page, "utf8");
      expect(src, page).toContain("memberOrders(");
      expect(src, page).not.toContain("customerOrdersByEmail(");
    }
  });

  it("the success page links an order's page only once it is listed", () => {
    const page = readFileSync("src/app/odeme/basarili/page.tsx", "utf8");
    expect(page).toContain("const listed = memberMaySeeOrder(order);");
    expect(page).toMatch(
      /\{listed \? \(\s+<Link\s+href=\{`\/uye\/hesap\/siparislerim\/\$\{order\.orderNo\}`\}/,
    );
  });
});
