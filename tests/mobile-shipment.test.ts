import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { shapeOf, shipmentUpdateFrom } from "@/lib/mobile/geliver";
import { toMobileShipment } from "@/lib/mobile/order-mapper";

/**
 * Where a parcel is — the band that replaced the app's live-tracking map.
 *
 * The map drew a line that came from no feed: it promised a position the köşk
 * cannot offer, because it runs no couriers whose phones it can read and buys
 * carriage from cargo firms through Geliver. A carrier publishes milestones,
 * so the phone shows milestones (docs/API-MOBILE.md §3.1).
 *
 * Two things are pinned here. That the field is `null` for everything that is
 * not a cargo parcel already on its way — a cafe order, a pickup, a parcel
 * still on the bench — because the app reads absent as "not shipped" and an
 * over-eager object would draw a band about nothing. And that Geliver's
 * vocabulary is mapped exactly, including the spellings that are easy to get
 * wrong.
 */
function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 1,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    internalNote: "",
    status: "paid",
    items: [],
    subtotalMinor: 0,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 0,
    refunds: [],
    createdAt: "2026-09-20T10:00:00Z",
    fulfillment: "shipping",
    ...over,
  } as AdminOrder;
}

describe("toMobileShipment", () => {
  it("is null for everything that is not a cargo parcel", () => {
    expect(toMobileShipment(order({ fulfillment: "pickup" }))).toBeNull();
    expect(toMobileShipment(order({ fulfillment: "delivery" }))).toBeNull();
  });

  it("is null while the parcel is still in the köşk", () => {
    // Nothing has been handed to anyone: no tracking number, and the order is
    // still in the köşk's own machine. A band here would be a band about a
    // journey that has not started.
    expect(toMobileShipment(order({ status: "preparing" }))).toBeNull();
  });

  it("derives the milestone from the panel's shipping form until Geliver exists", () => {
    // The webhook column is empty on every row until the account is live, so
    // the shop owner's own carrier + tracking number is the only signal — and
    // it is enough for two of the three words.
    const shipped = toMobileShipment(
      order({ status: "shipped", carrier: "Sürat Kargo", trackingNumber: "1234567890123", shippedAt: "2026-09-21T08:00:00Z" }),
    );
    expect(shipped).toEqual({
      status: "shipped",
      carrier: "Sürat Kargo",
      trackingNumber: "1234567890123",
      trackingUrl: null,
      updatedAt: "2026-09-21T08:00:00Z",
    });

    expect(toMobileShipment(order({ status: "completed", trackingNumber: "1" }))?.status).toBe("delivered");
    // A tracking number without the status move still means it left.
    expect(toMobileShipment(order({ status: "paid", trackingNumber: "1" }))?.status).toBe("shipped");
  });

  it("lets the carrier's own word win over the köşk's", () => {
    // The two disagree routinely: a parcel is in_transit for two days while
    // the order sits at `shipped`. The carrier is the authority on the parcel.
    const moving = toMobileShipment(
      order({ status: "shipped", trackingNumber: "1", shipmentStatus: "in_transit" }),
    );
    expect(moving?.status).toBe("in_transit");
  });

  it("publishes only a whole https tracking page", () => {
    const bad = toMobileShipment(order({ status: "shipped", trackingNumber: "1", trackingUrl: "kargo.example/t/1" }));
    expect(bad?.trackingUrl).toBeNull();
    const good = toMobileShipment(order({ status: "shipped", trackingNumber: "1", trackingUrl: "https://kargo.example/t/1" }));
    expect(good?.trackingUrl).toBe("https://kargo.example/t/1");
  });
});

