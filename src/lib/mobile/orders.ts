import "server-only";

import { headers } from "next/headers";

import type { PublicCustomer } from "@/lib/customer/store";

import {
  checkLoginLimit,
  clientIp,
  reserveLoginAttempt,
} from "@/lib/admin/rate-limit";
import {
  applyPaymentSucceeded,
  applyPromoCode,
  checkPendingOrderPaid,
  customerOrdersByEmail,
  expireStalePendingOrders,
  findAppOrderByClientId,
  getOrder,
  getSettings,
  placeAppOrder,
  previewAppOrderLines,
  PENDING_ORDER_TTL_MINUTES,
  settleWalletPayment,
  type AdminOrder,
  type AppOrderFailure,
  type OrderLegalConsent,
  type PlaceAppOrderResult,
} from "@/lib/admin/store";
import { ensureCardUserKey } from "@/lib/customer/store";
import {
  applyCustomerCoupon,
  couponAllowedForKind,
  CAFE_ONLY_COUPON_MESSAGE,
} from "@/lib/customer/coupons";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import { checkoutConsentShown } from "@/lib/legal/store";
import { DbQueryError } from "@/lib/db/health";
import { getPaymentProvider } from "@/lib/payment";
import { SITE } from "@/lib/seo/site";

import { orderChannel } from "@/lib/admin/order-channel";
import { getOrderStamps } from "./loyalty";
import { stampsForOrder } from "./loyalty-core";
import { resolveOrderAddress } from "./order-address";
import { recordPendingCheckout } from "./checkout-ref";
import { toMobileOrder, type MobileOrder } from "./order-mapper";
import {
  computeTotalsWithShipping,
  orderingRefusal,
  shippingModeFor,
} from "./order-pricing";
import type { PlaceOrderBody, PreviewOrderBody } from "./order-schema";
import { lookupTableLimited, tableLookupFailure } from "./tables";
import { WALLET_MESSAGES, walletPaymentsEnabled } from "./wallet";

/**
 * Order use-cases behind `/api/mobile/v1/orders*` and `/promo/preview`
 * (docs/API-MOBILE.md §3, §5). Route handlers parse and authorise; this is
 * where the pieces are put together. Money and stock decisions stay in the
 * store - nothing here prices a line.
 */

/** A refusal the route turns into `{ error, message }` with this status. */
export interface AppFailure {
  status: number;
  code: string;
  message: string;
  /** Additive body fields this refusal documents (e.g. `totalMinor`). */
  extra?: Record<string, unknown>;
  /** Response headers the refusal carries (e.g. `Retry-After` on a 429). */
  headers?: Record<string, string>;
}

/** How many orders `GET /orders` returns, newest first. */
export const ORDER_LIST_LIMIT = 50;

/** Provider name recorded on a checkout that owed nothing. */
const FREE_PROVIDER = "free";

const MSG = {
  shopClosed: "Mağaza şu an sipariş almıyor.",
  cafeClosed: "Köşk şu an kapalı - açılış saatlerinde tekrar dene.",
  empty: "Sepet boş.",
  paymentUnavailable:
    "Ödeme altyapısına şu an ulaşılamıyor. Birazdan tekrar dene.",
  paymentUnverified:
    "Önceki ödemenin durumunu şu an doğrulayamıyoruz. Birkaç dakika sonra tekrar dene.",
} as const;

/**
 * How many of the member's newest orders the open-checkout count looks at.
 *
 * `MAX_OPEN_ORDERS` is 3 and only orders younger than the expiry window
 * count, so a page of recent rows is always enough - and it keeps a regular's
 * two-year history out of every checkout.
 */
const RECENT_ORDER_SCAN = 20;

