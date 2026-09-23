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
    preparingAt: string;
    shippedAt: string;
    completedAt: string;
    fulfillment: string;
  }> = {},
) {
  return {
    id: "ord-0284",
    orderNo: 284,
    status: "preparing",
    createdAt: "2026-08-29T09:00:00.000Z",
    paidAt: "2026-08-29T09:05:00.000Z",
    preparingAt: "",
    shippedAt: "",
    completedAt: "",
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
      "Hazır - gel al",
      "Teslim alındı",
    ]);
  });

  it("keeps a late stage on an old order — the window is per stage", () => {
    // A gift box paid 32 days ago and shipped today: the stage is today's
    // news even though the order is outside the window.
    const created = new Date(
      NOW.getTime() - (NOTIFICATION_WINDOW_DAYS + 2) * 86_400_000,
    ).toISOString();
    const items = deriveOrderNotifications(
      [
        order({
          status: "shipped",
          createdAt: created,
          paidAt: created,
          shippedAt: "2026-08-30T08:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["order-ord-0284-shipped"]);
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

  it("dates each stage from its own column", () => {
    const items = deriveOrderNotifications(
      [
        order({
          status: "completed",
          preparingAt: "2026-08-29T09:20:00.000Z",
          shippedAt: "2026-08-29T10:00:00.000Z",
          completedAt: "2026-08-29T10:40:00.000Z",
        }),
      ],
      NOW,
    );
    expect(items.map((i) => i.at)).toEqual([
      "2026-08-29T09:05:00.000Z",
      "2026-08-29T09:20:00.000Z",
      "2026-08-29T10:00:00.000Z",
      "2026-08-29T10:40:00.000Z",
    ]);
  });

  it("keeps a stage reached today when payment was outside the window", () => {
    // The bug the stage columns fix: every stage borrowed paidAt, so a long
    // order delivered today was dated 40 days ago and dropped from the inbox.
    const items = deriveOrderNotifications(
      [
        order({
          status: "completed",
          createdAt: "2026-07-21T09:00:00.000Z",
          paidAt: "2026-07-21T09:05:00.000Z",
          preparingAt: "2026-08-29T09:20:00.000Z",
          shippedAt: "2026-08-29T10:00:00.000Z",
          completedAt: "2026-08-30T08:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual([
      "order-ord-0284-preparing",
      "order-ord-0284-shipped",
      "order-ord-0284-completed",
    ]);
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

  it("stamps the reward with the moment the card filled, not the request", () => {
    const filled = "2026-08-20T10:00:00.000Z";
    const first = buildNotifications({
      orders: [],
      announcements: [],
      rewardsReady: 1,
      rewardAt: filled,
      now: NOW,
    });
    const later = buildNotifications({
      orders: [],
      announcements: [],
      rewardsReady: 1,
      rewardAt: filled,
      now: new Date(NOW.getTime() + 5 * 60_000),
    });
    // The app derives "unread" from `at`; a moving `at` made the reward
    // unread again a minute after the member marked the inbox read.
    expect(first[0].at).toBe(filled);
    expect(later[0].at).toBe(filled);
  });

  it("keeps campaign rows out when the member turned marketing off", () => {
    const announcements = [
      {
        id: "ann-1",
        kind: "campaign" as const,
        title: "Kampanya",
        body: "…",
        startsAt: "2026-08-29T12:00:00.000Z",
        createdAt: "",
      },
      {
        id: "ann-2",
        kind: "info" as const,
        title: "Duyuru",
        body: "…",
        startsAt: "2026-08-29T13:00:00.000Z",
        createdAt: "",
      },
    ];
    const off = buildNotifications({
      orders: [order()],
      announcements,
      rewardsReady: 0,
      now: NOW,
      prefs: { marketing: false, orderUpdates: true },
    });
    expect(off.map((i) => i.id)).not.toContain("announcement-ann-1");
    // Order rows are the member's own transactions, not a commercial message.
    expect(off.map((i) => i.id)).toContain("order-ord-0284-paid");
    expect(off.map((i) => i.id)).toContain("announcement-ann-2");

    const on = buildNotifications({
      orders: [],
      announcements,
      rewardsReady: 0,
      now: NOW,
      prefs: { marketing: true },
    });
    expect(on.map((i) => i.id)).toContain("announcement-ann-1");
  });
});