describe("shipmentUpdateFrom", () => {
  it("collapses every pre-hand-over step to 'preparing'", () => {
    // "Teklif kabul edildi" and "Etiket basıldı" are the köşk's paperwork.
    // A member reading them learns nothing they can act on.
    for (const status of ["CREATED", "GOT_OFFERS", "OFFER_ACCEPTED", "TRACKING_CODE_CREATED", "LABEL_PRINTED"]) {
      expect(shipmentUpdateFrom({ status, trackingNumber: "1" })?.status).toBe("preparing");
    }
  });

  it("maps the three endings, including the single-L spelling on the wire", () => {
    expect(shipmentUpdateFrom({ status: "SHIPPED", trackingNumber: "1" })?.status).toBe("shipped");
    expect(shipmentUpdateFrom({ status: "DELIVERED", trackingNumber: "1" })?.status).toBe("delivered");
    expect(shipmentUpdateFrom({ status: "RETURNED", trackingNumber: "1" })?.status).toBe("returned");
    expect(shipmentUpdateFrom({ status: "RETURN_SHIPPED", trackingNumber: "1" })?.status).toBe("returned");
    expect(shipmentUpdateFrom({ status: "FAILED", trackingNumber: "1" })?.status).toBe("failed");
    // Geliver spells it with ONE l. The British spelling here would silently
    // drop every cancellation on the floor.
    expect(shipmentUpdateFrom({ status: "CANCELED", trackingNumber: "1" })?.status).toBe("failed");
    expect(shipmentUpdateFrom({ status: "CANCELLED", trackingNumber: "1" })).toBeNull();
  });

  it("reads a movement report as 'Yolda'", () => {
    const moving = shipmentUpdateFrom({
      event: "TRACK_UPDATED",
      status: "SHIPPED",
      trackingStatusCode: "IN_TRANSIT",
      trackingNumber: "1",
    });
    expect(moving?.status).toBe("in_transit");

    // A delivery scan is a delivery, not movement.
    expect(
      shipmentUpdateFrom({ event: "TRACK_UPDATED", status: "DELIVERED", trackingStatusCode: "DELIVERED", trackingNumber: "1" })
        ?.status,
    ).toBe("delivered");

    // And a tracking event arriving while it is still paperwork does not jump
    // the queue into "Yolda".
    expect(
      shipmentUpdateFrom({ event: "TRACK_UPDATED", status: "LABEL_PRINTED", trackingStatusCode: "SCANNED", trackingNumber: "1" })
        ?.status,
    ).toBe("preparing");
  });

  it("reads the fields out of an envelope too", () => {
    // The status vocabulary is documented; the envelope is not. A panel is
    // free to wrap the payload, and getting that wrong is the quietest
    // failure there is — 200, nothing written, "hazırlanıyor" forever.
    expect(
      shipmentUpdateFrom({ event: "TRACK_UPDATED", data: { status: "SHIPPED", trackingNumber: "1" } })?.status,
    ).toBe("shipped");
    expect(
      shipmentUpdateFrom({ payload: { status: "DELIVERED", trackingCode: "1" } })?.status,
    ).toBe("delivered");
    // Turkish carrier integrations name a tracking number four ways.
    for (const key of ["trackingNumber", "trackingCode", "trackingBarcode", "barcode"]) {
      expect(shipmentUpdateFrom({ status: "SHIPPED", [key]: "999" })?.trackingNumber).toBe("999");
    }
  });

  it("names the fields it saw when it cannot map, and never their values", () => {
    const fields = shapeOf({ foo: "gizli-numara", data: { bar: "gizli" } });
    expect(fields).toContain("foo");
    expect(fields).toContain("bar");
    expect(fields).not.toContain("gizli");
  });

  it("drops what it cannot act on instead of throwing", () => {
    // A webhook that 500s gets retried, so an event this build does not
    // understand would be retried forever. No tracking number means no way to
    // find the order — that is the only identifier the two systems share.
    expect(shipmentUpdateFrom({ status: "SHIPPED" })).toBeNull();
    expect(shipmentUpdateFrom({ status: "TELEPORTED", trackingNumber: "1" })).toBeNull();
    expect(shipmentUpdateFrom({})).toBeNull();
  });
});