export function failureFromResult(result: AppOrderFailure): AppFailure {
  switch (result.reason) {
    case "shop_closed":
      return { status: 409, code: "shop_closed", message: MSG.shopClosed };
    case "cafe_closed":
      return { status: 409, code: "cafe_closed", message: MSG.cafeClosed };
    case "out_of_stock":
      return {
        status: 409,
        code: "out_of_stock",
        message:
          result.available > 0
            ? `${result.productName} için yeterli stok yok (kalan: ${result.available}).`
            : `${result.productName} tükendi.`,
      };
    case "empty":
      return { status: 400, code: "empty_cart", message: MSG.empty };
    case "not_found":
      // A shop line without the variant its product is sold by. The app's
      // product page always sends one; an older basket or a reorder of a
      // product that has since gained variants may not. The existing 400
      // for a line the product cannot take (docs/API-MOBILE.md §3), which
      // the app answers like `line_not_found`: the server's words, and the
      // way out is the basket.
      if (result.variantRequired) {
        return {
          status: 400,
          code: "invalid_line",
          message: `${result.productName} için bir seçenek seç. Sepeti güncelle.`,
        };
      }
      return {
        status: 400,
        code: "line_not_found",
        message: `${result.productName} artık satışta değil. Sepeti güncelle.`,
      };
    case "qty_too_high":
      return {
        status: 400,
        code: "qty_too_high",
        message: `${result.productName} için en fazla ${result.max} adet sipariş edebilirsin.`,
      };
    case "bad_line":
      return { status: 400, code: "invalid_line", message: result.message };
    case "bad_request":
      return { status: 400, code: "invalid_body", message: result.message };
    case "insufficient_balance":
      return {
        status: 409,
        code: "insufficient_balance",
        message: WALLET_MESSAGES.insufficient,
      };
    case "total_changed":
      return {
        status: 409,
        code: "total_changed",
        message: WALLET_MESSAGES.totalChanged(result.totalMinor),
        extra: { totalMinor: result.totalMinor },
      };
  }
}

/**
 * The durable record that the member confirmed the Ön Bilgilendirme Formu
 * and the Mesafeli Satış Sözleşmesi - same shape the web checkout writes,
 * so a chargeback review reads one format: the label and, through the same
 * rule, the hash of each text shown (`textHashes`).
 */
