import { describe, expect, it } from "vitest";

import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";
import {
  BADGE_IDS,
  buildLoyaltyView,
  computeBadges,
  computeStampBalance,
  computeTier,
  countOrdersLast365,
  istanbulParts,
  longestDailyStreak,
  STAMP_TARGET,
  TIER_LABELS,
} from "@/lib/mobile/loyalty-core";

const NOW = Date.UTC(2026, 7, 30, 12); // 2026-08-30T12:00Z

function stamp(kind: "earn" | "redeem", delta = kind === "earn" ? 1 : -6) {
  return { kind, delta };
}

function order(
  over: Partial<AdminOrder> & { names?: string[]; qty?: number } = {},
): AdminOrder {
  const { names = ["Cappuccino"], qty = 1, ...rest } = over;
  return {
    id: "ord-0001",
    orderNo: 1,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: names.map((productName) => ({
      productName,
      qty,
      unitPriceMinor: 19500,
      status: "pending" as const,
    })),
    subtotalMinor: 19500,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 19500,
    refunds: [],
    createdAt: "2026-08-20T10:00:00.000Z",
    ...rest,
  };
}

function badge(orders: AdminOrder[], id: string): boolean {
  const b = computeBadges(orders).find((x) => x.id === id);
  if (!b) throw new Error(`no badge ${id}`);
  return b.earned;
}

describe("computeStampBalance", () => {
  it("is empty with no ledger rows", () => {
    expect(computeStampBalance([])).toEqual({
      lifetimeStamps: 0,
      redeemCount: 0,
      available: 0,
      stamps: 0,
      rewardsReady: 0,
    });
  });

  it("fills the card up to five and turns the sixth into a ready reward", () => {
    const five = Array.from({ length: 5 }, () => stamp("earn"));
    expect(computeStampBalance(five)).toMatchObject({
      stamps: 5,
      rewardsReady: 0,
    });
    const six = [...five, stamp("earn")];
    expect(computeStampBalance(six)).toMatchObject({
      stamps: 0,
      rewardsReady: 1,
      lifetimeStamps: 6,
    });
  });

  it("subtracts six per redeem row, keeps lifetime total", () => {
    const rows = [
      ...Array.from({ length: 14 }, () => stamp("earn")),
      stamp("redeem"),
    ];
    expect(computeStampBalance(rows)).toEqual({
      lifetimeStamps: 14,
      redeemCount: 1,
      available: 8,
      stamps: 2,
      rewardsReady: 1,
    });
  });

  it("counts a redeem row by presence, not by its delta", () => {
    // A hand-edited −5 must not leave the member a phantom stamp.
    const rows = [
      ...Array.from({ length: 6 }, () => stamp("earn")),
      stamp("redeem", -5),
    ];
    expect(computeStampBalance(rows).available).toBe(0);
  });

  it("never goes negative", () => {
    expect(computeStampBalance([stamp("redeem")]).available).toBe(0);
  });

  it("uses the contract's target of six", () => {
    expect(STAMP_TARGET).toBe(6);
  });
});

describe("computeTier", () => {
  it("maps paid-order counts to verde / argento / oro", () => {
    expect(computeTier(0)).toBe("verde");
    expect(computeTier(11)).toBe("verde");
    expect(computeTier(12)).toBe("argento");
    expect(computeTier(35)).toBe("argento");
    expect(computeTier(36)).toBe("oro");
  });

  it("labels are upper-case Italian", () => {
    expect(TIER_LABELS).toEqual({
      verde: "VERDE",
      argento: "ARGENTO",
      oro: "ORO",
    });
  });
});

