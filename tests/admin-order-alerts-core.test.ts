import { describe, expect, it } from "vitest";

import {
  ORDER_ALERT_FULL_REFRESH_MS,
  ORDER_ALERT_MARKER_SETTLE_MS,
  formatOrderAlertCursor,
  isChangeMarker,
  markerMadeAt,
  mayAnswerUnchanged,
  newestAlertPaidAt,
  parseOrderAlertCursor,
  parseUnchangedPayload,
  stillRinging,
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
  orderAlertTime,
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
    expect(
      ringsForOrder(row({ fulfillment: "pickup", tableCode: "" }), NOW),
    ).toBe(true);
    expect(
      ringsForOrder(row({ fulfillment: "delivery", tableCode: "" }), NOW),
    ).toBe(true);
    // Paid a few seconds "in the future" by another host's clock still rings.
    expect(
      ringsForOrder(row({ paidAt: new Date(NOW + 30_000).toISOString() }), NOW),
    ).toBe(true);
  });

  it("an order moved on, unpaid or cancelled does not", () => {
    for (const status of [
      "pending_payment",
      "preparing",
      "shipped",
      "completed",
      "cancelled",
      "refunded",
    ]) {
      expect(ringsForOrder(row({ status }), NOW), status).toBe(false);
    }
  });

  it("a shop parcel never rings, nor an order with no kind (an old row is a shop order)", () => {
    expect(
      ringsForOrder(row({ kind: "shop", fulfillment: "shipping" }), NOW),
    ).toBe(false);
    expect(ringsForOrder(row({ kind: undefined }), NOW)).toBe(false);
  });

  it("an order typed into the panel never rings: whoever typed it is at the counter", () => {
    expect(ringsForOrder(row({ source: "manual" }), NOW)).toBe(false);
  });

  it("an order paid more than four hours ago, or with no paidAt, does not", () => {
    expect(ringsForOrder(row({ paidAt: minutesAgo(4 * 60 - 1) }), NOW)).toBe(
      true,
    );
    expect(ringsForOrder(row({ paidAt: minutesAgo(4 * 60 + 1) }), NOW)).toBe(
      false,
    );
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
    expect(orderAlertLabel(row({ fulfillment: "pickup", tableCode: "" }))).toBe(
      "Gel-al",
    );
    expect(
      orderAlertLabel(row({ fulfillment: "delivery", tableCode: "" })),
    ).toBe("Kurye");
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
    const courier = toOrderAlert(
      row({ fulfillment: "delivery", tableCode: "" }),
    );
    expect(notificationTitle(courier)).toBe("Yeni kafe siparişi · Kurye");
  });

  it("puts table orders first on the screen, each group newest first", () => {
    const a = toOrderAlert(
      row({
        id: "pick-new",
        fulfillment: "pickup",
        tableCode: "",
        paidAt: minutesAgo(1),
      }),
    );
    const b = toOrderAlert(row({ id: "table-old", paidAt: minutesAgo(9) }));
    const c = toOrderAlert(row({ id: "table-new", paidAt: minutesAgo(3) }));
    expect(alertDisplayOrder([a, b, c]).map((x) => x.id)).toEqual([
      "table-new",
      "table-old",
      "pick-new",
    ]);
  });

  it("tells the time on the köşk's clock, not the server's UTC", () => {
    // 18:00 UTC is 21:00 in Istanbul (UTC+3, rule 22).
    expect(orderAlertTime("2026-10-18T18:00:00.000Z")).toBe("21:00");
    expect(orderAlertTime("2026-10-18T21:30:00.000Z")).toBe("00:30");
    expect(orderAlertTime("")).toBe("");
  });

  it("prefixes the tab title with the count and gives it back at zero", () => {
    expect(titleWithAlerts("Admin · Siparişler", 2)).toBe(
      "(2) Yeni sipariş · Admin · Siparişler",
    );
    expect(titleWithAlerts("(2) Yeni sipariş · Admin · Siparişler", 3)).toBe(
      "(3) Yeni sipariş · Admin · Siparişler",
    );
    expect(titleWithAlerts("(3) Yeni sipariş · Admin · Siparişler", 0)).toBe(
      "Admin · Siparişler",
    );
    expect(stripAlertTitle("Admin · Kasa")).toBe("Admin · Kasa");
  });

  it("says the notification permission in plain Turkish, with the way out when it is blocked", () => {
    expect(notificationPermissionText("granted")).toBe(
      "Masaüstü bildirimleri açık.",
    );
    expect(notificationPermissionText("default")).toBe(
      "Masaüstü bildirimleri kapalı.",
    );
    const denied = notificationPermissionText("denied");
    // Chrome 117 replaced the padlock there with a site settings icon.
    expect(denied).toContain("solundaki site ayarları simgesinden");
    expect(denied).not.toContain("kilit");
    expect(denied).toContain("Sistem Ayarları > Bildirimler > Google Chrome");
    expect(notificationPermissionText("unsupported")).toContain("göstermiyor");
  });
});

