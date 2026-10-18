import { describe, expect, it } from "vitest";

import {
  ORDER_ALERT_ACK_TTL_MS,
  ORDER_ALERT_LIMIT,
  ORDER_ALERT_WINDOW_MS,
  RING_CYCLE_MS,
  addAck,
  alertDisplayOrder,
  buildOrderAlerts,
  notificationBody,
  notificationPermissionText,
  notificationTag,
  notificationTitle,
  orderAlertLabel,
  orderAlertsSince,
  parseAcks,
  parseOrderAlertPayload,
  pendingAlerts,
  ringLevel,
  ringMotif,
  ringMotifLength,
  ringsForOrder,
  stripAlertTitle,
  titleWithAlerts,
  toOrderAlert,
  type OrderAlertRow,
} from "@/lib/admin/order-alerts-core";

/**
 * The panel's new-order alert, as rules: which orders ring (a paid cafe
 * order from the last four hours that nobody typed into the panel), what the
 * counter card and the desktop notification say, how a "Gördüm" is shared
 * and forgotten, and the ring as numbers.
 */

const NOW = Date.parse("2026-10-18T18:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function row(over: Partial<OrderAlertRow> = {}): OrderAlertRow {
  return {
    id: "ord-1",
    orderNo: 10234,
    status: "paid",
    kind: "cafe",
    source: "",
    fulfillment: "table",
    tableCode: "T4",
    tableName: "4",
    paidAt: minutesAgo(2),
    totalMinor: 18_500,
    items: [
      { productName: "Latte", qty: 2 },
      { productName: "Cheesecake", qty: 1 },
    ],
    ...over,
  };
}

describe("which orders ring", () => {
  it("a paid cafe order from the last four hours rings: table, gel-al and courier", () => {
    expect(ringsForOrder(row(), NOW)).toBe(true);
    expect(ringsForOrder(row({ fulfillment: "pickup", tableCode: "" }), NOW)).toBe(true);
    expect(ringsForOrder(row({ fulfillment: "delivery", tableCode: "" }), NOW)).toBe(true);
    // Paid a few seconds "in the future" by another host's clock still rings.
    expect(ringsForOrder(row({ paidAt: new Date(NOW + 30_000).toISOString() }), NOW)).toBe(true);
  });

  it("an order moved on, unpaid or cancelled does not", () => {
    for (const status of ["pending_payment", "preparing", "shipped", "completed", "cancelled", "refunded"]) {
      expect(ringsForOrder(row({ status }), NOW), status).toBe(false);
    }
  });

  it("a shop parcel never rings, nor an order with no kind (an old row is a shop order)", () => {
    expect(ringsForOrder(row({ kind: "shop", fulfillment: "shipping" }), NOW)).toBe(false);
    expect(ringsForOrder(row({ kind: undefined }), NOW)).toBe(false);
  });

  it("an order typed into the panel never rings: whoever typed it is at the counter", () => {
    expect(ringsForOrder(row({ source: "manual" }), NOW)).toBe(false);
  });

  it("an order paid more than four hours ago, or with no paidAt, does not", () => {
    expect(ringsForOrder(row({ paidAt: minutesAgo(4 * 60 - 1) }), NOW)).toBe(true);
    expect(ringsForOrder(row({ paidAt: minutesAgo(4 * 60 + 1) }), NOW)).toBe(false);
    expect(ringsForOrder(row({ paidAt: "" }), NOW)).toBe(false);
    expect(ringsForOrder(row({ paidAt: "dün" }), NOW)).toBe(false);
    expect(ORDER_ALERT_WINDOW_MS).toBe(4 * 60 * 60_000);
    expect(orderAlertsSince(NOW)).toBe("2026-10-18T14:00:00.000Z");
  });

  it("answers newest first, at most twenty", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      row({ id: `ord-${i}`, orderNo: 10000 + i, paidAt: minutesAgo(30 - i) }),
    );
    rows.push(row({ id: "shop", kind: "shop", paidAt: minutesAgo(0) }));
    const alerts = buildOrderAlerts(rows, NOW);
    expect(alerts).toHaveLength(ORDER_ALERT_LIMIT);
    expect(alerts[0].id).toBe("ord-24");
    expect(alerts.map((a) => a.id)).not.toContain("shop");
  });
});

