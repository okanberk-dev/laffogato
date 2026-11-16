import { NextResponse, type NextRequest } from "next/server";

import {
  applyPaymentSucceeded,
  getOrder,
  isClosedAccountEmail,
  orderChannel,
  type AdminOrder,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { rememberCardUserKey } from "@/lib/customer/store";
import {
  appOrderDeepLink,
  type PaymentReturnStatus,
} from "@/lib/mobile/deep-link";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";
import {
  karaokeReturnDestination,
  settleKaraokeReturn,
} from "@/lib/mobile/karaoke-return";
import { isIssuedCheckoutRef } from "@/lib/mobile/orders";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment return handler (GET). The provider redirects the customer back here
 * after checkout.
 *
 * Nothing is settled from a GET: return-URL params are user-controllable, so
 * a payment is confirmed only by the POS return (POST below), which asks the
 * provider what the posted token settled.
 *
 * An order placed from the mobile app (docs/API-MOBILE.md §3) ends in the
 * app, not on the web success page: the checkout was opened in an in-app
 * browser, and the deep link `laffogato://siparis/<id>` closes it and shows
 * the order. The app marks its return URL with `app=1`; a provider whose
 * return URL is fixed in its configuration cannot carry that, so the order's own
 * `channel` is the second signal.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const base = url.origin;
  const orderId = url.searchParams.get("orderId") ?? "";
  const providerRef = url.searchParams.get("providerRef") ?? "";
  const promo = url.searchParams.get("promo") ?? "";

  if (!orderId) {
    return NextResponse.redirect(new URL("/?cart=empty", base));
  }

  const provider = safeProvider();
  // A karaoke booking (`krk-`, docs/API-MOBILE.md §7): its own settle and its
  // own landing page; nothing below is order-shaped enough for it.
  if (isKaraokeRef(orderId)) return karaokeRedirect(orderId, base);
  const [customer, order] = await Promise.all([
    getActiveCustomer(),
    safeGetOrder(orderId),
  ]);
  // Web: the order must belong to the signed-in member. App: the in-app
  // browser has no site cookie, so the proof is the checkout reference this
  // server issued for exactly this order (recorded at creation).
  const ownedOnWeb =
    !!customer && !!order && order.customerEmail === customer.email;
  const issuedForApp =
    !!order &&
    !!provider &&
    orderChannel(order) === "app" &&
    (await isIssuedCheckoutRef(orderId, provider.name, providerRef));

  // `app=1` on the URL used to be enough to reach the deep link, whose
  // `?status=success|failed` says whether that order was paid - an
  // unauthenticated paid/unpaid oracle over sequential ids (`ord-0284`).
  // The app branch now needs the checkout reference this server issued, or
  // the signed-in owner; anyone else lands on the web success page, which
  // checks ownership for itself.
  if (issuedForApp || (ownedOnWeb && order && orderChannel(order) === "app")) {
    // The phone is told what the ROW says, not what the URL claims: a
    // hand-made link cannot open the app on a "paid" screen.
    return appRedirect(orderId, await settledStatus(orderId));
  }
  return successRedirect(orderId, promo, base);
}

/**
 * The provider, or null when it cannot be built.
 *
 * `getPaymentProvider()` fails closed on a missing `PAYMENT_PROVIDER`, and
 * this route called it before anything else - so a misconfigured deployment
 * answered the customer coming back from their bank with a 500 instead of
 * their order. Without a provider there is nothing to confirm here; the
 * redirect below still shows the order's real status.
 */
function safeProvider(): PaymentProvider | null {
  try {
    return getPaymentProvider();
  } catch (err) {
    console.error("[odeme/donus] payment provider unavailable", err);
    return null;
  }
}

