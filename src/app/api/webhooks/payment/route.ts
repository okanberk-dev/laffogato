import { NextResponse } from "next/server";

import { applyPaymentSucceeded, recordProviderRefund } from "@/lib/admin/store";
import { getPaymentProvider } from "@/lib/payment";
import { getDb, TABLES } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const provider = getPaymentProvider();

  let event;
  try {
    event = await provider.verifyWebhook(req);
  } catch (err) {
    console.error("[payment-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (event.type === "payment.succeeded") {
    // Goes through the shared applier rather than a bare status write: it owns
    // the payment_transactions insert, the idempotency check, and the
    // "payment confirmed" e-mail — which a direct UPDATE here skipped, so a
    // real POS confirmation never mailed the customer.
    const result = await applyPaymentSucceeded({
      orderId: event.orderId,
      provider: provider.name,
      providerRef: event.providerRef,
      amountMinor: event.amountMinor,
      currency: event.currency,
      raw: event.raw,
    });
    if (!result.ok) {
      console.error("[payment-webhook] apply failed", result.error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    // A payment that could not be applied — a short collection, or an order
    // the stale sweep already cancelled — is still answered 200. The applier
    // recorded the transaction and wrote an audit row for a human; a 500 here
    // only bought a retry storm for a notification that can never succeed.
    if (result.reconcile) {
      return NextResponse.json({ ok: true, reconcile: result.reconcile });
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "payment.refunded") {
    // A partial refund is not a refunded order. The old code flipped the whole
    // order to `refunded` and recorded no amount, so a ₺50 refund on a ₺500
    // order read as fully refunded and the money never appeared in the refund
    // ledger the admin page and the reports both read.
    const result = await recordProviderRefund({
      orderId: event.orderId,
      provider: provider.name,
      providerRef: event.providerRef,
      amountMinor: event.amountMinor,
      currency: event.currency,
      raw: event.raw,
    });
    if (!result.ok) {
      console.error("[payment-webhook] refund apply failed", result.error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // payment.failed — record it for the audit trail and leave the order in
  // `pending_payment` so the customer can retry.
  const sb = getDb();
  const { error } = await sb.from(TABLES.paymentTransactions).insert({
    orderId: event.orderId,
    provider: provider.name,
    providerRef: event.providerRef,
    status: "failed",
    amountMinor: event.amountMinor,
    currency: event.currency,
    raw: event.raw,
    createdAt: new Date().toISOString(),
  });
  // 23505 is the unique (provider, providerRef) index catching a retry.
  if (error && error.code !== "23505") {
    console.error("[payment-webhook] insert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
