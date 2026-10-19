import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import type { AdminOrderStatus } from "./store";

/**
 * The orders a promo code went into, newest first, for the code's view page
 * (admin audit PEO-24: the list said "12/50" and nothing showed which
 * orders the twelve were). Read-only.
 *
 * Only what the row shows: number, status, date and money. No name, e-mail
 * or address: the order's own page is one click away for whoever may open
 * it, and the caller reads this only for a role with `orders`.
 */

export const PROMO_ORDERS_LIMIT = 20;

export interface PromoOrderRow {
  id: string;
  orderNo: number;
  status: AdminOrderStatus;
  fulfillment?: string;
  discountMinor: number;
  totalMinor: number;
  createdAt: string;
}

export interface PromoOrders {
  rows: PromoOrderRow[];
  /** Every order carrying the code, not only the rows read. */
  total: number;
}

export async function listPromoOrders(
  code: string,
  limit: number = PROMO_ORDERS_LIMIT,
): Promise<PromoOrders> {
  if (!code) return { rows: [], total: 0 };
  const db = getDb();
  const [list, count] = await Promise.all([
    db
      .from(TABLES.orders)
      .select(
        "id, orderNo, status, fulfillment, discountMinor, totalMinor, createdAt",
      )
      // The order keeps the code exactly as the promo row spells it
      // (finalizeOrder writes promo.code).
      .eq("promoCode", code)
      .order("createdAt", { ascending: false })
      .limit(limit),
    db
      .from(TABLES.orders)
      .select("*", { count: "exact", head: true })
      .eq("promoCode", code),
  ]);
  if (list.error)
    raiseDbError("listPromoOrders", list.error as DbError, list.status);
  if (count.error)
    raiseDbError("listPromoOrders.count", count.error as DbError, count.status);
  const rows = ((list.data as Record<string, unknown>[] | null) ?? []).map(
    (r): PromoOrderRow => ({
      id: String(r.id ?? ""),
      orderNo: Number(r.orderNo) || 0,
      status: String(r.status ?? "") as AdminOrderStatus,
      fulfillment:
        typeof r.fulfillment === "string" ? r.fulfillment : undefined,
      discountMinor: Number(r.discountMinor) || 0,
      totalMinor: Number(r.totalMinor) || 0,
      createdAt: String(r.createdAt ?? ""),
    }),
  );
  return { rows, total: count.count ?? rows.length };
}