async function buildLegalConsent(): Promise<OrderLegalConsent> {
  const h = await headers();
  return {
    acceptedAt: new Date().toISOString(),
    documents: [...CHECKOUT_CONSENT_DOCS],
    // The label and the hash of each text shown, from one read of the
    // overrides (src/lib/legal/store.ts `checkoutConsentShown`).
    ...(await checkoutConsentShown()),
    ip: await clientIp(),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

export interface AppPayment {
  redirectUrl: string;
  expiresAt: string;
}

/**
 * Opens the provider's checkout for the order. The browser return carries
 * `app=1` so /odeme/donus sends the customer back into the app rather than to
 * the web success page; the failure page does the same by order id.
 */
async function createAppPaymentSession(
  order: AdminOrder,
  customer: PublicCustomer,
  buyerIp: string,
): Promise<AppPayment> {
  const provider = getPaymentProvider();
  // Saved cards: the member's key lets the payment page list the cards they
  // saved at PayNkolay and save a new one (docs/PAYNKOLAY.md §16). Created on
  // the member's first checkout, and only while card storage is on - as on
  // the web (`src/app/odeme/actions.ts`). Off, no key is minted at all.
  const cardUserKey = provider.cardStorageEnabled
    ? await ensureCardUserKey(customer.email)
    : "";
  const address = {
    city: "",
    district: "",
    line1: order.shippingAddress,
  };
  const session = await provider.createCheckoutSession({
    orderId: order.id,
    amountMinor: order.totalMinor,
    currency: "TRY",
    customer: {
      id: customer.id,
      email: customer.email,
      fullName: customer.name,
      phone: customer.phone || undefined,
    },
    billingAddress: address,
    shippingAddress: address,
    items: order.items.map((it) => ({
      productId: it.productId ?? it.menuItemId ?? "",
      variantId: it.variantId,
      name: it.productName,
      unitPriceMinor: it.unitPriceMinor,
      quantity: it.qty,
    })),
    successUrl: `${SITE.url}/odeme/donus?app=1`,
    failureUrl: `${SITE.url}/odeme/app-hata?orderId=${encodeURIComponent(order.id)}`,
    buyerIp: buyerIp || undefined,
    cardUserKey: cardUserKey || undefined,
  });
  await recordPendingCheckout(order.id, provider.name, session.providerRef);
  return { redirectUrl: session.redirectUrl, expiresAt: session.expiresAt };
}

// The checkout-reference helpers live in ./checkout-ref (the karaoke
// booking uses them too, without the rest of this module).
export {
  isIssuedCheckoutRef,
  pendingCheckoutRef,
  recordPendingCheckout,
} from "./checkout-ref";

export type CreateAppOrderResult =
  | {
      ok: true;
      order: MobileOrder;
      payment: AppPayment | null;
      promoDropped: boolean;
    }
  | { ok: false; failure: AppFailure };

/**
 * `POST /orders`: places the order for the authenticated member and opens
 * payment. A basket a coupon brought to ₺0 (a free-drink reward on one
 * drink) has nothing to collect: it is settled at once through the same
 * idempotent path a provider confirmation takes, so it earns its stamp and
 * its e-mail like any paid order, and `payment` is null.
 */
/**
 * How many unpaid orders one member may have open at once.
 *
 * Each `pending_payment` order sends a confirmation e-mail, opens a checkout
 * session at the provider and - for shop lines - holds stock for the whole
 * 45-minute expiry window. Three covers a customer who abandons a checkout
 * and starts over twice; past that it is a script, not a shopper.
 */
export const MAX_OPEN_ORDERS = 3;

const TOO_MANY_PENDING = {
  status: 429,
  code: "too_many_pending",
  // Not "iptal et": the app has no way to cancel an order.
  message: `Ödemesi tamamlanmamış siparişlerin var. Ödemeyi tamamla ya da ${PENDING_ORDER_TTL_MINUTES} dakika sonra tekrar dene.`,
} as const;

/**
 * The stamps each of the member's orders holds, or an empty map when the
 * ledger cannot be read.
 *
 * `stampsEarned` is a caption on an order card; failing to draw it must not
 * fail the order list - and least of all the POST that has just placed an
 * order, where a throw would tell the app the checkout failed and invite a
 * second one. The authoritative balance is `/me.loyalty`, which does surface
 * a ledger outage.
 */
async function stampedOrders(
  email: string,
): Promise<ReadonlyMap<string, number>> {
  try {
    return await getOrderStamps(email);
  } catch (err) {
    console.error("[orders] reading the stamp ledger failed", err);
    return new Map<string, number>();
  }
}

/**
 * The refusal for a member who has reopened the POS too often (§3).
 *
 * `rate_limited` and 429, the code and status §0 already uses for a
 * throttle; the app's checkout and its "Şimdi öde" both show a refusal they
 * do not know by its own sentence or a generic one, and neither retries on
 * its own.
 */
function reopenLimited(retryAfterSeconds: number): AppFailure {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  const minutes = Math.ceil(seconds / 60);
  return {
    status: 429,
    code: "rate_limited",
    message: `Ödeme sayfasını çok sık açtın. ${minutes} dakika sonra tekrar dene.`,
    headers: { "Retry-After": String(seconds) },
  };
}

/**
 * Answers a repeated checkout attempt with the order it already produced.
 *
 * An order still awaiting payment gets a fresh checkout session rather than
 * the first one's URL: provider sessions expire (30 minutes). A second
 * session is safe for the ORDER - `applyPaymentSucceeded` is idempotent and
 * the order can only advance once - but not for the card: PayNkolay takes a
 * second sale on the same `clientRefCode` (docs/PAYNKOLAY.md §2), so a first
 * payment whose return was lost (a closed tab, a phone that locked on the
 * bank's page) would be charged again. The POS is therefore asked first
 * (`checkPendingOrderPaid`, the web checkout's gate): a payment it already
 * holds is booked and no session is opened; a POS that cannot be asked, or
 * money that arrived at the wrong amount, is 503 `payment_unavailable` and
 * nothing is opened either (rule 29: not knowing is never "not paid"). An
 * order that has since been paid or cancelled has nothing to pay, so
 * `payment` is null and the app shows it as it stands.
 *
 * If the POS cannot be reopened the retry fails exactly as the first attempt
 * did (a throw → 500), and the next retry replays this same order again. It
 * used to swallow the error and answer 201 with `payment: null` for an order
 * still awaiting payment - which §3 reserves for a ₺0 order, so the app
 * emptied the basket and showed an unpaid order as placed.
 */
async function replayAppOrder(
  first: AdminOrder,
  customer: PublicCustomer,
): Promise<CreateAppOrderResult> {
  let order = first;
  let payment: AppPayment | null = null;
  // A wallet order still `pending_payment` was paid all the same - its spend
  // is written with the row - and only missed being marked. It is booked
  // here and never sent to the card, even if the booking itself fails: a
  // checkout session would charge the member a second time.
  let paidByWallet = false;
  if (order.status === "pending_payment" && order.totalMinor > 0) {
    const wallet = await settleWalletPayment(order.id);
    if (wallet) {
      paidByWallet = true;
      if (!wallet.ok) {
        console.error(
          `[orders] booking the wallet payment of ${order.id} failed`,
          wallet.error,
        );
      }
      order = (await getOrder(order.id)) ?? order;
    }
  }
  if (
    !paidByWallet &&
    order.status === "pending_payment" &&
    order.totalMinor > 0
  ) {
    // Every reopen is a call to the payment provider and a pending
    // `payment_transactions` row, and nothing else bounded it: one member
    // with one unpaid order could loop on it and open POS sessions from this
    // merchant account as fast as they could send requests. Counted per
    // member before the call, atomically (`reserve_auth_attempt`), so a
    // parallel burst cannot slip past the count either. The first session of
    // a new order is not counted here - `too_many_pending` bounds those.
    const gate = await reserveLoginAttempt(
      "checkout-reopen",
      "",
      customer.email,
    );
    if (gate.blocked) {
      return { ok: false, failure: reopenLimited(gate.retryAfterSeconds) };
    }
    // After the budget, so a member looping on "Şimdi öde" cannot turn it
    // into unbounded PaymentList calls either. "unknown" includes an amount
    // mismatch: money is at the POS, just not this order's total, and a
    // second page would charge on top of it.
    const verdict = await checkPendingOrderPaid(order, getPaymentProvider());
    if (verdict === "unknown") {
      return {
        ok: false,
        failure: {
          status: 503,
          code: "payment_unavailable",
          message: MSG.paymentUnverified,
        },
      };
    }
    if (verdict === "paid") {
      // Booked just now: the order as it stands, and no checkout.
      return replayAnswer((await getOrder(order.id)) ?? order, null);
    }
    // The caller's own IP, as the first attempt sends it (`consent.ip`): an
    // empty one reached PayNkolay as `cardHolderIP: 0.0.0.0`, and every
    // reopened checkout - the retry of a lost POST, "Şimdi öde" from the
    // order - went to the bank's fraud screen with no address at all.
    payment = await createAppPaymentSession(order, customer, await clientIp());
  }
  return replayAnswer(order, payment);
}

/** A replay's answer: the order as it now stands, and its checkout if any. */
async function replayAnswer(
  order: AdminOrder,
  payment: AppPayment | null,
): Promise<CreateAppOrderResult> {
  return {
    ok: true,
    order: toMobileOrder(
      order,
      new Date(),
      await stampedOrders(order.customerEmail),
    ),
    payment,
    promoDropped: false,
  };
}

export async function createAppOrder(
  customer: PublicCustomer,
  body: PlaceOrderBody,
): Promise<CreateAppOrderResult> {
  // The member's own retry is not a second order. The app repeats the id it
  // generated for this checkout attempt, so a POST it gave up on - while the
  // server was still mailing the confirmation and opening the checkout
  // session - answers with the order that first call created.
  //
  // FIRST, before the operator's switches: the order already exists. Staff
  // closing ordering between the attempt and its retry used to answer the
  // retry of a committed order with 409 `ordering_closed`.
  if (body.clientOrderId) {
    const existing = await findAppOrderByClientId(
      customer.email,
      body.clientOrderId,
    );
    if (existing) return replayAppOrder(existing, customer);
  }

  // Then the operator's switches: for a NEW order a closed cafe is the answer
  // whatever else the basket has going on, and it costs one settings read.
  const refused = orderingRefusal(
    body.kind,
    body.fulfillment,
    (await getSettings()).mobileApp.ordering,
  );
  if (refused) return { ok: false, failure: refused };

  // A table order names an ACTIVE table, resolved here and snapshotted onto
  // the row (§3): unknown → 400 invalid_table, out of service → 409
  // table_inactive, both before anything is written or charged.
  let table: { code: string; name: string } | null = null;
  if (body.fulfillment === "table") {
    const lookup = await lookupTableLimited(
      body.tableCode,
      await clientIp(),
      customer.id,
    );
    if (!lookup.ok) return { ok: false, failure: tableLookupFailure(lookup) };
    table = lookup.table;
  }

  // A wallet that is switched off has no balance to spend: the same refusal
  // a short balance gets (§18), before anything is written.
  if (body.payWithWallet && !walletPaymentsEnabled()) {
    return {
      ok: false,
      failure: {
        status: 409,
        code: "insufficient_balance",
        message: WALLET_MESSAGES.disabled,
      },
    };
  }

  // Ask for the POS before anything is persisted. `getPaymentProvider()` fails
  // closed on a missing `PAYMENT_PROVIDER`, and it used to be reached only
  // after the order row was written and "siparişin alındı" had been mailed -
  // so a misconfigured deployment answered 500, left a ghost pending order in
  // the kitchen, and locked the member out after three tries.
  try {
    getPaymentProvider();
  } catch (err) {
    console.error("[orders] payment provider unavailable", err);
    return {
      ok: false,
      failure: {
        status: 503,
        code: "payment_unavailable",
        message: MSG.paymentUnavailable,
      },
    };
  }

  // Reclaim the member's own abandoned checkouts BEFORE counting them. The
  // sweep used to run inside `placeAppOrder`, i.e. after this check, and there
  // is no scheduler: three abandoned checkouts on a quiet Sunday locked the
  // member out until some other customer's order happened to sweep their rows.
  try {
    await expireStalePendingOrders();
  } catch (err) {
    console.error("[orders] expiring stale pending orders failed", err);
  }
  const openSince = Date.now() - PENDING_ORDER_TTL_MINUTES * 60_000;
  const open = (
    await customerOrdersByEmail(customer.email, RECENT_ORDER_SCAN)
  ).filter((o) => {
    if (o.status !== "pending_payment") return false;
    // An unreadable timestamp counts: the cap is there to stop a script, and
    // a row of unknown age is not evidence that it has expired.
    const at = Date.parse(o.createdAt);
    return !Number.isFinite(at) || at >= openSince;
  }).length;
  if (open >= MAX_OPEN_ORDERS) {
    return { ok: false, failure: TOO_MANY_PENDING };
  }

  const addressRes = resolveOrderAddress(
    customer.addresses,
    body.fulfillment === "pickup" || body.fulfillment === "table"
      ? null
      : body.address,
  );
  if (!addressRes.ok) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "invalid_address",
        message: addressRes.message,
      },
    };
  }
  const address = addressRes.address;
  const consent = await buildLegalConsent();

  let result: PlaceAppOrderResult;
  try {
    result = await placeAppOrder({
      lines: body.lines,
      fulfillment: body.fulfillment,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: address?.phone || customer.phone,
      shippingAddress: address?.text ?? "",
      deliveryNote: [address?.note ?? "", body.note]
        .filter(Boolean)
        .join(" · "),
      scheduledFor: body.scheduledFor,
      promoCode: body.promoCode,
      legalConsent: consent,
      clientOrderId: body.clientOrderId,
      payWithWallet: body.payWithWallet,
      // The table, snapshotted onto the row (§3).
      ...(table ? { tableCode: table.code, tableName: table.name } : {}),
      // Only a wallet order is held to it (§18); a card checkout re-prices
      // on its own "Tutar değişti" card before anything is charged.
      expectedTotalMinor: body.payWithWallet
        ? body.expectedTotalMinor
        : undefined,
    });
  } catch (err) {
    // The count above is the friendly answer; the database trigger
    // `app_pending_order_cap` is the one that holds when several orders are
    // placed at the same moment (they all counted the same open orders).
    if (
      err instanceof DbQueryError &&
      /TOO_MANY_PENDING_ORDERS/.test(err.message)
    ) {
      return { ok: false, failure: TOO_MANY_PENDING };
    }
    // The other half of the idempotency guard. The lookup above answers a
    // retry sent AFTER the first order committed; two POSTs of the same
    // attempt in flight at once both miss it, and the second insert is then
    // refused by `orders_client_order_id_key`. The index has done its job -
    // there is exactly one order - so hand that one back instead of a 500 the
    // app would retry into a third attempt.
    const duplicate =
      body.clientOrderId && err instanceof DbQueryError && err.code === "23505";
    if (!duplicate) throw err;
    const raced = await findAppOrderByClientId(
      customer.email,
      body.clientOrderId,
    );
    if (!raced) throw err;
    return replayAppOrder(raced, customer);
  }
  if (!result.ok) return { ok: false, failure: failureFromResult(result) };

  let order = result.order;

  // No mail here: the order is not paid yet. "Ödemen alındı" goes out once
  // the payment moves it to paid - a card return, the wallet below or the
  // zero-total settle - from `applyPaymentSucceeded` (operator, 16 Eki 2026:
  // "sipariş maili ödeme tam alınmadan gitmesin").

  let payment: AppPayment | null = null;
  if (body.payWithWallet && order.totalMinor > 0) {
    // Already paid: `wallet_place_order` wrote the spend with the row. This
    // books it the way a card confirmation is booked - `paid`, the stamp,
    // the invite, "ödemen alındı" - and the answer carries no checkout.
    const settled = await settleWalletPayment(order.id);
    if (!settled?.ok) {
      console.error(
        "[orders] booking a wallet payment failed",
        settled ? settled.error : "no spend",
      );
    }
    order = (await getOrder(order.id)) ?? order;
  } else if (order.totalMinor > 0) {
    payment = await createAppPaymentSession(order, customer, consent.ip ?? "");
  } else {
    const settled = await applyPaymentSucceeded({
      orderId: order.id,
      provider: FREE_PROVIDER,
      providerRef: `${FREE_PROVIDER}_${order.id}`,
      amountMinor: 0,
      currency: "TRY",
      raw: { source: "zero_total" },
    });
    if (!settled.ok) {
      console.error(
        "[orders] settling a zero-total order failed",
        settled.error,
      );
    }
    order = (await getOrder(order.id)) ?? order;
  }

  return {
    ok: true,
    order: toMobileOrder(
      order,
      new Date(),
      await stampedOrders(order.customerEmail),
    ),
    payment,
    promoDropped: result.promoDropped,
  };
}