async function safeGetOrder(orderId: string): Promise<AdminOrder | null> {
  try {
    return await getOrder(orderId);
  } catch (err) {
    console.error("[odeme/donus] order lookup failed", err);
    return null;
  }
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
 * The POS callback once pointed at the signed webhook, which answers a
 * browser with `401 {"error":"invalid_signature"}` - so the last thing a paying
 * customer saw was a JSON error. This is the page they land on instead.
 *
 * The POSTed body is not trusted: it carries a token, and the provider is
 * asked what that token settled. Confirming here as well as in the webhook is
 * deliberate - whichever arrives first wins, and `applyPaymentSucceeded` is
 * idempotent on (provider, providerRef).
 */
export async function POST(req: NextRequest) {
  const base = req.nextUrl.origin;
  const provider = safeProvider();

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
  if (!provider?.confirmReturn) {
    // A provider that settles only by webhook - or none at all, when the
    // deployment is missing its POS configuration: send the customer to the
    // page that reads the order's real status rather than asserting "success".
    const orderId = returnedOrderId(params);
    if (isKaraokeRef(orderId)) return karaokeRedirect(orderId, base);
    if (await isAppOrder(orderId)) {
      return appRedirect(orderId, await settledStatus(orderId));
    }
    return successRedirect(orderId, params.promo ?? "", base);
  }

  try {
    const result = await provider.confirmReturn(params);
    // The reference is the one the POS confirmed, never the posted field.
    // Nothing is cancelled on a failure here either (rule 29).
    if (isKaraokeRef(result.orderId)) {
      await settleKaraokeReturn(result, provider);
      // Only a payment the POS confirmed (which a forger cannot produce:
      // it needs that payment's own REFERENCE_CODE) lets the row speak.
      return karaokeRedirect(
        result.orderId,
        base,
        result.status === "succeeded",
      );
    }
    if (result.status === "succeeded") {
      const applied = await applyPaymentSucceeded({
        orderId: result.orderId,
        provider: provider.name,
        providerRef: result.providerRef,
        amountMinor: result.amountMinor,
        currency: result.currency,
        raw: result.raw,
        trxDate: result.trxDate,
      });
      if (!applied.ok) {
        console.error("[odeme/donus] apply failed", applied.error);
      }
      // The buyer ticked "kartımı kaydet": remember the key so the next
      // checkout shows that card. Best-effort - failing to remember a card
      // must never turn a settled payment into an error.
      if (result.cardUserKey && applied.ok) {
        try {
          const paid = await getOrder(result.orderId);
          // Not onto a closed account. A charge that completes after the
          // member deleted the account (the bank's page was still open)
          // lands on an order the closure cancelled: it is not revived, it
          // goes to a person for a refund (`order_not_open`). The order now
          // carries the closed row's placeholder address, and writing the
          // key there would give a closed account a card again (deleteMe
          // blanks `cardUserKey` and drops the cards at the POS).
          if (
            paid?.customerEmail &&
            !isClosedAccountEmail(paid.customerEmail)
          ) {
            await rememberCardUserKey(paid.customerEmail, result.cardUserKey);
          }
        } catch (err) {
          console.error("[odeme/donus] cardUserKey not stored", err);
        }
      }
      if (await isAppOrder(result.orderId)) {
        return appRedirect(result.orderId, "success");
      }
      return successRedirect(result.orderId, params.promo ?? "", base);
    }
    console.warn("[odeme/donus] payment not successful", result.orderId);
    if (await isAppOrder(result.orderId)) {
      return appRedirect(result.orderId, "failed");
    }
    // `?error=payment` is what /odeme renders a notice for (CHECKOUT_NOTICES);
    // `?durum=basarisiz` was read by nothing, so a declined card came back to
    // the checkout with no word about what had happened.
    //
    // The unpaid order is NOT cancelled here, though its coupon and stock
    // should go back for the retry: this POST arrives cross-site without the
    // member's cookie (SameSite=Lax), so anyone could post a "failed" return
    // for any order id. The retry itself releases them - `placeOrder` →
    // `supersedeUnpaidWebOrders`, as the signed-in owner.
    return NextResponse.redirect(new URL("/odeme?error=payment", base), 303);
  } catch (err) {
    // A failure to confirm is not a failed payment: the webhook may still
    // settle it. Send the customer to the success page, which shows the
    // order's actual status rather than guessing.
    console.error("[odeme/donus] confirmReturn failed", err);
    const orderId = returnedOrderId(params);
    if (isKaraokeRef(orderId)) return karaokeRedirect(orderId, base);
    if (await isAppOrder(orderId)) {
      return appRedirect(orderId, await settledStatus(orderId));
    }
    return successRedirect(orderId, params.promo ?? "", base);
  }
}

/**
 * Which order this return belongs to, when the confirmation could not say.
 *
 * Providers name that field differently: PayNkolay posts it as
 * `CLIENT_REFERENCE_CODE` (docs/PAYNKOLAY.md §1.1), and we put the order id
 * there. Reading only `orderId` sent a customer whose confirmation threw to
 * `/?cart=empty` instead of to their own order.
 */
function returnedOrderId(params: Record<string, string>): string {
  return (params.orderId ?? params.CLIENT_REFERENCE_CODE ?? "").trim();
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

/** A karaoke return: the row decides between the app and the web page. */
async function karaokeRedirect(ref: string, base: string, verified = false) {
  return NextResponse.redirect(
    await karaokeReturnDestination(ref, base, verified),
    303,
  );
}

function appRedirect(orderId: string, status: PaymentReturnStatus) {
  // 303 for the same reason as above: the POS's POST must become a GET.
  return NextResponse.redirect(appOrderDeepLink(orderId, status), 303);
}

/**
 * Whether this return belongs to an app order - the ROW decides.
 *
 * `app=1` on the URL used to be taken as proof, but anyone can type it, and a
 * provider with a fixed callback cannot carry it anyway. The order's
 * own `channel` answers both cases. A database hiccup here answers "web" -
 * the customer then lands on the web success page, which still shows the
 * order - rather than an error page.
 */
async function isAppOrder(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  const order = await safeGetOrder(orderId);
  return !!order && orderChannel(order) === "app";
}
