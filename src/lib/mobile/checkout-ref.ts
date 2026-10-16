import "server-only";

import { getDb, TABLES } from "@/lib/db";

/**
 * Remembers which checkout reference was opened for the order.
 *
 * The in-app browser carries no site cookie, so /odeme/donus cannot tie a
 * mock return to a signed-in member the way it does on the web. What it can
 * check is that the reference on the return URL is the one this server
 * issued - kept as a `pending` transaction whose reference is prefixed so it
 * never collides with the `succeeded` row the confirmation inserts. A real
 * POS settles by signed webhook; this row is then only an audit breadcrumb.
 *
 * Shared by the app's order checkout (orders.ts) and the karaoke booking's
 * payment page (karaoke-payment.ts), whose reference rides the same return.
 */
export async function recordPendingCheckout(
  orderId: string,
  provider: string,
  providerRef: string,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.paymentTransactions)
    .insert({
      orderId,
      provider,
      providerRef: pendingCheckoutRef(providerRef),
      status: "pending",
      amountMinor: 0,
      currency: "TRY",
      raw: { source: "app_checkout" },
      createdAt: new Date().toISOString(),
    });
  if (error && error.code !== "23505") {
    console.error(`[orders] pending checkout record failed: ${error.message}`);
  }
}

export function pendingCheckoutRef(providerRef: string): string {
  return `pending:${providerRef}`;
}

/** True when `providerRef` is the reference this server opened for the order. */
export async function isIssuedCheckoutRef(
  orderId: string,
  provider: string,
  providerRef: string,
): Promise<boolean> {
  if (!providerRef) return false;
  const { data, error } = await getDb()
    .from(TABLES.paymentTransactions)
    .select("orderId")
    .eq("orderId", orderId)
    .eq("provider", provider)
    .eq("providerRef", pendingCheckoutRef(providerRef))
    .limit(1);
  if (error) {
    console.error(`[orders] checkout ref lookup failed: ${error.message}`);
    return false;
  }
  return ((data as unknown[] | null) ?? []).length > 0;
}
