import { describe, expect, it } from "vitest";

import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";
import { DEFAULT_MOBILE_APP_CONFIG } from "@/lib/mobile/app-config";
import {
  BADGE_IDS,
  buildLoyaltyView,
  computeBadges,
  computeStampBalance,
  rewardReadyAt,
  stampedOrderIds,
  computeTier,
  countOrdersLast365,
  freeDrinkRewardFor,
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

  it("uses the contract's target of six by default", () => {
    expect(STAMP_TARGET).toBe(6);
    expect(DEFAULT_MOBILE_APP_CONFIG.loyalty.stampTarget).toBe(STAMP_TARGET);
    // The default parameter and an explicit 6 must agree.
    const rows = Array.from({ length: 13 }, () => stamp("earn"));
    expect(computeStampBalance(rows)).toEqual(computeStampBalance(rows, 6));
  });

  it("reads the ledger against a configured target of eight", () => {
    const seven = Array.from({ length: 7 }, () => stamp("earn"));
    // Seven stamps fill a six-card and start the next; on an eight-card
    // they are still one short.
    expect(computeStampBalance(seven, 8)).toMatchObject({
      stamps: 7,
      rewardsReady: 0,
      available: 7,
    });
    const eight = [...seven, stamp("earn")];
    expect(computeStampBalance(eight, 8)).toMatchObject({
      stamps: 0,
      rewardsReady: 1,
      lifetimeStamps: 8,
    });
    // 20 earned, one redeem: 20 − 8 = 12 → one more ready, four on the card.
    const rows = [
      ...Array.from({ length: 20 }, () => stamp("earn")),
      stamp("redeem", -8),
    ];
    expect(computeStampBalance(rows, 8)).toEqual({
      lifetimeStamps: 20,
      redeemCount: 1,
      available: 12,
      stamps: 4,
      rewardsReady: 1,
    });
  });

  it("charges a redeem row the current target, not its own delta", () => {
    // A card that grew from 6 to 8 re-reads the old redeem at 8: the operator
    // changed the deal for everyone.
    const rows = [
      ...Array.from({ length: 14 }, () => stamp("earn")),
      stamp("redeem", -6),
    ];
    expect(computeStampBalance(rows, 8).available).toBe(6);
  });
});

describe("freeDrinkRewardFor", () => {
  it("builds the coupon from the configured rules", () => {
    expect(
      freeDrinkRewardFor({
        rewardTitle: "Bir espresso bizden",
        rewardValueMinor: 15000,
        rewardTtlDays: 30,
      }),
    ).toEqual({
      kind: "fixed",
      valueMinor: 15000,
      title: "Bir espresso bizden",
      minSubtotalMinor: 0,
      ttlDays: 30,
    });
  });

  it("the defaults are the contract's ₺280 / 90-day free drink", () => {
    expect(freeDrinkRewardFor(DEFAULT_MOBILE_APP_CONFIG.loyalty)).toEqual({
      kind: "fixed",
      valueMinor: 28000,
      title: "Ücretsiz içecek",
      minSubtotalMinor: 0,
      ttlDays: 90,
    });
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

  it("labels are the tricolore's names, the ids untouched (karar 165)", () => {
    expect(TIER_LABELS).toEqual({
      verde: "L'AF",
      argento: "PEARL",
      oro: "RUBY",
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
      order({ names: ["Çilekli Matcha", "Cappuccino"], qty: 1 }),
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
      tierLabel: "PEARL",
      ordersLast365: 13,
    });
    expect(view.badges).toHaveLength(6);
  });

  it("publishes the target it computed the balance with", () => {
    const stamps = Array.from({ length: 10 }, () => stamp("earn"));
    const view = buildLoyaltyView(stamps, [], NOW, 8);
    expect(view).toMatchObject({
      stamps: 2,
      stampTarget: 8,
      rewardsReady: 1,
      lifetimeStamps: 10,
    });
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

describe("rewardReadyAt", () => {
  const earn = (createdAt: string) => ({
    kind: "earn" as const,
    delta: 1,
    createdAt,
  });
  const at = (day: number) =>
    `2026-08-${String(day).padStart(2, "0")}T09:00:00.000Z`;

  it("is null while the card is not full", () => {
    expect(rewardReadyAt([earn(at(1)), earn(at(2))])).toBeNull();
  });

  it("is the stamp that filled the card, not the newest one", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((d) => earn(at(d)));
    expect(rewardReadyAt(rows)).toBe(at(6));
  });

  it("does not move when the ledger does not — the inbox keys 'unread' on it", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((d) => earn(at(d)));
    expect(rewardReadyAt(rows)).toBe(rewardReadyAt([...rows].reverse()));
  });

  it("points at the newest full card when two are waiting", () => {
    const rows = Array.from({ length: 12 }, (_, i) => earn(at(i + 1)));
    expect(rewardReadyAt(rows)).toBe(at(12));
  });

  it("follows the redeemed cards, not the lifetime count", () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => earn(at(i + 1))),
      { kind: "redeem" as const, delta: -6, createdAt: at(13) },
    ];
    expect(rewardReadyAt(rows)).toBe(at(12));
  });
});

/**
 * `stampsEarned` on the wire used to be inferred from the order status, so a
 * best-effort `onOrderPaid` failure had the app claiming a stamp the ledger
 * never got — and a refund's reversal was invisible to it.
 */
describe("stampedOrderIds", () => {
  const row = (
    kind: "earn" | "redeem" | "reversal",
    orderId: string,
  ): { kind: "earn" | "redeem" | "reversal"; orderId: string } => ({
    kind,
    orderId,
  });

  it("lists the orders with a live earn row", () => {
    const ids = stampedOrderIds([row("earn", "ord-1"), row("earn", "ord-2")]);
    expect([...ids].sort()).toEqual(["ord-1", "ord-2"]);
  });

  it("drops an order whose stamp was reversed", () => {
    const ids = stampedOrderIds([
      row("earn", "ord-1"),
      row("earn", "ord-2"),
      row("reversal", "ord-1"),
    ]);
    expect([...ids]).toEqual(["ord-2"]);
  });

  it("ignores rows with no order — a counter stamp belongs to no order", () => {
    const ids = stampedOrderIds([
      row("earn", ""),
      row("reversal", ""),
      row("redeem", ""),
      row("earn", "ord-3"),
    ]);
    expect([...ids]).toEqual(["ord-3"]);
  });

  it("does not let a counter correction cancel an order's stamp", () => {
    // reverseCounterStamp() writes `reversal` with an empty orderId; counting
    // reversals globally would have taken the newest order's stamp away.
    const ids = stampedOrderIds([row("earn", "ord-4"), row("reversal", "")]);
    expect([...ids]).toEqual(["ord-4"]);
  });
});