describe("Gördüm, shared by the tabs", () => {
  it("remembers an acknowledgement for a day, then forgets it", () => {
    const acks = addAck({}, "ord-1", NOW - ORDER_ALERT_ACK_TTL_MS - 1);
    const fresh = addAck(acks, "ord-2", NOW);
    expect(Object.keys(fresh)).toEqual(["ord-2"]);
    expect(
      parseAcks(
        JSON.stringify({
          "ord-1": NOW - 1000,
          "ord-9": NOW - 2 * ORDER_ALERT_ACK_TTL_MS,
        }),
        NOW,
      ),
    ).toEqual({ "ord-1": NOW - 1000 });
  });

  it("reads junk as nothing acknowledged", () => {
    for (const raw of [
      null,
      "",
      "{",
      "[1,2]",
      "42",
      JSON.stringify({ x: "y" }),
    ]) {
      expect(parseAcks(raw, NOW), String(raw)).toEqual({});
    }
  });

  it("keeps acknowledged orders off the pending list", () => {
    const alerts = [
      toOrderAlert(row({ id: "a" })),
      toOrderAlert(row({ id: "b" })),
    ];
    expect(pendingAlerts(alerts, { a: NOW }).map((x) => x.id)).toEqual(["b"]);
  });
});

describe("the route's answer as the browser reads it", () => {
  it("keeps well-formed alerts and drops the rest", () => {
    const good = toOrderAlert(row());
    const parsed = parseOrderAlertPayload({
      now: "x",
      alerts: [good, { id: 3 }, null, "x"],
    });
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
    expect(notes.map((n) => n.freq)).toEqual([
      1046.5, 1318.5, 1568, 1046.5, 1318.5, 1568,
    ]);
    expect(notes.every((n) => n.peak > 0 && n.peak <= 0.5)).toBe(true);
    expect(notes.map((n) => n.decay)).toEqual([
      0.32, 0.32, 0.6, 0.32, 0.32, 0.6,
    ]);
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

describe("poll pacing", () => {
  it("is fast when busy or an order waits, hourly otherwise", async () => {
    const {
      orderAlertPollAfterMs,
      ORDER_ALERT_POLL_MS,
      ORDER_ALERT_IDLE_POLL_MS,
    } = await import("@/lib/admin/order-alerts-core");
    expect(orderAlertPollAfterMs({ busy: true, hasAlerts: false })).toBe(
      ORDER_ALERT_POLL_MS,
    );
    expect(orderAlertPollAfterMs({ busy: false, hasAlerts: true })).toBe(
      ORDER_ALERT_POLL_MS,
    );
    expect(orderAlertPollAfterMs({ busy: false, hasAlerts: false })).toBe(
      ORDER_ALERT_IDLE_POLL_MS,
    );
  });

  it("nextPollDelay takes a sane server value and clamps the rest", async () => {
    const { nextPollDelay } = await import("@/lib/admin/order-alerts-core");
    expect(nextPollDelay({ pollAfterMs: 3_600_000 }, 10_000)).toBe(3_600_000);
    expect(nextPollDelay({ pollAfterMs: 100 }, 10_000)).toBe(5_000);
    expect(nextPollDelay({ pollAfterMs: 99_999_999 }, 10_000)).toBe(7_200_000);
    expect(nextPollDelay({ pollAfterMs: "x" }, 10_000)).toBe(10_000);
    expect(nextPollDelay(null, 10_000)).toBe(10_000);
  });
});

describe('the cursor: answering "nothing changed" without the database', () => {
  /** A marker made at `at`, as change-marker.ts makes them. */
  const markerAt = (at: number) => `${at.toString(36)}-k3j9x0q2`;
  const MADE = NOW - 30 * 60_000;
  const MARKER = markerAt(MADE);
  /** This request's session, as poll-binding.ts makes it. */
  const SESSION = "0123456789ab";
  const cursor = (
    over: Partial<{ fullAt: number; newestPaidAt: number }> = {},
  ) => ({
    marker: MARKER,
    fullAt: MADE + 60_000,
    newestPaidAt: 0,
    session: SESSION,
    ...over,
  });

  it("round-trips, and refuses junk, old shapes and oversized input", () => {
    const c = cursor({ newestPaidAt: NOW - 60_000 });
    const raw = formatOrderAlertCursor(c);
    expect(raw).toMatch(/^a2\./);
    expect(parseOrderAlertCursor(raw)).toEqual(c);
    for (const junk of [
      null,
      undefined,
      "",
      "a2",
      "a3." + raw.slice(3),
      raw + ".x",
      // The shape from before the session binding.
      `a1.${MARKER}.${(MADE + 60_000).toString(36)}.0`,
      `a2.${MARKER}.1.0`,
      `a2.${MARKER}.1.0.0123456789AB`,
      `a2.${MARKER}.1.0.0123456789a`,
      "a2.no marker.1.0." + SESSION,
      "a2.ABC-def.1.0." + SESSION,
      `a2.${MARKER}.${"z".repeat(13)}.0.${SESSION}`,
      raw + "0".repeat(100),
      "<script>",
    ]) {
      expect(
        parseOrderAlertCursor(junk as string | null),
        String(junk),
      ).toBeNull();
    }
    // Nothing a bad marker or session would make: no cursor at all.
    expect(formatOrderAlertCursor({ ...c, session: "" })).toBe("");
    expect(formatOrderAlertCursor({ ...c, marker: "nope" })).toBe("");
  });

  it("the longest cursor it accepts still fits what the poller keeps (80)", () => {
    const z = (n: number) => "z".repeat(n);
    const longest = `a2.${z(12)}-${z(24)}.${z(12)}.${z(12)}.${SESSION}`;
    expect(parseOrderAlertCursor(longest)).not.toBeNull();
    expect(longest.length).toBeLessThanOrEqual(80);
  });

  it("answers unchanged only for the session the cursor was handed to", () => {
    const base = { cursor: cursor(), marker: MARKER, nowMs: NOW, busy: false };
    expect(mayAnswerUnchanged({ ...base, session: SESSION })).toBe(true);
    expect(mayAnswerUnchanged({ ...base, session: "ba9876543210" })).toBe(
      false,
    );
    expect(mayAnswerUnchanged({ ...base, session: "" })).toBe(false);
  });

  it("reads when a marker was made", () => {
    expect(isChangeMarker(MARKER)).toBe(true);
    expect(markerMadeAt(MARKER)).toBe(MADE);
    expect(isChangeMarker("nope")).toBe(false);
    expect(markerMadeAt("nope")).toBeNull();
  });

  it("the same marker while the köşk is idle answers unchanged, however old the last full answer", () => {
    expect(
      mayAnswerUnchanged({
        cursor: cursor({ fullAt: MADE + 60_000 }),
        marker: MARKER,
        session: SESSION,
        nowMs: NOW + 10 * 60 * 60_000,
        busy: false,
      }),
    ).toBe(true);
  });

  it("while busy, a full answer at least every hour", () => {
    // A marker from before the oldest full answer below.
    const older = markerAt(NOW - 3 * ORDER_ALERT_FULL_REFRESH_MS);
    const at = (age: number) =>
      mayAnswerUnchanged({
        cursor: { ...cursor({ fullAt: NOW - age }), marker: older },
        marker: older,
        session: SESSION,
        nowMs: NOW,
        busy: true,
      });
    expect(at(59 * 60_000)).toBe(true);
    expect(at(ORDER_ALERT_FULL_REFRESH_MS)).toBe(false);
    expect(at(2 * ORDER_ALERT_FULL_REFRESH_MS)).toBe(false);
  });

  it("a moved, missing or unreadable marker answers no", () => {
    const base = {
      cursor: cursor(),
      session: SESSION,
      nowMs: NOW,
      busy: false,
    };
    expect(mayAnswerUnchanged({ ...base, marker: markerAt(NOW - 1000) })).toBe(
      false,
    );
    expect(mayAnswerUnchanged({ ...base, marker: null })).toBe(false);
    expect(mayAnswerUnchanged({ ...base, cursor: null, marker: MARKER })).toBe(
      false,
    );
  });

  it("a full answer from the future answers no", () => {
    expect(
      mayAnswerUnchanged({
        cursor: cursor({ fullAt: NOW + 1000 }),
        marker: MARKER,
        session: SESSION,
        nowMs: NOW,
        busy: false,
      }),
    ).toBe(false);
  });

  it("a full answer read right after the marker was made does not vouch for it", () => {
    // The cache keeps the time it STORED the marker; a write in between
    // could have been missed. The next ask reads again.
    const at = (gap: number) =>
      mayAnswerUnchanged({
        cursor: cursor({ fullAt: MADE + gap }),
        marker: MARKER,
        session: SESSION,
        nowMs: NOW,
        busy: false,
      });
    expect(at(0)).toBe(false);
    expect(at(ORDER_ALERT_MARKER_SETTLE_MS - 1)).toBe(false);
    expect(at(ORDER_ALERT_MARKER_SETTLE_MS)).toBe(true);
  });

  it("stillRinging uses the ring window and skew of ringsForOrder", () => {
    for (const minutes of [-6, -4, 0, 30, 239, 241]) {
      const paidAt = NOW - minutes * 60_000;
      const row: OrderAlertRow = {
        id: "o",
        orderNo: 1,
        status: "paid",
        kind: "cafe",
        fulfillment: "pickup",
        paidAt: new Date(paidAt).toISOString(),
        totalMinor: 0,
      };
      expect(stillRinging(paidAt, NOW), String(minutes)).toBe(
        ringsForOrder(row, NOW),
      );
    }
    expect(stillRinging(0, NOW)).toBe(false);
    expect(stillRinging(Number.NaN, NOW)).toBe(false);
  });

  it("newestAlertPaidAt is the newest alert, 0 for none", () => {
    const a = toOrderAlert({
      id: "a",
      orderNo: 1,
      status: "paid",
      paidAt: minutesAgo(30),
      totalMinor: 0,
    });
    const b = { ...a, id: "b", paidAt: minutesAgo(5) };
    expect(newestAlertPaidAt([a, b])).toBe(NOW - 5 * 60_000);
    expect(newestAlertPaidAt([])).toBe(0);
  });

  it("reads the unchanged answer, and nothing else as one", () => {
    expect(
      parseUnchangedPayload({
        now: "2026-10-18T18:00:00.000Z",
        unchanged: true,
      }),
    ).toEqual({ now: "2026-10-18T18:00:00.000Z" });
    expect(parseUnchangedPayload({ unchanged: true })).toEqual({ now: "" });
    expect(parseUnchangedPayload({ alerts: [] })).toBeNull();
    expect(parseUnchangedPayload({ unchanged: 1 })).toBeNull();
    expect(parseUnchangedPayload(null)).toBeNull();
  });
});
