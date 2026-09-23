import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { setOrderShipmentStatus } from "@/lib/admin/store";
import {
  shapeOf,
  shipmentUpdateFrom,
  type GeliverEvent,
} from "@/lib/mobile/geliver";

/**
 * Geliver's `TRACK_UPDATED` webhook - where a parcel actually is.
 *
 * The app retired its live-tracking map: the köşk runs no couriers whose
 * phones it can read, it buys carriage from cargo firms through Geliver, and
 * what a carrier publishes is a handful of milestones. This route is where
 * those milestones arrive (docs/API-MOBILE.md §3.1; setup in docs/GELIVER.md).
 *
 * **Authentication is a static header, and that is all Geliver offers.** The
 * official SDK's `verifyWebhookSignature()` is a stub - it returns true while
 * disabled and false when enabled, with "Future: HMAC(secret, timestamp + '.'
 * + body)" in a comment and `x-signature` / `x-timestamp` reserved for it. So
 * there is no signature to check today. What the panel lets you attach is one
 * fixed header on every delivery; this route compares it, constant-time,
 * against `GELIVER_WEBHOOK_SECRET`. The body is read RAW below so the day
 * Geliver ships its HMAC the digest can be computed over exactly the bytes
 * that arrived, without touching the parsing path.
 *
 * **It is inert until `GELIVER_WEBHOOK_SECRET` is set**, and that is the
 * correct state until the account exists: an unset secret answers 503, never
 * 200, so nobody can write shipment rows by guessing the URL. Until then the
 * app still shows the band - the mapper derives "Yola çıktı" and "Teslim
 * edildi" from the panel's own shipping form.
 *
 * **Status codes, and why.** A webhook sender retries anything that is not a
 * success, so what the route answers is a message to the retry loop:
 *
 *   503  secret unset               - do not guess, come back when configured
 *   401  wrong or missing header    - not Geliver, or the panel value drifted
 *   400  empty / non-JSON / non-object body - a broken delivery; retrying the
 *        same bytes cannot help, and a 400 shows in the logs where a 200 hides
 *   200  everything Geliver sent correctly, including the cases where nothing
 *        was written - a shape this build cannot map, a number no order
 *        carries, an event older than the row, or a test delivery. The body
 *        says which. Bouncing these would retry them forever.
 *
 * The URL Geliver must call is the CANONICAL host, `https://laffogato.net/…`:
 * `www` answers with a 308, and a POST does not follow a redirect - it is
 * simply dropped, with no log on either side.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function authorized(request: Request): boolean | "unset" {
  const secret = process.env.GELIVER_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return "unset";
  // The panel's "Header Name / Header Value" pair. Both spellings are
  // accepted because which one the operator typed is a panel setting, not a
  // contract - and neither collides with Geliver's reserved `x-signature`.
  const given =
    request.headers.get("x-geliver-signature")?.trim() ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  // Authentication BEFORE the body is touched: an unauthenticated caller
  // learns nothing about what this route accepts, and a malformed body from
  // one is a 401, not a 400.
  const auth = authorized(request);
  if (auth === "unset") return json({ error: "geliver_secret_unset" }, 503);
  if (!auth) return json({ error: "unauthorized" }, 401);

  // Raw bytes first (see the docblock: the future HMAC is over these), then
  // parse. Each failure names itself so the Vercel log filter can tell them
  // apart without anyone reading a body.
  const raw = await request.text();
  if (!raw.trim()) return json({ error: "empty_body" }, 400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "invalid_body", expected: "object" }, 400);
  }

  const update = shipmentUpdateFrom(body as GeliverEvent);
  if (!update) {
    // The quietest possible failure is a body whose SHAPE we did not expect:
    // 200, nothing written, and the phone shows "hazırlanıyor" forever. The
    // field NAMES are logged and echoed so it is diagnosable - never a value,
    // because this body carries a tracking number and a tracking number
    // identifies a parcel and therefore a person.
    const fields = shapeOf(body);
    console.warn(`[webhooks/geliver] eşlenemedi — alanlar: ${fields}`);
    return json({ ok: true, ignored: "unmapped", fields }, 200);
  }

  // The panel's "Test Et" button (`Tracking.test === true`). It proves the
  // URL, the header and the parser end to end - and must never move a real
  // parcel, whatever tracking number it happens to carry.
  if (update.test) {
    return json({ ok: true, test: true, wouldApply: update.status, written: false }, 200);
  }

  const result = await setOrderShipmentStatus(
    update.trackingNumber,
    update.status,
    update.trackingUrl,
    update.updatedAt,
  );

  switch (result.outcome) {
    case "applied":
      return json({ ok: true, orderNo: result.order.orderNo, status: update.status }, 200);
    case "stale":
      // Logged with the ORDER number, which is not the tracking number and
      // identifies nothing outside this shop.
      console.warn(`[webhooks/geliver] eski olay atlandı — sipariş #${result.order.orderNo}`);
      return json({ ok: true, ignored: "stale", orderNo: result.order.orderNo }, 200);
    case "unknown":
      // No order with that number is somebody else's parcel, not a fault. The
      // number itself is never logged; its length is enough to spot a panel
      // typo (a 4-digit "number" is not a carrier's).
      console.warn(`[webhooks/geliver] bilinmeyen takip numarası (${update.trackingNumber.length} karakter)`);
      return json({ ok: true, ignored: "unknown_tracking_number" }, 200);
  }
}