/** `GET /orders` - the member's orders, newest first. */
export async function listAppOrders(
  customer: PublicCustomer,
): Promise<MobileOrder[]> {
  // Same rule as the site's history (lib/customer/member-orders.ts): orders
  // match by e-mail alone, and an admin's phone or counter sale can carry the
  // address of someone who never signed up. Until the address is proven, the
  // list is empty - an unverified member cannot have ordered anyway (POST
  // /orders answers 403 email_unverified).
  if (!customer.emailVerified) return [];
  // The limit belongs in SQL: this used to read the member's entire history -
  // items jsonb, consent evidence and refund ledger included - and throw all
  // but the newest 50 away in JavaScript.
  const [orders, stamped] = await Promise.all([
    customerOrdersByEmail(customer.email, ORDER_LIST_LIMIT),
    stampedOrders(customer.email),
  ]);
  const now = new Date();
  return orders.map((o) => toMobileOrder(o, now, stamped));
}

/** `GET /orders/{id}` - only the owner's; anyone else sees nothing. */
export async function getAppOrder(
  customer: PublicCustomer,
  id: string,
): Promise<MobileOrder | null> {
  if (!customer.emailVerified) return null;
  const order = await getOrder(id);
  if (!order) return null;
  if (
    order.customerEmail.trim().toLowerCase() !==
    customer.email.trim().toLowerCase()
  ) {
    return null;
  }
  return toMobileOrder(order, new Date(), await stampedOrders(customer.email));
}

