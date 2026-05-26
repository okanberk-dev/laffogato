import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/lib/payment";
import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getDb } from "@/lib/mongodb/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PaymentTransactionDoc {
  orderId: string;
  provider: string;
  providerRef: string;
  status: "succeeded" | "failed" | "refunded";
  amountMinor: number;
  currency: string;
  raw: unknown;
  createdAt: string;
}

const TXN_COLLECTION = "payment_transactions";

export async function POST(req: Request) {
  const provider = getPaymentProvider();

  let event;
  try {
    event = await provider.verifyWebhook(req);
  } catch (err) {
    console.error("[payment-webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const db = await getDb();
  const txnColl = db.collection<PaymentTransactionDoc>(TXN_COLLECTION);

  // Idempotency: unique (provider, providerRef). Index'i ilk çağrıda
  // oluştur; zaten varsa fail-soft.
  try {
    await txnColl.createIndex(
      { provider: 1, providerRef: 1 },
      { unique: true, name: "uniq_provider_ref" },
    );
  } catch {
    // Index zaten varsa veya yetersizse sessizce geç — duplicate hata
    // insert sırasında yine yakalanır.
  }

  const status: PaymentTransactionDoc["status"] =
    event.type === "payment.succeeded"
      ? "succeeded"
      : event.type === "payment.failed"
        ? "failed"
        : "refunded";

  try {
    await txnColl.insertOne({
      orderId: event.orderId,
      provider: provider.name,
      providerRef: event.providerRef,
      status,
      amountMinor: event.amountMinor,
      currency: event.currency,
      raw: event.raw,
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    // E11000 = duplicate key = idempotent retry → tamam, devam.
    const code = (err as { code?: number } | null)?.code;
    if (code !== 11000) {
      console.error("[payment-webhook] insert failed", err);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  if (event.type === "payment.succeeded") {
    await db
      .collection(COLLECTIONS.orders)
      .updateOne(
        { id: event.orderId, status: "pending_payment" },
        { $set: { status: "paid" } },
      );
  } else if (event.type === "payment.refunded") {
    await db
      .collection(COLLECTIONS.orders)
      .updateOne({ id: event.orderId }, { $set: { status: "refunded" } });
  }

  return NextResponse.json({ ok: true });
}
