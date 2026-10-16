import type { AdminOrder } from "@/lib/admin/store";

/**
 * Which orders a member's own order pages show (operator, 16 Eki 2026:
 * "sipariş ... ödeme tam alınmadan ... profilde gözükmesin").
 *
 * An order exists from the moment "Siparişi onayla ve öde" is pressed - the
 * stock and the code are held while the bank asks - but for the customer it
 * is an order only once it is paid. A declined card used to leave a
 * "Ödeme bekleniyor" row in the profile for every attempt, and the sweep
 * then turned each into "İptal edildi". So the profile leaves out:
 *
 * - `pending_payment`: the payment is not (yet) confirmed;
 * - `cancelled` without a payment: an attempt that was never paid (no
 *   `paidAt`, nothing refunded). A paid order the shop later cancelled stays
 *   visible - the customer paid for it and is owed its story.
 *
 * Everything else (paid, preparing, shipped, completed, refunded) is shown.
 * Pure: the profile list, its detail page and the account summary all filter
 * through `memberOrders`, which calls this.
 */
export function memberMaySeeOrder(
  order: Pick<AdminOrder, "status" | "paidAt" | "refunds">,
): boolean {
  if (order.status === "pending_payment") return false;
  if (order.status === "cancelled") {
    return (
      Boolean((order.paidAt ?? "").trim()) || (order.refunds ?? []).length > 0
    );
  }
  return true;
}
