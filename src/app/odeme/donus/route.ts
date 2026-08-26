import { NextResponse, type NextRequest } from "next/server";

import { applyPaymentSucceeded, getOrder } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { getPaymentProvider } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment return handler. The provider redirects the customer back here after
 * checkout.
 *
 * DEV-ONLY auto-confirm: ONLY the mock provider may settle a payment from this
 * browser return. Return-URL params are user-controllable, so a real POS must
 * NEVER be trusted here — it confirms money via its signed webhook
 * (src/app/api/webhooks/payment/route.ts). For mock we additionally require the
 * order to belong to the returning, signed-in customer.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const base = url.origin;
  const orderId = url.searchParams.get("orderId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const providerRef = url.searchParams.get("providerRef") ?? "";
  const promo = url.searchParams.get("promo") ?? "";

  if (!orderId) {
    return NextResponse.redirect(new URL("/?cart=empty", base));
  }

  const provider = getPaymentProvider();
  if (provider.name === "mock" && status === "success") {
    const [customer, order] = await Promise.all([
      getActiveCustomer(),
      getOrder(orderId),
    ]);
    if (customer && order && order.customerEmail === customer.email) {
      const res = await applyPaymentSucceeded({
        orderId,
        provider: provider.name,
        providerRef: providerRef || `mock_${orderId}`,
        amountMinor: order.totalMinor,
        currency: "TRY",
        raw: { source: "mock_return" },
      });
      if (!res.ok) {
        console.error("[odeme/donus] mock confirm failed", res.error);
      }
    }
  }

  const suffix = promo === "dropped" ? "&promo=dropped" : "";
  return NextResponse.redirect(
    new URL(
      `/odeme/basarili?ref=${encodeURIComponent(orderId)}${suffix}`,
      base,
    ),
  );
}
