import type { MobileShipmentStatus } from "./order-mapper";

/**
 * Geliver → the contract's six milestones.
 *
 * Geliver is the shipping marketplace the köşk buys carriage through: it sits
 * in front of the Turkish cargo firms and publishes one status vocabulary for
 * all of them, which is the whole reason the app can show the same three words
 * whichever firm carries the parcel.
 *
 * Everything below is read off the official SDK, `@geliver/sdk` 1.3.0
 * (github.com/GeliverApp/geliver-js), not guessed:
 *
 *   models/index.ts   WebhookUpdateTrackingRequest { event, metadata?, data: Shipment }
 *                     Shipment { statusCode, trackingNumber, trackingUrl, updatedAt,
 *                                barcode, providerCode, trackingStatus: Tracking, … }
 *                     Tracking { trackingStatusCode, trackingSubStatusCode, statusDate,
 *                                statusDetails, updatedAt, test?: boolean, … }
 *   webhooks.ts       verifyWebhookSignature() is a STUB: returns true while
 *                     disabled, false when enabled — "Future: compute
 *                     HMAC(secret, timestamp + '.' + body)". The reserved
 *                     headers are `x-signature` and `x-timestamp`. So Geliver
 *                     does not sign webhooks today; the route authenticates
 *                     with the static header the panel lets you attach.
 *
 * The left-hand values are Geliver's `statusFilter` set, verbatim:
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
 * through `TRACK_UPDATED` with a `trackingStatus.trackingStatusCode` that is
 * not a delivery. `shipmentUpdateFrom` is where that is decided.
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
 * Geliver's webhook body — the documented shape first, then leniently.
 *
 * The documented shape is `{ event, data: Shipment }`. It is read exactly.
 * But a webhook panel is free to change its envelope between releases, and
 * Turkish carrier integrations name a tracking number four different ways —
 * and getting the envelope wrong here is the quietest possible failure: the
 * route answers 200, nothing is written, and the phone shows "hazırlanıyor"
 * forever. So after the documented shape, the body itself and one level of
 * envelope are tried with the common aliases. Still strict about the thing
 * that MATTERS: an unmapped status writes nothing.
 */
export type GeliverEvent = Record<string, unknown>;

/** Envelope keys worth looking inside, documented one first. */
const ENVELOPES = ["data", "payload", "shipment", "result", "body"] as const;

/** Field aliases, documented name first. */
const FIELDS = {
  event: ["event", "eventType", "type"],
  status: ["statusCode", "status", "shipmentStatus"],
  tracking: ["trackingStatusCode", "trackingSubStatusCode", "trackingStatus"],
  number: ["trackingNumber", "trackingCode", "trackingBarcode", "barcode"],
  url: ["trackingUrl", "trackingLink", "url"],
  at: ["statusDate", "updatedAt", "statusUpdatedAt", "date", "createdAt"],
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

/**
 * `data.trackingStatus` is an OBJECT in the documented shape (`Tracking`),
 * with the code inside it. Older or flatter shapes carry the code as a string
 * under one of the same names. Both are read; the object wins when present.
 */
function trackingBlock(src: Record<string, unknown>): Record<string, unknown> | null {
  const t = src.trackingStatus;
  return isObject(t) ? t : null;
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
  /** The carrier's own instant when the body carried one; "" otherwise. */
  updatedAt: string;
  /**
   * Geliver's `Tracking.test` — the panel's "Test Et" delivery. A test event
   * must never move a real parcel, so the route answers it and writes nothing.
   */
  test: boolean;
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
  // `event` lives on the ENVELOPE (`{ event, data }`), the fields on the
  // payload; read it once from wherever it is rather than per candidate.
  const event = candidates(body)
    .map((c) => pick(c, FIELDS.event))
    .find(Boolean) ?? "";
  const isTrackUpdate = event.toUpperCase() === "TRACK_UPDATED";

  for (const src of candidates(body)) {
    const trackingNumber = pick(src, FIELDS.number);
    if (!trackingNumber) continue;

    const mapped = STATUS_MAP[pick(src, FIELDS.status).toUpperCase()];
    const block = trackingBlock(src);
    const tracking = (block ? pick(block, FIELDS.tracking) : pick(src, FIELDS.tracking)).toUpperCase();

    // A movement report that is not a delivery IS the "Yolda" step. It only
    // counts once the parcel has actually been handed over, so a tracking
    // event arriving while the status is still paperwork does not jump the
    // queue.
    const moving =
      isTrackUpdate &&
      tracking !== "" &&
      tracking !== "DELIVERED" &&
      (mapped === undefined || mapped === "shipped");

    const status = moving ? "in_transit" : mapped;
    if (!status) continue;

    const url = pick(src, FIELDS.url);
    const test = block?.test === true || src.test === true || body.test === true;
    return {
      trackingNumber,
      status,
      // Whole or not at all, https only: this value reaches a phone, which
      // opens it in the system browser (docs/API-MOBILE.md §3.1).
      trackingUrl: url.startsWith("https://") ? url : "",
      // The scan's own time first (`Tracking.statusDate`), then the row's.
      // No "now" fallback here: the store fills that in, and only it can
      // compare against what is already written.
      updatedAt: (block ? pick(block, FIELDS.at) : "") || pick(src, FIELDS.at),
      test,
    };
  }
  return null;
}

/**
 * Has the carrier taken the parcel? The moment the legal texts tie the
 * tracking-number mail to ("ürün taşıyıcıya teslim edildiğinde").
 *
 * `preparing` is not it: TRACKING_CODE_CREATED and LABEL_PRINTED mean a
 * number exists and a label is on the box, while the box is still on the
 * köşk's bench. `delivered` is not it either - a "your parcel is on its
 * way" mail after the parcel arrived would be news from the past - and the
 * returned and failed endings are the opposite of a hand-over.
 */
export function isHandedOver(status: string): boolean {
  return status === "shipped" || status === "in_transit";
}

/**
 * Is this event OLDER than what the row already holds?
 *
 * Webhooks are not delivered in order — a retried SHIPPED can arrive after
 * the DELIVERED that followed it — and writing the old one would move the
 * parcel backwards on the phone. Two real timestamps decide it. When either
 * side is missing or unparseable the answer is `false`: "cannot prove it is
 * old" must never become "silently dropped". Equal instants are not stale,
 * so an idempotent redelivery of the same event is harmless.
 */
export function isStaleShipmentEvent(existingAt: string, incomingAt: string): boolean {
  const a = Date.parse(existingAt);
  const b = Date.parse(incomingAt);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return b < a;
}
