import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/components/admin/forms";
import { orderActions } from "@/lib/admin/order-actions";

describe("admin dates are shown on the venue's clock", () => {
  it("prints a stored UTC instant as Istanbul time", () => {
    // A promo typed as 23:59 is stored as 20:59Z; the panel used to print
    // "20:59" on a UTC server and invite a three-hour "fix".
    expect(formatDateTime("2026-09-30T20:59:00.000Z")).toContain("23:59");
  });

  it("reads an offsetless value as Istanbul wall clock, like the store", () => {
    expect(formatDateTime("2026-09-30T23:59")).toContain("23:59");
  });
});

describe("the refund button follows the server's rule", () => {
  it("decides from the order's payment rows, not paidAt alone", () => {
    // A payment that lands after the sweep cancelled the order has a
    // succeeded transaction but no paidAt - and is the money that must go back.
    const page = readFileSync("src/app/admin/siparisler/[id]/page.tsx", "utf8");
    expect(page).toContain("orderMoneyFromRows(order, payments)");
    expect(page.replace(/\s+/g, " ")).toContain(
      "orderActions( order, session.role, m.collected, m.collectedMinor, )",
    );
  });

  it("offers a refund on a cancelled order only when money was taken", () => {
    const cancelled = { status: "cancelled" as const, totalMinor: 5000, refunds: [] };
    expect(orderActions(cancelled, "owner", true).refund?.enabled).toBe(true);
    expect(orderActions(cancelled, "owner", false).refund).toBeUndefined();
  });
});

describe("manual orders entered as already settled", () => {
  it("carry paidAt, so a later cancel can still be refunded", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toContain(
      'f.status === "paid" || f.status === "preparing"\n      ? { paidAt: createdAt }',
    );
  });
});