describe("countOrdersLast365", () => {
  it("counts only paid-ish orders inside the window", () => {
    const orders = [
      order({ createdAt: "2026-08-01T10:00:00.000Z", status: "completed" }),
      order({ createdAt: "2025-09-15T10:00:00.000Z", status: "paid" }),
      order({ createdAt: "2025-08-01T10:00:00.000Z", status: "paid" }), // >365d
      order({ createdAt: "2026-08-01T10:00:00.000Z", status: "cancelled" }),
      order({
        createdAt: "2026-08-01T10:00:00.000Z",
        status: "pending_payment",
      }),
      order({ createdAt: "2026-08-01T10:00:00.000Z", status: "refunded" }),
      order({ createdAt: "2026-08-01T10:00:00.000Z", status: "preparing" }),
      order({ createdAt: "2026-08-01T10:00:00.000Z", status: "shipped" }),
    ];
    expect(countOrdersLast365(orders, NOW)).toBe(4);
  });

  it("ignores unparsable timestamps", () => {
    expect(countOrdersLast365([order({ createdAt: "" })], NOW)).toBe(0);
  });
});

describe("istanbulParts", () => {
  it("shifts to UTC+3", () => {
    // 05:30Z = 08:30 Istanbul → still early bird
    expect(istanbulParts("2026-08-20T05:30:00.000Z")).toMatchObject({
      dayKey: "2026-08-20",
      hour: 8,
    });
    // 21:30Z = 00:30 next day in Istanbul
    expect(istanbulParts("2026-08-20T21:30:00.000Z")).toMatchObject({
      dayKey: "2026-08-21",
      hour: 0,
    });
    expect(istanbulParts("nope")).toBeNull();
  });
});

describe("longestDailyStreak", () => {
  it("counts consecutive Istanbul calendar days, once per day", () => {
    const days = [18, 19, 19, 20, 22, 23];
    const orders = days.map((d) =>
      order({ createdAt: `2026-08-${String(d).padStart(2, "0")}T10:00:00Z` }),
    );
    expect(longestDailyStreak(orders)).toBe(3);
  });

  it("skips orders that do not count", () => {
    const orders = [
      order({ createdAt: "2026-08-18T10:00:00Z" }),
      order({ createdAt: "2026-08-19T10:00:00Z", status: "cancelled" }),
      order({ createdAt: "2026-08-20T10:00:00Z" }),
    ];
    expect(longestDailyStreak(orders)).toBe(1);
  });
});

describe("computeBadges", () => {
  it("returns every contract badge in order, unearned for a new member", () => {
    const badges = computeBadges([]);
    expect(badges.map((b) => b.id)).toEqual(BADGE_IDS);
    expect(badges.every((b) => b.earned === false)).toBe(true);
    expect(badges.map((b) => b.label)).toEqual([
      "İlk affogato",
      "10 gün üst üste",
      "Erken kuş",
      "Matcha meraklısı",
      "Çekirdek abonesi",
      "50 sipariş",
    ]);
  });

  it("first-affogato needs the signature L'Affogato item (apostrophe-insensitive)", () => {
    expect(badge([order({ names: ["L’Affogato"] })], "first-affogato")).toBe(
      true,
    );
    expect(badge([order({ names: ["l'affogato"] })], "first-affogato")).toBe(
      true,
    );
    // Another affogato is not the signature one.
    expect(
      badge([order({ names: ["Matcha Affogato"] })], "first-affogato"),
    ).toBe(false);
    // A cancelled line or an unpaid order does not count.
    const cancelledLine = order({ names: ["L'Affogato"] });
    cancelledLine.items[0].status = "cancelled";
    expect(badge([cancelledLine], "first-affogato")).toBe(false);
    expect(
      badge(
        [order({ names: ["L'Affogato"], status: "pending_payment" })],
        "first-affogato",
      ),
    ).toBe(false);
  });

  it("early-bird is an order before 09:00 Istanbul time", () => {
    expect(
      badge([order({ createdAt: "2026-08-20T05:59:00Z" })], "early-bird"),
    ).toBe(true);
    expect(
      badge([order({ createdAt: "2026-08-20T06:00:00Z" })], "early-bird"),
    ).toBe(false);
  });

  it("matcha-fan sums matcha quantities across orders", () => {
    const orders = [
      order({ names: ["Matcha Latte"], qty: 2 }),
      order({ names: ["Strawberry Matcha", "Cappuccino"], qty: 1 }),
      order({ names: ["Uji Matcha — Ceremonial"], qty: 1 }),
    ];
    expect(badge(orders, "matcha-fan")).toBe(false); // 4
    expect(
      badge([...orders, order({ names: ["Matcha Affogato"] })], "matcha-fan"),
    ).toBe(true); // 5
  });

  it("streak-10 needs ten consecutive days", () => {
    const nine = Array.from({ length: 9 }, (_, i) =>
      order({ createdAt: `2026-08-${String(i + 1).padStart(2, "0")}T10:00Z` }),
    );
    expect(badge(nine, "streak-10")).toBe(false);
    const ten = [...nine, order({ createdAt: "2026-08-10T10:00Z" })];
    expect(badge(ten, "streak-10")).toBe(true);
  });

  it("orders-50 counts paid orders only; bean-subscriber is never earned", () => {
    const fifty = Array.from({ length: 50 }, (_, i) =>
      order({ id: `ord-${i}`, status: i % 2 ? "completed" : "paid" }),
    );
    expect(badge(fifty, "orders-50")).toBe(true);
    expect(badge(fifty, "bean-subscriber")).toBe(false);
    const withCancelled = fifty.map((o, i) =>
      i === 0 ? { ...o, status: "cancelled" as AdminOrderStatus } : o,
    );
    expect(badge(withCancelled, "orders-50")).toBe(false);
  });
});

