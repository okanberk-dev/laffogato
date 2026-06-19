import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/payment";
import { getSupabaseAdmin, TABLES } from "@/lib/supabase/server";

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

  const sb = getSupabaseAdmin();

  const status: "succeeded" | "failed" | "refunded" =
    event.type === "payment.succeeded"
      ? "succeeded"
      : event.type === "payment.failed"
        ? "failed"
        : "refunded";

  // Idempotency is enforced by the unique (provider, "providerRef") index on
  // payment_transactions. A duplicate webhook hits 23505 (unique_violation),
  // which we treat as an already-processed retry.
  const { error } = await sb.from(TABLES.paymentTransactions).insert({
    orderId: event.orderId,
    provider: provider.name,
    providerRef: event.providerRef,
    status,
    amountMinor: event.amountMinor,
    currency: event.currency,
    raw: event.raw,
    createdAt: new Date().toISOString(),
  });
  if (error && error.code !== "23505") {
    console.error("[payment-webhook] insert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (event.type === "payment.succeeded") {
    await sb
      .from(TABLES.orders)
      .update({ status: "paid" })
      .eq("id", event.orderId)
      .eq("status", "pending_payment");
  } else if (event.type === "payment.refunded") {
    await sb
      .from(TABLES.orders)
      .update({ status: "refunded" })
      .eq("id", event.orderId);
  }

  return NextResponse.json({ ok: true });
}
