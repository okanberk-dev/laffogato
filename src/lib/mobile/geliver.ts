import type { MobileShipmentStatus } from "./order-mapper";

/**
 * Geliver → the contract's six milestones.
 *
 * Geliver is the shipping marketplace the köşk buys carriage through: it sits
 * in front of the Turkish cargo firms and publishes one status vocabulary for
 * all of them, which is the whole reason the app can show the same three words
 * whichever firm carries the parcel.
 *
 * The left-hand values are Geliver's own `statusFilter` set, taken verbatim
 * from its official SDKs:
 *
 *   CREATED · GOT_OFFERS · OFFER_ACCEPTED · TRACKING_CODE_CREATED ·
 *   LABEL_PRINTED · SHIPPED · DELIVERED · CANCELED · RETURNED ·
 *   RETURN_SHIPPED · FAILED
 *
 * Note the single "L" in `CANCELED` — it is spelled that way on the wire, and
 * writing the British spelling here would silently drop every cancellation.
 *
 * Everything before the hand-over collapses to `preparing`: an offer being
 * accepted or a label being printed is the köşk's paperwork, not a position,
 * and a member reading "Etiket basıldı" learns nothing they can act on.
 *
 * `in_transit` has no Geliver status of its own — the carrier reports movement
 * through `TRACK_UPDATED` with a `trackingStatusCode` that is not a delivery.
 * `statusFromEvent` below is where that is decided.
 */
const STATUS_MAP: Readonly<Record<string, MobileShipmentStatus>> = {
  CREATED: "preparing",
  GOT_OFFERS: "preparing",
  OFFER_ACCEPTED: "preparing",
  TRACKING_CODE_CREATED: "preparing",
  LABEL_PRINTED: "preparing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  RETURNED: "returned",
  RETURN_SHIPPED: "returned",
  CANCELED: "failed",
  FAILED: "failed",
};

/** What Geliver's webhook body carries that this side reads. */
export interface GeliverEvent {
  /** `TRACK_UPDATED` is the only event documented; anything else is ignored. */
  event?: unknown;
  status?: unknown;
  trackingStatusCode?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
  updatedAt?: unknown;
}

export interface ShipmentUpdate {
  trackingNumber: string;
  status: MobileShipmentStatus;
  trackingUrl: string;
  updatedAt: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * One webhook body → one row update, or `null` when there is nothing to write.
 *
 * `null` rather than a throw: a webhook that 500s gets retried, and an event
 * this build does not understand would then be retried forever. The caller
 * answers 200 and moves on, which is what a webhook receiver owes a sender it
 * cannot argue with.
 *
 * Without a tracking number there is no way to find the order — that is the
 * only identifier the two systems share — so those are dropped too.
 */
export function shipmentUpdateFrom(body: GeliverEvent): ShipmentUpdate | null {
  const trackingNumber = text(body.trackingNumber);
  if (!trackingNumber) return null;

  const mapped = STATUS_MAP[text(body.status).toUpperCase()];
  const tracking = text(body.trackingStatusCode).toUpperCase();

  // A movement report that is not a delivery IS the "Yolda" step. It only
  // counts once the parcel has actually been handed over, so a tracking event
  // arriving while the status is still paperwork does not jump the queue.
  const moving =
    text(body.event).toUpperCase() === "TRACK_UPDATED" &&
    tracking !== "" &&
    tracking !== "DELIVERED" &&
    (mapped === undefined || mapped === "shipped");

  const status = moving ? "in_transit" : mapped;
  if (!status) return null;

  const url = text(body.trackingUrl);
  return {
    trackingNumber,
    status,
    // Whole or not at all, https only: this value reaches a phone, which opens
    // it in the system browser (docs/API-MOBILE.md §3.1).
    trackingUrl: url.startsWith("https://") ? url : "",
    updatedAt: text(body.updatedAt) || new Date().toISOString(),
  };
}
