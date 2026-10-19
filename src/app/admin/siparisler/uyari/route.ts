import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_NAME,
  getAdminSession,
  isAdminSessionUnavailable,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";
import {
  busyAt,
  cachedBusyWindow,
  readChangeMarker,
} from "@/lib/admin/change-marker";
import {
  ORDER_ALERT_LIMIT,
  buildOrderAlerts,
  formatOrderAlertCursor,
  mayAnswerUnchanged,
  newestAlertPaidAt,
  orderAlertPollAfterMs,
  orderAlertsSince,
  parseOrderAlertCursor,
  stillRinging,
} from "@/lib/admin/order-alerts-core";
import { sessionBinding } from "@/lib/admin/poll-binding";
import { canAccess } from "@/lib/admin/roles";
import { getSettings, listOrderAlertRows } from "@/lib/admin/store";
import { getVenueStatus } from "@/lib/mobile/venue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * `GET /admin/siparisler/uyari` - the paid cafe orders the panel's new-order
 * alert rings for (order-alerts-core.ts), newest first, at most twenty.
 *
 * Every open panel tab's leader asks every ten seconds, from a Worker, so
 * the answer carries only what the counter needs to start: the order id and
 * number, "Masa 4" / "Gel-al", the item names with quantities, the total and
 * when it was paid. No customer name, e-mail, phone or address.
 *
 * Two answers:
 *
 * - `?c=<cursor>` with a cursor handed to this same session cookie
 *   (poll-binding.ts) whose change marker is still current gets
 *   `{ now, unchanged: true, cursor, pollAfterMs }`: no orders, no database.
 *   The marker (change-marker.ts) moves on every write to `orders` and on
 *   every write to the panel accounts, so "still current" also means this
 *   session's account has not changed since the full answer that re-read it
 *   (rule 30): a user deactivated, demoted or given a new password is
 *   re-read, and refused, on the next poll. It needs a validly signed
 *   session cookie of a role with Siparişler; while the köşk is busy at
 *   least one answer an hour is a full one anyway (`mayAnswerUnchanged`).
 * - Everything else, the full answer, as before: the session and the orders
 *   section are checked here, on every request (a route handler is not
 *   behind `requireRole`, and `proxy.ts` only redirects page views): 401
 *   without a session (the poller stops), 403 for a role without Siparişler
 *   (a cashier), 503 when the account or the orders could not be read (the
 *   poller keeps asking). It adds the cursor for the next ask, made from the
 *   marker read BEFORE the account and the orders, so a write to either in
 *   between moves it.
 */
export async function GET(request: Request) {
  const now = Date.now();

  // The cheap check first: the cookie's signature, no database.
  let signed;
  let bound = "";
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE_NAME)?.value;
    signed = readSessionFromCookieValue(token);
    bound = sessionBinding(token);
  } catch {
    signed = null;
  }
  if (!signed) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  // Before the account and the orders: a write to either that lands after
  // this read moves the marker, so the next ask reads again and sees it. A
  // token without Siparişler could never use a cursor: it gets none.
  let marker: string | null = null;
  if (canAccess("orders", signed.role)) {
    marker = await readChangeMarker("orders");
    const rawCursor = new URL(request.url).searchParams.get("c");
    const cursor = parseOrderAlertCursor(rawCursor);
    if (marker !== null && cursor && rawCursor) {
      const busy = await cachedBusyWindow(now);
      if (
        mayAnswerUnchanged({ cursor, marker, session: bound, nowMs: now, busy })
      ) {
        return Response.json(
          {
            now: new Date(now).toISOString(),
            unchanged: true,
            cursor: rawCursor,
            pollAfterMs: orderAlertPollAfterMs({
              busy,
              hasAlerts: stillRinging(cursor.newestPaidAt, now),
            }),
          },
          { status: 200, headers: NO_STORE },
        );
      }
    }
  }

  let session;
  try {
    session = await getAdminSession();
  } catch (err) {
    if (!isAdminSessionUnavailable(err)) throw err;
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!session) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (!canAccess("orders", session.role)) {
    return Response.json(
      { error: "forbidden" },
      { status: 403, headers: NO_STORE },
    );
  }

  try {
    const rows = await listOrderAlertRows(
      orderAlertsSince(now),
      ORDER_ALERT_LIMIT,
    );
    const alerts = buildOrderAlerts(rows, now);
    return Response.json(
      {
        now: new Date(now).toISOString(),
        alerts,
        pollAfterMs: orderAlertPollAfterMs({
          busy: await busyWindow(now),
          hasAlerts: alerts.length > 0,
        }),
        ...(marker
          ? {
              cursor: formatOrderAlertCursor({
                marker,
                fullAt: now,
                newestPaidAt: newestAlertPaidAt(alerts),
                session: bound,
              }),
            }
          : {}),
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    // A background poll: the panel keeps working, the next ask may answer.
    console.error("[admin/siparisler/uyari] siparişler okunamadı", err);
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}

/**
 * Is the köşk open now, within the next hour, or was it open half an hour
 * ago? The staff override (Canlı durum) first, the posted hours otherwise,
 * read live on the full answer. A read that fails answers "busy": a missed
 * sleep costs compute, a missed order costs a guest.
 */
async function busyWindow(now: number): Promise<boolean> {
  try {
    const [settings, venue] = await Promise.all([
      getSettings(),
      getVenueStatus(),
    ]);
    return busyAt(settings.weeklyHours, venue.manualOverride, now);
  } catch {
    return true;
  }
}
