import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { setOrderShipmentStatus } from "@/lib/admin/store";
import {
  shapeOf,
  shipmentUpdateFrom,
  type GeliverEvent,
} from "@/lib/mobile/geliver";

/**
 * Geliver's `TRACK_UPDATED` webhook — where a parcel actually is.
 *
 * The app retired its live-tracking map: the köşk runs no couriers whose
 * phones it can read, it buys carriage from cargo firms through Geliver, and
 * what a carrier publishes is a handful of milestones. This route is where
 * those milestones arrive (docs/API-MOBILE.md §3.1).
 *
 * **It is inert until `GELIVER_WEBHOOK_SECRET` is set**, and that is the
 * correct state until the account exists: an unset secret answers 503, never
 * 200, so nobody can write shipment rows by guessing the URL. Until then the
 * app still shows the band — the mapper derives "Yola çıktı" and "Teslim
 * edildi" from the panel's own shipping form.
 *
 * Every other outcome is 200 on purpose. A webhook sender retries anything
 * that is not a success, so an event for a parcel this shop never sent, or an
 * event shape this build does not understand, must be ACCEPTED and dropped
 * rather than bounced into a retry loop forever. The body says which happened.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function authorized(request: Request): boolean | "unset" {
  const secret = process.env.GELIVER_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return "unset";
  // Geliver's panel sets a static header on the webhook; both spellings are
  // accepted because which one it sends is a panel setting, not a contract.
  const given =
    request.headers.get("x-geliver-signature")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (auth === "unset") {
    return NextResponse.json(
      { error: "geliver_secret_unset" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!auth) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: GeliverEvent;
  try {
    body = (await request.json()) as GeliverEvent;
  } catch {
    return NextResponse.json(
      { ok: true, ignored: "unparseable" },
      { status: 200, headers: NO_STORE },
    );
  }

  const update = shipmentUpdateFrom(body);
  if (!update) {
    // The quietest possible failure is a body whose SHAPE we did not expect:
    // the route answers 200, nothing is written, and the phone shows
    // "hazırlanıyor" forever. The field NAMES are logged so it is diagnosable
    // — never a value, because this body carries a tracking number and a
    // tracking number identifies a parcel and therefore a person.
    console.warn(`[webhooks/geliver] eşlenemedi — alanlar: ${shapeOf(body)}`);
    return NextResponse.json(
      { ok: true, ignored: "unmapped", fields: shapeOf(body) },
      { status: 200, headers: NO_STORE },
    );
  }

  const order = await setOrderShipmentStatus(
    update.trackingNumber,
    update.status,
    update.trackingUrl,
    update.updatedAt,
  );

  // No order with that tracking number is somebody else's parcel, not a fault.
  // The order NUMBER is echoed rather than the id, and never the customer.
  return NextResponse.json(
    order
      ? { ok: true, orderNo: order.orderNo, status: update.status }
      : { ok: true, ignored: "unknown_tracking_number" },
    { status: 200, headers: NO_STORE },
  );
}
