import { getAdminSession, isAdminSessionUnavailable } from "@/lib/admin/auth";
import {
  ORDER_ALERT_BUSY_OFFSETS_MIN,
  ORDER_ALERT_LIMIT,
  buildOrderAlerts,
  orderAlertPollAfterMs,
  orderAlertsSince,
} from "@/lib/admin/order-alerts-core";
import { canAccess } from "@/lib/admin/roles";
import { getSettings, listOrderAlertRows } from "@/lib/admin/store";
import { getVenueStatus, isCafeOpenNow } from "@/lib/mobile/venue";

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
 * A route handler is not behind `requireRole` (that redirects pages) and
 * `proxy.ts` only redirects page views, so the session and the orders
 * section are checked here, on every request: 401 without a session (the
 * poller stops), 403 for a role without Siparişler (a cashier), 503 when
 * the account or the orders could not be read (the poller keeps asking).
 */
export async function GET() {
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

  const now = Date.now();
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
 * ago? The staff override (Canlı durum) first, the posted hours otherwise.
 * A read that fails answers "busy": a missed sleep costs compute, a missed
 * order costs a guest.
 */
async function busyWindow(now: number): Promise<boolean> {
  try {
    const [settings, venue] = await Promise.all([
      getSettings(),
      getVenueStatus(),
    ]);
    return ORDER_ALERT_BUSY_OFFSETS_MIN.some((min) =>
      isCafeOpenNow(
        settings.weeklyHours,
        venue.manualOverride,
        new Date(now + min * 60_000),
      ),
    );
  } catch {
    return true;
  }
}