describe("buildLoyaltyView", () => {
  it("assembles the /me.loyalty block", () => {
    const stamps = [...Array.from({ length: 10 }, () => stamp("earn"))];
    const orders = Array.from({ length: 13 }, (_, i) =>
      order({ createdAt: `2026-0${(i % 6) + 1}-15T10:00:00Z` }),
    );
    const view = buildLoyaltyView(stamps, orders, NOW);
    expect(view).toMatchObject({
      stamps: 4,
      stampTarget: 6,
      rewardsReady: 1,
      lifetimeStamps: 10,
      tier: "argento",
      tierLabel: "ARGENTO",
      ordersLast365: 13,
    });
    expect(view.badges).toHaveLength(6);
  });
});

describe("stamp reversal (refund / cancel)", () => {
  it("a reversal takes the stamp back out of the balance", () => {
    const earned = computeStampBalance([
      { kind: "earn", delta: 1 },
      { kind: "earn", delta: 1 },
      { kind: "earn", delta: 1 },
    ]);
    expect(earned.stamps).toBe(3);
    expect(earned.lifetimeStamps).toBe(3);

    const afterRefund = computeStampBalance([
      { kind: "earn", delta: 1 },
      { kind: "earn", delta: 1 },
      { kind: "earn", delta: 1 },
      { kind: "reversal", delta: -1 },
    ]);
    expect(afterRefund.stamps).toBe(2);
    expect(afterRefund.lifetimeStamps).toBe(2);
  });

  it("pay → earn → refund cannot be farmed into a reward", () => {
    // Six paid-then-refunded orders must leave nothing to redeem.
    const rows = Array.from({ length: 6 }, () => [
      { kind: "earn" as const, delta: 1 },
      { kind: "reversal" as const, delta: -1 },
    ]).flat();
    const balance = computeStampBalance(rows);
    expect(balance.available).toBe(0);
    expect(balance.rewardsReady).toBe(0);
  });

  it("never reports a negative balance", () => {
    const balance = computeStampBalance([
      { kind: "earn", delta: 1 },
      { kind: "reversal", delta: -1 },
      { kind: "reversal", delta: -1 },
    ]);
    expect(balance.lifetimeStamps).toBe(0);
    expect(balance.available).toBe(0);
  });
});
