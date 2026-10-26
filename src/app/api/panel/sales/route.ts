import { NextResponse } from "next/server";

import {
  listPanelSalesBookingRows,
  listPanelSalesOrderRows,
} from "@/lib/admin/store";
import { couponSourcesForOrders } from "@/lib/customer/coupons";
import { dbInvoiceStore } from "@/lib/invoice/store";
import {
  panelSyncConfig,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
import {
  buildPanelSales,
  PANEL_SALES_MAX_ORDERS,
  panelSalesReadBounds,
  parsePanelSalesRange,
} from "@/lib/panel/sales-export-core";

/**
 * `GET /api/panel/sales?month=YYYY-MM` (or `?from=YYYY-MM-DD&to=YYYY-MM-DD`,
 * 31 days at most) - the köşk's panel (ladmin.laffogato.net) reading the
 * online sales of a period for its P&L and till report: café, shop and
 * karaoke money with its KDV, and the café lines by menu item and size;
 * orders settled at the till counted apart
 * (src/lib/panel/sales-export-core.ts, docs/PANEL-SALES.md).
 *
 * Server to server, no cookie: signed with the shared `KARAOKE_SYNC_SECRET`
 * like the karaoke route (CLAUDE.md rule 7). Unset secret: 503. Bad,
 * missing or stale signature: 401, nothing more said. A malformed or too
 * wide period: 400. Totals and lines only: no customer, no order number.
 *
 * A period with more orders than the export reads at once is refused (422)
 * rather than answered short: a P&L that silently lost orders is worse
 * than one the panel has to ask again by day.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  const config = panelSyncConfig(process.env);
  if (!config) return deny(503, "not_configured");
  const url = new URL(request.url);
  const signed = verifySignature(config.secret, {
    method: "GET",
    url,
    body: "",
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!signed) return deny(401, "unauthorized");
  const range = parsePanelSalesRange(url.searchParams);
  if (!range) return deny(400, "invalid_range");

  const now = new Date();
  const { since, until } = panelSalesReadBounds(range);
  try {
    const [orders, bookings] = await Promise.all([
      listPanelSalesOrderRows(since, until, PANEL_SALES_MAX_ORDERS + 1),
      listPanelSalesBookingRows(),
    ]);
    if (orders.length > PANEL_SALES_MAX_ORDERS) {
      return deny(422, "range_too_large");
    }
    // The coupon each order redeemed: a reward coupon pays for the goods,
    // so its KDV is the invoice's at full price (ASK-COUPON), as the order
    // CSV counts it. How each order was paid, read as the e-Arşiv plan
    // reads it: an app or web order settled at the till in cash or on the
    // counter's card terminal is the till's money (ModPOS; LafPOS after the
    // switch), counted apart (`counter`).
    // A failed read fails the export, never a wrong KDV or a till sale
    // counted online a second time.
    const [coupons, payments] = await Promise.all([
      couponSourcesForOrders(orders),
      dbInvoiceStore.paymentsFor(orders.map((o) => o.id)),
    ]);
    return NextResponse.json(
      {
        now: now.toISOString(),
        ...buildPanelSales({
          range,
          now,
          orders,
          bookings,
          couponSourceOf: (orderNo) => coupons.get(orderNo) ?? null,
          paymentsOf: (order) => payments.get(order.id) ?? [],
        }),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[panel-sales] sales could not be read", err);
    return deny(503, "unavailable");
  }
}