export type PayAppOrderResult =
  | { ok: true; order: MobileOrder; payment: AppPayment }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_payable"; order: MobileOrder }
  /**
   * The replay refused, answered as-is (§3): too many reopened checkouts
   * (429 `rate_limited`), or the POS could not say whether the last attempt
   * was paid (503 `payment_unavailable`).
   */
  | { ok: false; reason: "refused"; failure: AppFailure };

/**
 * `POST /orders/{id}/payment` - a fresh checkout for the member's own app
 * order that is still awaiting payment (docs/API-MOBILE.md §3).
 *
 * The app could already reopen a checkout, but only by replaying the POST it
 * made with the same `clientOrderId` - which it no longer holds once the
 * member has left the checkout. An order abandoned at the POS then sat as
 * `pending_payment` with no way to pay it, and three of them hit
 * `too_many_pending` and locked the member out of ordering at all until the
 * sweep expired them.
 *
 * This is the same replay by id: `replayAppOrder` asks the POS about the last
 * attempt and only then opens a new provider session against the SAME order.
 * PayNkolay takes a second sale on the same reference, so a payment whose
 * return was lost is booked there instead of being charged again (409
 * `not_payable` with the paid order), and a POS that cannot be asked opens
 * nothing (503 `payment_unavailable`): rule 29's "not knowing is never 'not
 * paid'" holds for a second charge as it does for a cancellation.
 *
 * The read gate is `getAppOrder`'s: the owner, with a verified e-mail, and a
 * stranger's id answers exactly like a missing one. Only an APP order is
 * reopened - a web order has its own checkout and its own return page. An
 * order with nothing to pay (paid, cancelled, ₺0) is `not_payable` with the
 * order as it stands, so the app can redraw it instead of guessing.
 */
