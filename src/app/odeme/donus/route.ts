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

  return successRedirect(orderId, promo, base);
}

/**
 * The virtual POS returns the CUSTOMER'S BROWSER here with a form POST.
 *
 * `IYZICO_CALLBACK_URL` used to point at the signed webhook, which answers a
 * browser with `401 {"error":"invalid_signature"}` — so the last thing a paying
 * customer saw was a JSON error. This is the page they land on instead.
 *
 * The POSTed body is not trusted: it carries a token, and the provider is
 * asked what that token settled. Confirming here as well as in the webhook is
 * deliberate — whichever arrives first wins, and `applyPaymentSucceeded` is
 * idempotent on (provider, providerRef).
 */
export async function POST(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = getPaymentProvider();

  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") params[k] = v;
    }
  } catch {
    params = {};
  }
  // Some providers append the reference to the query string as well.
  for (const [k, v] of req.nextUrl.searchParams.entries()) {
    if (!(k in params)) params[k] = v;
  }

  if (!provider.confirmReturn) {
    // A provider that settles only by webhook: send the customer to the
    // success page, which reads the order's real status.
    return successRedirect(params.orderId ?? "", params.promo ?? "", base);
  }

  try {
    const result = await provider.confirmReturn(params);
    if (result.status === "succeeded") {
      const applied = await applyPaymentSucceeded({
        orderId: result.orderId,
        provider: provider.name,
        providerRef: result.providerRef,
        amountMinor: result.amountMinor,
        currency: result.currency,
        raw: result.raw,
      });
      if (!applied.ok) {
        console.error("[odeme/donus] apply failed", applied.error);
      }
      return successRedirect(result.orderId, params.promo ?? "", base);
    }
    console.warn("[odeme/donus] payment not successful", result.orderId);
    return NextResponse.redirect(new URL("/odeme?durum=basarisiz", base), 303);
  } catch (err) {
    // A failure to confirm is not a failed payment: the webhook may still
    // settle it. Send the customer to the success page, which shows the
    // order's actual status rather than guessing.
    console.error("[odeme/donus] confirmReturn failed", err);
    return successRedirect(params.orderId ?? "", params.promo ?? "", base);
  }
}

function successRedirect(orderId: string, promo: string, base: string) {
  if (!orderId)
    return NextResponse.redirect(new URL("/?cart=empty", base), 303);
  const suffix = promo === "dropped" ? "&promo=dropped" : "";
  // 303 so the browser turns the provider's POST into a GET.
  return NextResponse.redirect(
    new URL(
      `/odeme/basarili?ref=${encodeURIComponent(orderId)}${suffix}`,
      base,
    ),
    303,
  );
}
