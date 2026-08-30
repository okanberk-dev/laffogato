import { NextResponse, type NextRequest } from "next/server";

import {
  applyPaymentSucceeded,
  getOrder,
  orderChannel,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { rememberCardUserKey } from "@/lib/customer/store";
import {
  appOrderDeepLink,
  type PaymentReturnStatus,
} from "@/lib/mobile/deep-link";
import { isIssuedCheckoutRef } from "@/lib/mobile/orders";
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
 *
 * An order placed from the mobile app (docs/API-MOBILE.md §3) ends in the
 * app, not on the web success page: the checkout was opened in an in-app
 * browser, and the deep link `laffogato://siparis/<id>` closes it and shows
 * the order. The app marks its return URL with `app=1`; a provider whose
 * callback URL is fixed (iyzico) cannot carry that, so the order's own
 * `channel` is the second signal.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const base = url.origin;
  const orderId = url.searchParams.get("orderId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const providerRef = url.searchParams.get("providerRef") ?? "";
  const promo = url.searchParams.get("promo") ?? "";
  const app = url.searchParams.get("app") ?? "";

  if (!orderId) {
    return NextResponse.redirect(new URL("/?cart=empty", base));
  }

  const provider = getPaymentProvider();
  if (provider.name === "mock" && status === "success") {
    const [customer, order] = await Promise.all([
      getActiveCustomer(),
      getOrder(orderId),
    ]);
    // Web: the order must belong to the signed-in member. App: the in-app
    // browser has no site cookie, so the proof is the checkout reference
    // this server issued for exactly this order (recorded at creation).
    const ownedOnWeb =
      !!customer && !!order && order.customerEmail === customer.email;
    const issuedForApp =
      !!order &&
      orderChannel(order) === "app" &&
      (await isIssuedCheckoutRef(orderId, provider.name, providerRef));
    if (order && (ownedOnWeb || issuedForApp)) {
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

  if (await isAppOrder(orderId, app)) {
    // The phone is told what the ROW says, not what the URL claims: a
    // hand-made link cannot open the app on a "paid" screen.
    return appRedirect(orderId, await settledStatus(orderId));
  }
  return successRedirect(orderId, promo, base);
}

const SETTLED: ReadonlySet<string> = new Set([
  "paid",
  "preparing",
  "shipped",
  "completed",
]);

async function settledStatus(orderId: string): Promise<PaymentReturnStatus> {
  try {
    const order = await getOrder(orderId);
    return order && SETTLED.has(order.status) ? "success" : "failed";
  } catch (err) {
    console.error("[odeme/donus] status lookup failed", err);
    return "failed";
  }
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
  const app = params.app ?? "";

  if (!provider.confirmReturn) {
    // A provider that settles only by webhook: send the customer to the
    // success page, which reads the order's real status.
    const orderId = params.orderId ?? "";
    if (await isAppOrder(orderId, app)) return appRedirect(orderId, "success");
    return successRedirect(orderId, params.promo ?? "", base);
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
      // The buyer ticked "kartımı kaydet": remember the key so the next
      // checkout shows that card. Best-effort — failing to remember a card
      // must never turn a settled payment into an error.
      if (result.cardUserKey && applied.ok) {
        try {
          const paid = await getOrder(result.orderId);
          if (paid?.customerEmail) {
            await rememberCardUserKey(paid.customerEmail, result.cardUserKey);
          }
        } catch (err) {
          console.error("[odeme/donus] cardUserKey not stored", err);
        }
      }
      if (await isAppOrder(result.orderId, app)) {
        return appRedirect(result.orderId, "success");
      }
      return successRedirect(result.orderId, params.promo ?? "", base);
    }
    console.warn("[odeme/donus] payment not successful", result.orderId);
    if (await isAppOrder(result.orderId, app)) {
      return appRedirect(result.orderId, "failed");
    }
    return NextResponse.redirect(new URL("/odeme?durum=basarisiz", base), 303);
  } catch (err) {
    // A failure to confirm is not a failed payment: the webhook may still
    // settle it. Send the customer to the success page, which shows the
    // order's actual status rather than guessing.
    console.error("[odeme/donus] confirmReturn failed", err);
    const orderId = params.orderId ?? "";
    if (await isAppOrder(orderId, app)) {
      return appRedirect(orderId, await settledStatus(orderId));
    }
    return successRedirect(orderId, params.promo ?? "", base);
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

function appRedirect(orderId: string, status: PaymentReturnStatus) {
  // 303 for the same reason as above: the POS's POST must become a GET.
  return NextResponse.redirect(appOrderDeepLink(orderId, status), 303);
}

/**
 * Whether this return belongs to an app order. `app=1` on the URL is the
 * app's own marker; failing that, the order row says where it came from. A
 * database hiccup here answers "web" — the customer then lands on the web
 * success page, which still shows the order — rather than an error page.
 */
async function isAppOrder(orderId: string, app: string): Promise<boolean> {
  if (app === "1") return true;
  if (!orderId) return false;
  try {
    const order = await getOrder(orderId);
    return !!order && orderChannel(order) === "app";
  } catch (err) {
    console.error("[odeme/donus] channel lookup failed", err);
    return false;
  }
}