export async function payAppOrder(
  customer: PublicCustomer,
  id: string,
): Promise<PayAppOrderResult> {
  if (!customer.emailVerified) return { ok: false, reason: "not_found" };
  const order = await getOrder(id);
  if (
    !order ||
    orderChannel(order) !== "app" ||
    order.customerEmail.trim().toLowerCase() !==
      customer.email.trim().toLowerCase()
  ) {
    return { ok: false, reason: "not_found" };
  }
  if (order.status !== "pending_payment" || order.totalMinor <= 0) {
    return {
      ok: false,
      reason: "not_payable",
      order: toMobileOrder(
        order,
        new Date(),
        await stampedOrders(customer.email),
      ),
    };
  }
  const replay = await replayAppOrder(order, customer);
  if (!replay.ok) {
    // The member's reopen budget is spent, or the POS could not be asked:
    // the replay's own refusal, passed through.
    return { ok: false, reason: "refused", failure: replay.failure };
  }
  // No checkout: the wallet had already paid this order (its spend is written
  // with the row), or the POS held a payment for it and it is booked now - so
  // there is nothing left to pay. The order as it stands.
  if (!replay.payment) {
    return { ok: false, reason: "not_payable", order: replay.order };
  }
  return { ok: true, order: replay.order, payment: replay.payment };
}

