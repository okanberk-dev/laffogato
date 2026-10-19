import { safeAudit } from "@/lib/admin/audit";
import { getAdminSession } from "@/lib/admin/auth";
import {
  ORDER_CSV_MAX_ROWS,
  istanbulStamp,
  ordersCsv,
} from "@/lib/admin/order-csv";
import { mayExportOrders } from "@/lib/admin/order-actions";
import {
  ORDER_SORT_COLUMNS,
  parseOrderListParams,
  type OrderSortKey,
} from "@/lib/admin/order-filters";
import {
  listOrderMoney,
  listOrdersFiltered,
  type AdminOrder,
} from "@/lib/admin/store";
import { couponSourcesForOrders } from "@/lib/customer/coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rows per read while building the file: the list's own page, ten at most. */
const BATCH = 500;

/**
 * `GET /admin/siparisler/csv?<the list's params>` - the filtered order list
 * as a CSV file: the same parser and the same query as the page, so the file
 * holds exactly what the screen shows (every page of it, up to
 * ORDER_CSV_MAX_ROWS).
 *
 * A route handler is not behind `requireRole` (that redirects pages), and
 * `proxy.ts` only redirects page views, so the session and the role are
 * checked here, on every request. Names and e-mails only: no phone, no
 * address, no consent evidence. Owner and manager only (`mayExportOrders`):
 * the file is the customer list with every order's money, which staff do
 * not see in the panel either (customers, reports).
 *
 * Every export writes an `export` row to Olay kaydı (who, which filters,
 * how many rows; admin audit ORD-15): personal data leaving the panel as a
 * file left no trace. safeAudit: a failed row is logged, the file still
 * goes out.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!mayExportOrders(session.role)) {
    return new Response("Bu sayfaya erişimin yok.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const parsed = parseOrderListParams(new URL(request.url).searchParams);
  const sort = {
    column: ORDER_SORT_COLUMNS[parsed.sort.key as OrderSortKey],
    ascending: parsed.sort.dir === "asc",
  };
  const orders: AdminOrder[] = [];
  for (let page = 1; orders.length < ORDER_CSV_MAX_ROWS; page += 1) {
    const batch = await listOrdersFiltered({
      query: parsed.query,
      sort,
      page,
      pageSize: BATCH,
    });
    orders.push(...batch.orders);
    if (batch.orders.length < BATCH) break;
  }
  const rows = orders.slice(0, ORDER_CSV_MAX_ROWS);
  // The coupon each order redeemed: a reward coupon pays for the goods, so
  // the KDV columns carry the invoice's split at full price (ASK-COUPON).
  // A failed read fails the file: a split that hides a reward is wrong.
  const [money, coupons] = await Promise.all([
    listOrderMoney(rows),
    couponSourcesForOrders(rows),
  ]);
  const csv = ordersCsv(
    rows,
    (o) => money.get(o.id)?.collected ?? Boolean(o.paidAt),
    (o) => coupons.get(o.orderNo) ?? null,
  );
  await safeAudit({
    action: "export",
    entity: "order",
    actor: session.email,
    payload: {
      filters: parsed.values,
      ...(parsed.tab ? { tab: parsed.tab } : {}),
      rows: rows.length,
    },
  });
  const day = istanbulStamp(new Date().toISOString()).slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="siparisler-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
