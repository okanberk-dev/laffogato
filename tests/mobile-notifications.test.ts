import { describe, expect, it } from "vitest";

import {
  buildNotifications,
  deriveAnnouncementNotifications,
  deriveOrderNotifications,
  NOTIFICATION_WINDOW_DAYS,
  rewardNotification,
} from "@/lib/mobile/notifications";

const NOW = new Date("2026-08-30T12:00:00.000Z");

function order(
  over: Partial<{
    id: string;
    orderNo: number;
    status: string;
    createdAt: string;
    paidAt: string;
    shippedAt: string;
    fulfillment: string;
  }> = {},
) {
  return {
    id: "ord-0284",
    orderNo: 284,
    status: "preparing",
    createdAt: "2026-08-29T09:00:00.000Z",
    paidAt: "2026-08-29T09:05:00.000Z",
    shippedAt: "",
    ...over,
  } as Parameters<typeof deriveOrderNotifications>[0][number];
}

describe("deriveOrderNotifications", () => {
  it("emits one record per stage reached, with stable ids", () => {
    const items = deriveOrderNotifications([order()], NOW);
    expect(items.map((i) => i.id)).toEqual([
      "order-ord-0284-paid",
      "order-ord-0284-preparing",
    ]);
    expect(items.map((i) => i.title)).toEqual([
      "Ödemen alındı",
      "Hazırlanıyor",
    ]);
    expect(items.every((i) => i.kind === "order")).toBe(true);
    expect(items.every((i) => i.orderId === "ord-0284")).toBe(true);
    expect(items[0].at).toBe("2026-08-29T09:05:00.000Z");
  });

  it("says nothing about unpaid, cancelled or refunded orders", () => {
    for (const status of ["pending_payment", "cancelled", "refunded"]) {
      expect(deriveOrderNotifications([order({ status })], NOW)).toEqual([]);
    }
  });

  it("drops orders older than the window", () => {
    const old = new Date(
      NOW.getTime() - (NOTIFICATION_WINDOW_DAYS + 1) * 86_400_000,
    ).toISOString();
    expect(
      deriveOrderNotifications([order({ createdAt: old, paidAt: old })], NOW),
    ).toEqual([]);
    const edge = new Date(
      NOW.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000,
    ).toISOString();
    expect(
      deriveOrderNotifications([order({ createdAt: edge, paidAt: edge })], NOW),
    ).toHaveLength(2);
  });

  it("reads 'Yolda' for a shipped web order and uses the ship time", () => {
    const items = deriveOrderNotifications(
      [order({ status: "shipped", shippedAt: "2026-08-30T08:00:00.000Z" })],
      NOW,
    );
    const shipped = items.find((i) => i.id.endsWith("-shipped"));
    expect(shipped?.title).toBe("Yolda");
    expect(shipped?.body).toMatch(/kargoya/);
    expect(shipped?.at).toBe("2026-08-30T08:00:00.000Z");
  });

  it("phrases delivery and pickup differently", () => {
    const delivery = deriveOrderNotifications(
      [order({ status: "shipped", fulfillment: "delivery" })],
      NOW,
    ).find((i) => i.id.endsWith("-shipped"));
    expect(delivery?.title).toBe("Yolda");
    expect(delivery?.body).toMatch(/kuryede/);

    const pickup = deriveOrderNotifications(
      [order({ status: "completed", fulfillment: "pickup" })],
      NOW,
    );
    expect(pickup.map((i) => i.title)).toEqual([
      "Ödemen alındı",
      "Hazırlanıyor",
      "Hazır — gel al",
      "Teslim alındı",
    ]);
  });

  it("reads 'Teslim edildi' when a shipped order completes", () => {
    const items = deriveOrderNotifications(
      [order({ status: "completed" })],
      NOW,
    );
    expect(items.at(-1)?.title).toBe("Teslim edildi");
    expect(items).toHaveLength(4);
  });

  it("falls back to createdAt when the order was never stamped paid", () => {
    const items = deriveOrderNotifications(
      [order({ status: "paid", paidAt: "" })],
      NOW,
    );
    expect(items[0].at).toBe("2026-08-29T09:00:00.000Z");
  });
});

describe("deriveAnnouncementNotifications", () => {
  it("maps a campaign announcement to kind 'campaign', the rest to 'announcement'", () => {
    const items = deriveAnnouncementNotifications([
      {
        id: "ann-1",
        kind: "campaign",
        title: "Happy hour",
        body: "14–17 arası %25",
        startsAt: "2026-08-28T00:00:00.000Z",
        createdAt: "2026-08-20T00:00:00.000Z",
      },
      {
        id: "ann-2",
        kind: "hours",
        title: "Hafta sonu",
        body: "01:00'e kadar",
        startsAt: "",
        createdAt: "2026-08-21T00:00:00.000Z",
      },
    ]);
    expect(items[0]).toEqual({
      id: "announcement-ann-1",
      kind: "campaign",
      title: "Happy hour",
      body: "14–17 arası %25",
      at: "2026-08-28T00:00:00.000Z",
      orderId: null,
    });
    expect(items[1].kind).toBe("announcement");
    // No start date → the creation date, so it still sorts.
    expect(items[1].at).toBe("2026-08-21T00:00:00.000Z");
  });
});

describe("rewardNotification", () => {
  it("is absent without a ready reward", () => {
    expect(rewardNotification(0, NOW.toISOString())).toBeNull();
    expect(rewardNotification(-1, NOW.toISOString())).toBeNull();
  });

  it("announces one or several rewards with a stable id", () => {
    expect(rewardNotification(1, NOW.toISOString())?.title).toBe(
      "Ödülün hazır",
    );
    const many = rewardNotification(2, NOW.toISOString());
    expect(many?.id).toBe("reward-ready");
    expect(many?.kind).toBe("reward");
    expect(many?.body).toMatch(/2 ücretsiz/);
  });
});

describe("buildNotifications", () => {
  it("merges every source and sorts newest first", () => {
    const items = buildNotifications({
      orders: [order()],
      announcements: [
        {
          id: "ann-1",
          kind: "info",
          title: "Duyuru",
          body: "…",
          startsAt: "2026-08-29T12:00:00.000Z",
          createdAt: "",
        },
      ],
      rewardsReady: 1,
      now: NOW,
    });
    expect(items.map((i) => i.id)).toEqual([
      "reward-ready",
      "announcement-ann-1",
      "order-ord-0284-paid",
      "order-ord-0284-preparing",
    ]);
    // §8 shape: exactly these keys, nothing from the store row.
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual([
        "at",
        "body",
        "id",
        "kind",
        "orderId",
        "title",
      ]);
    }
  });
});
