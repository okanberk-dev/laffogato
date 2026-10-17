import "server-only";

import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import { formatTRYMinor } from "@/lib/utils/commerce";

/**
 * The member wallet's ledger (docs/API-MOBILE.md §18,
 * db/migrations/20261014224120_wallet_ledger.sql).
 *
 * The balance is the sum of the member's rows, never a stored number: a
 * stored balance would be a counter moved in JavaScript, which loses writes
 * exactly when two checkouts race (CLAUDE.md rule 20). Spending happens only
 * inside `wallet_place_order`, together with the order insert, under a
 * per-member lock - nothing in this file debits.
 *
 * Deliberately free of `@/lib/admin/store` imports: the store imports this.
 */

/** Provider name on the payment_transactions row of a wallet-paid order. */
export const WALLET_PROVIDER = "wallet";

/** The `providerRef` a wallet payment is booked under - one per order. */
export function walletProviderRef(orderId: string): string {
  return `${WALLET_PROVIDER}_${orderId}`;
}

/**
 * Whether paying from the wallet is switched on for this deployment.
 *
 * Off unless `WALLET_ENABLED=true`. §18's own rule: a feature without its
 * server is not shown, and an absent wallet and `enabled: false` mean the
 * same thing. While it is off there is no spendable balance, so
 * `payWithWallet` is refused with `insufficient_balance` and no order is
 * written - the app never sends it then, because `GET /me/wallet` does not
 * say `enabled: true`.
 */
export function walletPaymentsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.WALLET_ENABLED?.trim().toLowerCase() === "true";
}

/** Turkish copy for the one refusal a wallet checkout can meet. */
export const WALLET_MESSAGES = {
  insufficient:
    "Cüzdan bakiyen bu siparişi karşılamıyor. Bakiye yükle ya da kartla öde.",
  disabled: "Cüzdanla ödeme şu an kullanılamıyor. Kartla öde.",
  totalChanged: (totalMinor: number) =>
    `Sipariş tutarı değişti, yeni tutar ${formatTRYMinor(totalMinor)}. Kontrol edip yeniden onayla.`,
} as const;

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

export interface WalletSpend {
  customerEmail: string;
  /** What the wallet paid, as a positive number of kuruş. */
  amountMinor: number;
}

/**
 * The spend that paid `orderId`, or null when the wallet did not pay it.
 *
 * Its existence is the proof of payment: `wallet_place_order` writes it in
 * the same transaction as the order row, so an order with a spend was paid
 * even when the process died before the order was marked `paid`.
 */
export async function walletSpendFor(
  orderId: string,
): Promise<WalletSpend | null> {
  if (!orderId) return null;
  const { data, error } = await getDb()
    .from(TABLES.walletTransactions)
    .select("customerEmail, amountMinor")
    .eq("orderId", orderId)
    .eq("kind", "spend")
    .limit(1);
  checkErr(error, "walletSpendFor");
  const row = (
    data as { customerEmail: string; amountMinor: number | string }[] | null
  )?.[0];
  if (!row) return null;
  return {
    customerEmail: row.customerEmail,
    amountMinor: Math.abs(Number(row.amountMinor)),
  };
}

/**
 * Credits a refund of a wallet-paid order back to the wallet it came from.
 *
 * The member is the spend row's, not the order's `customerEmail`: staff can
 * edit the e-mail on an order, and the money goes back to whoever paid it.
 * One credit per refund entry (`wallet_transactions_refund_key`), so a
 * retried refund credits once; the amount ceiling is the order's refund
 * ledger, which `reserve_order_refund` has already checked against the
 * order total - and the order total IS what the wallet paid.
 *
 * Throws when the order was not paid from the wallet: crediting a card
 * order's refund to a wallet would hand the member the money twice.
 */
export async function creditWalletRefund(input: {
  orderId: string;
  refundId: string;
  amountMinor: number;
  title: string;
}): Promise<void> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("creditWalletRefund: amount must be a positive integer");
  }
  const spend = await walletSpendFor(input.orderId);
  if (!spend) {
    throw new Error(
      `creditWalletRefund: order ${input.orderId} was not paid from the wallet`,
    );
  }
  const { error } = await getDb()
    .from(TABLES.walletTransactions)
    .insert({
      customerEmail: spend.customerEmail,
      kind: "refund",
      amountMinor: input.amountMinor,
      title: input.title.slice(0, 120),
      orderId: input.orderId,
      refundId: input.refundId,
      createdAt: new Date().toISOString(),
    });
  // 23505: this refund entry was already credited - a retry, not a second credit.
  if (error && error.code !== "23505") checkErr(error, "creditWalletRefund");
}