// ─── Promo preview ───────────────────────────────────────────────────────

export type PromoPreview =
  | { ok: true; code: string; discountMinor: number }
  | { ok: false; code: string; message: string };

/**
 * The preview plus whether the code turned out to exist.
 *
 * Only a code that does NOT exist is evidence of guessing; a member's own
 * coupon that is under its minimum spend is evidence of a member shopping.
 * The rate limiter needs to tell the two apart, the wire does not.
 */
interface PromoPreviewOutcome {
  preview: PromoPreview;
  found: boolean;
}

async function previewPromoOutcome(
  code: string,
  subtotalMinor: number,
  customer: PublicCustomer | null,
  kind?: "cafe" | "shop",
): Promise<PromoPreviewOutcome> {
  const trimmed = code.trim();
  if (!trimmed) {
    return {
      preview: { ok: false, code: "", message: "Kod gir." },
      found: false,
    };
  }
  if (customer) {
    const coupon = await applyCustomerCoupon(
      trimmed,
      customer.email,
      subtotalMinor,
    );
    if (coupon.ok && coupon.coupon) {
      // Same gate the till applies, from the same predicate.
      if (!couponAllowedForKind(coupon.coupon, kind)) {
        return {
          preview: {
            ok: false,
            code: coupon.coupon.code,
            message: CAFE_ONLY_COUPON_MESSAGE,
          },
          found: true,
        };
      }
      return {
        preview: {
          ok: true,
          code: coupon.coupon.code,
          discountMinor: coupon.discountMinor ?? 0,
        },
        found: true,
      };
    }
    // The member's own coupon, but not usable: say why rather than falling
    // through to "invalid code".
    if (coupon.found) {
      return {
        preview: {
          ok: false,
          code: trimmed,
          message: coupon.error ?? "Kupon kullanılamıyor.",
        },
        found: true,
      };
    }
  }
  const promo = await applyPromoCode(trimmed, subtotalMinor);
  if (!promo.ok) {
    return {
      preview: { ok: false, code: trimmed, message: promo.error },
      // "Geçersiz kod." is the one refusal that means the code is not in the
      // table; everything else (closed, expired, limit reached, under the
      // minimum spend) is a real code the member simply cannot use here.
      found: promo.error !== "Geçersiz kod.",
    };
  }
  return {
    preview: {
      ok: true,
      code: promo.promo.code,
      discountMinor: promo.discountMinor,
    },
    found: true,
  };
}

export type LimitedPromoPreview =
  | { limited: true; retryAfterSeconds: number }
  | { limited: false; preview: PromoPreview };

/**
 * The same preview behind the counter that guards the web form: a code
 * oracle with no limit is a code guesser's best friend.
 *
 * Only a code that does not exist counts as a failure. The basket screen
 * re-prices on every stepper tap while a code is applied, so a member whose
 * coupon is merely under its minimum spend used to burn one of fifteen
 * failures per tap and lock themselves - and, because the bucket was keyed on
 * the IP alone, everyone else on the venue's Wi-Fi - out of promo codes for
 * the window. A signed-in member also gets their own bucket for that reason.
 */
export async function previewPromoRateLimited(
  code: string,
  subtotalMinor: number,
  customer: PublicCustomer | null,
  kind?: "cafe" | "shop",
): Promise<LimitedPromoPreview> {
  const ip = await clientIp();
  const identity = customer?.email ?? "";
  // The cheap early refusal while the bucket is locked out.
  const limit = await checkLoginLimit("promo-preview", ip, identity);
  if (limit.blocked) {
    return { limited: true, retryAfterSeconds: limit.retryAfterSeconds };
  }
  const { preview, found } = await previewPromoOutcome(
    code,
    subtotalMinor,
    customer,
    kind,
  );
  // The check above is not the limit: a burst sent in parallel passes it
  // all at once, and the old "check, look up, then record the miss" order
  // answered every guess in the burst - fifteen per window held only for a
  // caller who waited for each answer (WS1-03, the same race rule 30 closed
  // for sign-in). So each miss is COUNTED before it is answered, atomically
  // (`reserve_auth_attempt`), and a miss past the cap is answered as limited.
  if (!preview.ok && !found) {
    const gate = await reserveLoginAttempt("promo-preview", ip, identity);
    if (gate.blocked) {
      return { limited: true, retryAfterSeconds: gate.retryAfterSeconds };
    }
    return { limited: false, preview };
  }
  // A real code is still not counted - a member re-pricing the basket with
  // their own coupon applied must not lock themselves out - but it is only
  // answered while the bucket is open. Otherwise "limited" would come back
  // for the misses of a burst and a plain answer for its hits, and the
  // limiter itself would say which guesses were real.
  const after = await checkLoginLimit("promo-preview", ip, identity);
  if (after.blocked) {
    return { limited: true, retryAfterSeconds: after.retryAfterSeconds };
  }
  return { limited: false, preview };
}

