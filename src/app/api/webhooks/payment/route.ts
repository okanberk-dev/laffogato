import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/payment";
import { createAdminClient } from "@/lib/supabase/server";

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

  const supabase = createAdminClient();

  // Idempotency: unique (provider, provider_ref).
  const { error: insertError } = await supabase
    .from("payment_transactions")
    .insert({
      order_id: event.orderId,
      provider: provider.name,
      provider_ref: event.providerRef,
      status:
        event.type === "payment.succeeded"
          ? "succeeded"
          : event.type === "payment.failed"
            ? "failed"
            : "refunded",
      amount_minor: event.amountMinor,
      currency: event.currency,
      raw_payload: event.raw as never,
    });

  if (insertError) {
    // Unique violation = idempotent retry; everything else surfaces.
    if (insertError.code !== "23505") {
      console.error("[payment-webhook] insert failed", insertError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  if (event.type === "payment.succeeded") {
    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", event.orderId)
      .eq("status", "pending_payment");

    if (orderError) {
      console.error("[payment-webhook] order update failed", orderError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  } else if (event.type === "payment.refunded") {
    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: "refunded" })
      .eq("id", event.orderId);

    if (orderError) {
      console.error("[payment-webhook] order refund failed", orderError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
