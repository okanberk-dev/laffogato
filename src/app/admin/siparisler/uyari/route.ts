import { getAdminSession, isAdminSessionUnavailable } from "@/lib/admin/auth";
import {
  ORDER_ALERT_LIMIT,
  buildOrderAlerts,
  orderAlertsSince,
} from "@/lib/admin/order-alerts-core";
import { canAccess } from "@/lib/admin/roles";
import { listOrderAlertRows } from "@/lib/admin/store";

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
    return Response.json(
      { now: new Date(now).toISOString(), alerts: buildOrderAlerts(rows, now) },
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