// ─── Basket preview ──────────────────────────────────────────────────────

export interface AppOrderPreviewLine {
  name: string;
  detail: string;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  /**
   * The KDV rate (whole %) the line would be sold at; the price already
   * includes it. Additive (17 Eki 2026, docs/API-MOBILE.md §3).
   */
  taxRatePct: number;
}

export interface AppOrderPreview {
  lines: AppOrderPreviewLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  promo: PromoPreview | null;
  stampsToEarn: number;
}

export type PreviewAppOrderResult =
  { ok: true; preview: AppOrderPreview } | { ok: false; failure: AppFailure };

/**
 * `POST /orders/preview`: the basket priced exactly as checkout will price
 * it - lines from the database, shipping by fulfillment, the promo tried but
 * not taken. `customer` is optional; without one, personal coupons are not
 * tried.
 */
export async function previewAppOrder(
  body: PreviewOrderBody,
  customer: PublicCustomer | null,
): Promise<PreviewAppOrderResult> {
  // Same gate as `createAppOrder`, so the basket screen learns that the
  // cafe is closed before the customer types an address.
  const settings = await getSettings();
  const refused = orderingRefusal(
    body.kind,
    body.fulfillment,
    settings.mobileApp.ordering,
  );
  if (refused) return { ok: false, failure: refused };
  // Same table gate as the order, so the basket learns about a dead QR
  // before the member reaches the checkout.
  if (body.fulfillment === "table") {
    const lookup = await lookupTableLimited(
      body.tableCode,
      await clientIp(),
      customer?.id,
    );
    if (!lookup.ok) return { ok: false, failure: tableLookupFailure(lookup) };
  }
  // The shop's own switch, which `placeAppOrder` enforces with 409
  // `shop_closed`. The preview used to price a cargo basket regardless, so the
  // basket and the checkout showed a total and a live Pay button over an
  // order the till was going to refuse. Same code, status and message as the
  // order endpoint; the app shows a 4xx preview's own message (W1-03).
  if (body.kind === "shop" && !settings.isShopOpen) {
    return {
      ok: false,
      failure: failureFromResult({ ok: false, reason: "shop_closed" }),
    };
  }

  const linesRes = await previewAppOrderLines(body.lines, settings.taxRates);
  if (!linesRes.ok) {
    return { ok: false, failure: failureFromResult(linesRes.result) };
  }
  const lines: AppOrderPreviewLine[] = linesRes.items.map((it) => ({
    name: it.productName,
    detail: it.detail ?? "",
    qty: it.qty,
    unitPriceMinor: it.unitPriceMinor,
    lineTotalMinor: it.unitPriceMinor * it.qty,
    // Always set: previewAppOrderLines stamps every line it resolves.
    taxRatePct: it.taxRatePct ?? 0,
  }));
  const subtotalMinor = lines.reduce((s, l) => s + l.lineTotalMinor, 0);

  let promo: PromoPreview | null = null;
  if (body.promoCode.trim()) {
    const limited = await previewPromoRateLimited(
      body.promoCode,
      subtotalMinor,
      customer,
      body.kind,
    );
    promo = limited.limited
      ? {
          ok: false,
          code: body.promoCode.trim(),
          message: `Çok fazla deneme. ${limited.retryAfterSeconds} saniye sonra tekrar dene.`,
        }
      : limited.preview;
  }
  const discountMinor = promo?.ok ? promo.discountMinor : 0;

  const totals = computeTotalsWithShipping(
    subtotalMinor,
    discountMinor,
    shippingModeFor(body.fulfillment, settings),
    {
      shippingFlatMinor: settings.shippingFlatMinor,
      shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
    },
  );

  return {
    ok: true,
    preview: {
      lines,
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      shippingMinor: totals.shippingMinor,
      totalMinor: totals.totalMinor,
      promo,
      // Same rule as the award (onOrderPaid): none under ₺140 of goods, then
      // one per started ₺320, courier fee not counted - the summary promises
      // exactly what the paid order will write.
      stampsToEarn:
        linesRes.kind === "cafe"
          ? stampsForOrder({
              totalMinor: totals.totalMinor,
              shippingMinor: totals.shippingMinor,
            })
          : 0,
    },
  };
}