describe("what the card says", () => {
  it("labels the table from its snapshot and the rest by how they leave", () => {
    expect(orderAlertLabel(row())).toBe("Masa 4");
    expect(orderAlertLabel(row({ tableName: "Masa 7" }))).toBe("Masa 7");
    expect(orderAlertLabel(row({ tableName: "MASA 7" }))).toBe("MASA 7");
    expect(orderAlertLabel(row({ tableName: "Bahçe 2" }))).toBe("Masa Bahçe 2");
    expect(orderAlertLabel(row({ tableName: "" }))).toBe("Masa T4");
    expect(orderAlertLabel(row({ fulfillment: "pickup", tableCode: "" }))).toBe("Gel-al");
    expect(orderAlertLabel(row({ fulfillment: "delivery", tableCode: "" }))).toBe("Kurye");
  });

  it("carries counts, the first three lines and money, nothing about the customer", () => {
    const alert = toOrderAlert(
      row({
        items: [
          { productName: "Latte", qty: 2 },
          { productName: "Americano", qty: 1 },
          { productName: "Cheesecake", qty: 1 },
          { productName: "Su", qty: 3 },
        ],
      }),
    );
    expect(alert).toEqual({
      id: "ord-1",
      orderNo: 10234,
      label: "Masa 4",
      table: true,
      itemCount: 7,
      items: ["2× Latte", "Americano", "Cheesecake"],
      moreItems: 1,
      totalMinor: 18_500,
      paidAt: minutesAgo(2),
    });
  });

  it("titles and bodies the desktop notification", () => {
    const table = toOrderAlert(row());
    expect(notificationTitle(table)).toBe("Yeni masa siparişi · Masa 4");
    expect(notificationBody(table)).toBe("#10234 · 3 ürün · ₺185,00");
    expect(notificationTag(table)).toBe("laf-order-ord-1");
    const pickup = toOrderAlert(row({ fulfillment: "pickup", tableCode: "" }));
    expect(notificationTitle(pickup)).toBe("Yeni gel-al siparişi");
    const courier = toOrderAlert(row({ fulfillment: "delivery", tableCode: "" }));
    expect(notificationTitle(courier)).toBe("Yeni kafe siparişi · Kurye");
  });

  it("puts table orders first on the screen, each group newest first", () => {
    const a = toOrderAlert(row({ id: "pick-new", fulfillment: "pickup", tableCode: "", paidAt: minutesAgo(1) }));
    const b = toOrderAlert(row({ id: "table-old", paidAt: minutesAgo(9) }));
    const c = toOrderAlert(row({ id: "table-new", paidAt: minutesAgo(3) }));
    expect(alertDisplayOrder([a, b, c]).map((x) => x.id)).toEqual(["table-new", "table-old", "pick-new"]);
  });

  it("prefixes the tab title with the count and gives it back at zero", () => {
    expect(titleWithAlerts("Admin · Siparişler", 2)).toBe("(2) Yeni sipariş · Admin · Siparişler");
    expect(titleWithAlerts("(2) Yeni sipariş · Admin · Siparişler", 3)).toBe("(3) Yeni sipariş · Admin · Siparişler");
    expect(titleWithAlerts("(3) Yeni sipariş · Admin · Siparişler", 0)).toBe("Admin · Siparişler");
    expect(stripAlertTitle("Admin · Kasa")).toBe("Admin · Kasa");
  });

  it("says the notification permission in plain Turkish, with the way out when it is blocked", () => {
    expect(notificationPermissionText("granted")).toBe("Masaüstü bildirimleri açık.");
    expect(notificationPermissionText("default")).toBe("Masaüstü bildirimleri kapalı.");
    const denied = notificationPermissionText("denied");
    expect(denied).toContain("kilit simgesinden");
    expect(denied).toContain("Sistem Ayarları > Bildirimler > Google Chrome");
    expect(notificationPermissionText("unsupported")).toContain("göstermiyor");
  });
});

describe("Gördüm, shared by the tabs", () => {
  it("remembers an acknowledgement for a day, then forgets it", () => {
    const acks = addAck({}, "ord-1", NOW - ORDER_ALERT_ACK_TTL_MS - 1);
    const fresh = addAck(acks, "ord-2", NOW);
    expect(Object.keys(fresh)).toEqual(["ord-2"]);
    expect(parseAcks(JSON.stringify({ "ord-1": NOW - 1000, "ord-9": NOW - 2 * ORDER_ALERT_ACK_TTL_MS }), NOW)).toEqual({ "ord-1": NOW - 1000 });
  });

  it("reads junk as nothing acknowledged", () => {
    for (const raw of [null, "", "{", "[1,2]", "42", JSON.stringify({ x: "y" })]) {
      expect(parseAcks(raw, NOW), String(raw)).toEqual({});
    }
  });

  it("keeps acknowledged orders off the pending list", () => {
    const alerts = [toOrderAlert(row({ id: "a" })), toOrderAlert(row({ id: "b" }))];
    expect(pendingAlerts(alerts, { a: NOW }).map((x) => x.id)).toEqual(["b"]);
  });
});

describe("the route's answer as the browser reads it", () => {
  it("keeps well-formed alerts and drops the rest", () => {
    const good = toOrderAlert(row());
    const parsed = parseOrderAlertPayload({ now: "x", alerts: [good, { id: 3 }, null, "x"] });
    expect(parsed).toEqual({ now: "x", alerts: [good] });
    expect(parseOrderAlertPayload({ alerts: "no" })).toBeNull();
    expect(parseOrderAlertPayload(null)).toBeNull();
    expect(parseOrderAlertPayload("<html>")).toBeNull();
  });
});

describe("the ring", () => {
  it("is three quick rising bell notes, played twice, with inharmonic partials", () => {
    const notes = ringMotif();
    expect(notes.map((n) => n.at)).toEqual([0, 0.11, 0.22, 0.5, 0.61, 0.72]);
    expect(notes.map((n) => n.freq)).toEqual([1046.5, 1318.5, 1568, 1046.5, 1318.5, 1568]);
    expect(notes.every((n) => n.peak > 0 && n.peak <= 0.5)).toBe(true);
    expect(notes.map((n) => n.decay)).toEqual([0.32, 0.32, 0.6, 0.32, 0.32, 0.6]);
    // Over well before the next cycle starts: the rings never overlap.
    expect(ringMotifLength(notes)).toBeCloseTo(1.32, 5);
    expect(ringMotifLength(notes) * 1000).toBeLessThan(RING_CYCLE_MS);
    expect(RING_CYCLE_MS).toBe(3000);
  });

  it("rings a table order louder than a gel-al", () => {
    const table = toOrderAlert(row());
    const pickup = toOrderAlert(row({ fulfillment: "pickup", tableCode: "" }));
    expect(ringLevel([pickup, table])).toBe(1);
    expect(ringLevel([pickup])).toBe(0.8);
  });
});
