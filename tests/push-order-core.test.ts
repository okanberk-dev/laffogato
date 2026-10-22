import { describe, expect, it } from "vitest";

import {
  expoMessagesFor,
  isExpoPushToken,
  maskPushToken,
  orderPushFor,
  orderPushUrl,
  platformFromUserAgent,
  readyMailDue,
  summariseTickets,
  type OrderPushSource,
} from "@/lib/push/order-push-core";

/**
 * Which order move earns a phone notification, what it says, and the Expo
 * message it becomes (docs/API-MOBILE.md §23). Pure: no database, no fetch.
 */

const cafe = (fulfillment: string, extra: Partial<OrderPushSource> = {}) =>
  ({
    id: "ord-0042",
    orderNo: 10234,
    kind: "cafe",
    fulfillment,
    source: "",
    ...extra,
  }) satisfies OrderPushSource;

describe("orderPushFor", () => {
  it("tells a pickup order it is ready, in the inbox's words", () => {
    const p = orderPushFor(cafe("pickup"), "preparing", "shipped");
    expect(p).toMatchObject({
      kind: "ready",
      title: "Siparişin hazır",
      body: "#10234 numaralı siparişin hazır, tezgâhta seni bekliyor.",
      url: "/siparis/ord-0042/takip",
    });
    // A stale "hazır" the next morning is worse than none.
    expect(p!.ttlSeconds).toBeLessThanOrEqual(2 * 3600);
  });

  it("is ready straight from paid too (one tap on the bar screen)", () => {
    expect(orderPushFor(cafe("pickup"), "paid", "shipped")?.kind).toBe("ready");
  });

  it("tells a courier order it left, and a café order it is being made", () => {
    expect(orderPushFor(cafe("delivery"), "preparing", "shipped")).toMatchObject({
      kind: "on_the_way",
      title: "Siparişin yolda",
      body: "#10234 numaralı siparişin kuryede, yola çıktı.",
    });
    expect(orderPushFor(cafe("table"), "paid", "preparing")).toMatchObject({
      kind: "preparing",
      body: "#10234 numaralı siparişin hazırlanıyor.",
    });
  });

  it("does not tell a table order it reached the table: the member is there", () => {
    expect(orderPushFor(cafe("table"), "preparing", "shipped")).toBeNull();
  });

  it("tells a shop parcel it is with the carrier, never that it is preparing", () => {
    const shop = { id: "ord-7", orderNo: 10007, kind: "shop", fulfillment: "shipping" };
    expect(orderPushFor(shop, "paid", "shipped")).toMatchObject({
      kind: "shipped",
      title: "Siparişin kargoda",
    });
    expect(orderPushFor(shop, "paid", "preparing")).toBeNull();
  });

  it("tells a paid order it was cancelled, never an abandoned unpaid one", () => {
    expect(orderPushFor(cafe("pickup"), "paid", "cancelled")).toMatchObject({
      kind: "cancelled",
      title: "Siparişin iptal edildi",
    });
    expect(orderPushFor(cafe("pickup"), "pending_payment", "cancelled")).toBeNull();
  });

  it("says nothing about payment, completion or orders typed in at the till", () => {
    expect(orderPushFor(cafe("pickup"), "pending_payment", "paid")).toBeNull();
    expect(orderPushFor(cafe("pickup"), "shipped", "completed")).toBeNull();
    expect(
      orderPushFor(cafe("pickup", { source: "manual" }), "preparing", "shipped"),
    ).toBeNull();
  });

  it("never carries a name, an address or the lines", () => {
    for (const to of ["preparing", "shipped", "cancelled"] as const) {
      const p = orderPushFor(
        { ...cafe("pickup"), customerName: "Ayşe Yılmaz" } as OrderPushSource,
        "paid",
        to,
      );
      if (p) expect(`${p.title} ${p.body}`).not.toMatch(/Ayşe|Yılmaz/);
    }
  });
});

describe("tokens, platform and messages", () => {
  it("accepts only Expo push tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abcDEF123_-xyz]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[a b]")).toBe(false);
    expect(isExpoPushToken("fcm-raw-token")).toBe(false);
    expect(isExpoPushToken(`ExponentPushToken[${"a".repeat(300)}]`)).toBe(false);
    expect(isExpoPushToken(42)).toBe(false);
  });

  it("reads the platform from React Native's user agent", () => {
    expect(platformFromUserAgent("L'Affogato/2 CFNetwork/1568 Darwin/24.0.0")).toBe("ios");
    expect(platformFromUserAgent("okhttp/4.12.0")).toBe("android");
    expect(platformFromUserAgent("curl/8")).toBe("");
    expect(platformFromUserAgent(null)).toBe("");
  });

  it("builds one high-priority 'orders' channel message per token, one slot per order", () => {
    const push = orderPushFor(cafe("pickup"), "preparing", "shipped")!;
    const msgs = expoMessagesFor(["ExponentPushToken[aaaaaaaaaa]", "ExponentPushToken[bbbbbbbbbb]"], "ord-0042", push);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({
      to: "ExponentPushToken[aaaaaaaaaa]",
      channelId: "orders",
      priority: "high",
      sound: "default",
      collapseId: "order-ord-0042",
      tag: "order-ord-0042",
      data: { type: "order", orderId: "ord-0042", url: "/siparis/ord-0042/takip", kind: "ready" },
    });
    // Expo refuses payloads over 4 KB; ours is a few hundred bytes.
    expect(JSON.stringify(msgs[0]).length).toBeLessThan(1024);
  });

  it("encodes the order id in the tap route", () => {
    expect(orderPushUrl("ord-1")).toBe("/siparis/ord-1/takip");
    expect(orderPushUrl("a/b")).toBe("/siparis/a%2Fb/takip");
  });

  it("sorts tickets into accepted, gone and refused", () => {
    const s = summariseTickets(
      ["t1", "t2", "t3", "t4"],
      [
        { status: "ok", id: "r1" },
        { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
        { status: "error", message: "rate", details: { error: "MessageRateExceeded" } },
      ],
    );
    expect(s.accepted).toEqual([{ token: "t1", id: "r1" }]);
    expect(s.gone).toEqual(["t2"]);
    expect(s.errors).toEqual(["MessageRateExceeded", "no ticket"]);
  });

  it("mails 'siparişin hazır' only for a ready pickup that reached no phone", () => {
    const ready = orderPushFor(cafe("pickup"), "preparing", "shipped");
    const prep = orderPushFor(cafe("pickup"), "paid", "preparing");
    expect(readyMailDue(ready, 0)).toBe(true);
    expect(readyMailDue(ready, 1)).toBe(false);
    expect(readyMailDue(prep, 0)).toBe(false);
    expect(readyMailDue(null, 0)).toBe(false);
  });

  it("masks a token for logs", () => {
    expect(maskPushToken("ExponentPushToken[abcdefghijklmnop]")).toBe("…mnop");
  });
});
