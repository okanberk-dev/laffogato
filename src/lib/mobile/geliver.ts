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

/**
 * Geliver's webhook body — read leniently on purpose.
 *
 * The status vocabulary is documented and pinned (above). The ENVELOPE is not:
 * the field names below come from the official SDKs, but a webhook panel is
 * free to wrap them in `data`, `payload`, `shipment` or `result`, and Turkish
 * carrier integrations name a tracking number four different ways. Getting the
 * envelope wrong here is the quietest possible failure — the route answers
 * 200, nothing is written, and the phone shows "hazırlanıyor" forever.
 *
 * So the reader tries the body itself and one level of envelope, and accepts
 * the common aliases. It is still strict about the thing that MATTERS: an
 * unmapped status writes nothing.
 */
export type GeliverEvent = Record<string, unknown>;

/** Envelope keys worth looking inside, in the order they are tried. */
const ENVELOPES = ["data", "payload", "shipment", "result", "body"] as const;

/** Field aliases, longest-standing name first. */
const FIELDS = {
  event: ["event", "eventType", "type"],
  status: ["status", "statusCode", "shipmentStatus"],
  tracking: ["trackingStatusCode", "trackingStatus", "trackingSubStatusCode"],
  number: ["trackingNumber", "trackingCode", "trackingBarcode", "barcode"],
  url: ["trackingUrl", "trackingLink", "url"],
  at: ["updatedAt", "statusUpdatedAt", "date", "createdAt"],
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The body, then each envelope inside it. Never deeper: one level is a shape, two is a guess. */
function candidates(body: unknown): Record<string, unknown>[] {
  if (!isObject(body)) return [];
  const out = [body];
  for (const key of ENVELOPES) {
    if (isObject(body[key])) out.push(body[key]);
  }
  return out;
}

function pick(src: Record<string, unknown>, names: readonly string[]): string {
  for (const name of names) {
    const value = text(src[name]);
    if (value) return value;
  }
  return "";
}

/** Top-level field NAMES only — never a value. Used to make a shape mismatch diagnosable. */
export function shapeOf(body: unknown): string {
  return candidates(body)
    .flatMap((c) => Object.keys(c))
    .slice(0, 40)
    .join(",");
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
  for (const src of candidates(body)) {
    const trackingNumber = pick(src, FIELDS.number);
    if (!trackingNumber) continue;

    const mapped = STATUS_MAP[pick(src, FIELDS.status).toUpperCase()];
    const tracking = pick(src, FIELDS.tracking).toUpperCase();

    // A movement report that is not a delivery IS the "Yolda" step. It only
    // counts once the parcel has actually been handed over, so a tracking
    // event arriving while the status is still paperwork does not jump the
    // queue.
    const moving =
      pick(src, FIELDS.event).toUpperCase() === "TRACK_UPDATED" &&
      tracking !== "" &&
      tracking !== "DELIVERED" &&
      (mapped === undefined || mapped === "shipped");

    const status = moving ? "in_transit" : mapped;
    if (!status) continue;

    const url = pick(src, FIELDS.url);
    return {
      trackingNumber,
      status,
      // Whole or not at all, https only: this value reaches a phone, which
      // opens it in the system browser (docs/API-MOBILE.md §3.1).
      trackingUrl: url.startsWith("https://") ? url : "",
      updatedAt: pick(src, FIELDS.at) || new Date().toISOString(),
    };
  }
  return null;
}
