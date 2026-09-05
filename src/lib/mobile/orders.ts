import "server-only";

import { headers } from "next/headers";

import type { PublicCustomer } from "@/lib/customer/store";

import {
  checkLoginLimit,
  clientIp,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";
import {
  applyPaymentSucceeded,
  applyPromoCode,
  customerOrdersByEmail,
  expireStalePendingOrders,
  findAppOrderByClientId,
  getOrder,
  getSettings,
  placeAppOrder,
  previewAppOrderLines,
  PENDING_ORDER_TTL_MINUTES,
  type AdminOrder,
  type AppOrderFailure,
  type OrderLegalConsent,
} from "@/lib/admin/store";
import { getCardUserKey } from "@/lib/customer/store";
import {
  applyCustomerCoupon,
  couponAllowedForKind,
  CAFE_ONLY_COUPON_MESSAGE,
} from "@/lib/customer/coupons";
import { sendOrderPlacedEmail } from "@/lib/email/send";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";
import { getDb, TABLES } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payment";
import { SITE } from "@/lib/seo/site";

import { resolveOrderAddress } from "./order-address";
import { toMobileOrder, type MobileOrder } from "./order-mapper";
import {
  computeTotalsWithShipping,
  orderingRefusal,
  shippingModeFor,
} from "./order-pricing";
import type { PlaceOrderBody, PreviewOrderBody } from "./order-schema";

/**
 * Order use-cases behind `/api/mobile/v1/orders*` and `/promo/preview`
 * (docs/API-MOBILE.md §3, §5). Route handlers parse and authorise; this is
 * where the pieces are put together. Money and stock decisions stay in the
 * store — nothing here prices a line.
 */

/** A refusal the route turns into `{ error, message }` with this status. */
export interface AppFailure {
  status: number;
  code: string;
  message: string;
}

/** How many orders `GET /orders` returns, newest first. */
export const ORDER_LIST_LIMIT = 50;

/** Provider name recorded on a checkout that owed nothing. */
const FREE_PROVIDER = "free";

const MSG = {
  shopClosed: "Mağaza şu an sipariş almıyor.",
  cafeClosed: "Köşk şu an kapalı — açılış saatlerinde tekrar dene.",
  empty: "Sepet boş.",
  paymentUnavailable:
    "Ödeme altyapısına şu an ulaşılamıyor. Birazdan tekrar dene.",
} as const;

/**
 * How many of the member's newest orders the open-checkout count looks at.
 *
 * `MAX_OPEN_ORDERS` is 3 and only orders younger than the expiry window
 * count, so a page of recent rows is always enough — and it keeps a regular's
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
  }
}

/**
 * The durable record that the member confirmed the Ön Bilgilendirme Formu
 * and the Mesafeli Satış Sözleşmesi — same shape the web checkout writes,
 * so a chargeback review reads one format.
 */
async function buildLegalConsent(): Promise<OrderLegalConsent> {
  const h = await headers();
  return {
    acceptedAt: new Date().toISOString(),
    documents: [...CHECKOUT_CONSENT_DOCS],
    version: LEGAL_UPDATED,
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
  // Saved cards: hand the provider the member's key so its form lists the
  // cards they saved before. Empty on a first order, which is exactly right.
  const cardUserKey = await getCardUserKey(customer.email);
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

/**
 * Remembers which checkout reference was opened for the order.
 *
 * The in-app browser carries no site cookie, so /odeme/donus cannot tie a
 * mock return to a signed-in member the way it does on the web. What it can
 * check is that the reference on the return URL is the one this server
 * issued — kept as a `pending` transaction whose reference is prefixed so it
 * never collides with the `succeeded` row the confirmation inserts. A real
 * POS settles by signed webhook; this row is then only an audit breadcrumb.
 */
async function recordPendingCheckout(
  orderId: string,
  provider: string,
  providerRef: string,
): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.paymentTransactions)
    .insert({
      orderId,
      provider,
      providerRef: pendingCheckoutRef(providerRef),
      status: "pending",
      amountMinor: 0,
      currency: "TRY",
      raw: { source: "app_checkout" },
      createdAt: new Date().toISOString(),
    });
  if (error && error.code !== "23505") {
    console.error(`[orders] pending checkout record failed: ${error.message}`);
  }
}

export function pendingCheckoutRef(providerRef: string): string {
  return `pending:${providerRef}`;
}

/** True when `providerRef` is the reference this server opened for the order. */
export async function isIssuedCheckoutRef(
  orderId: string,
  provider: string,
  providerRef: string,
): Promise<boolean> {
  if (!providerRef) return false;
  const { data, error } = await getDb()
    .from(TABLES.paymentTransactions)
    .select("orderId")
    .eq("orderId", orderId)
    .eq("provider", provider)
    .eq("providerRef", pendingCheckoutRef(providerRef))
    .limit(1);
  if (error) {
    console.error(`[orders] checkout ref lookup failed: ${error.message}`);
    return false;
  }
  return ((data as unknown[] | null) ?? []).length > 0;
}

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
 * session at the provider and — for shop lines — holds stock for the whole
 * 45-minute expiry window. Three covers a customer who abandons a checkout
 * and starts over twice; past that it is a script, not a shopper.
 */
export const MAX_OPEN_ORDERS = 3;

/**
 * Answers a repeated checkout attempt with the order it already produced.
 *
 * An order still awaiting payment gets a fresh checkout session rather than
 * the first one's URL: provider sessions expire (30 minutes), and opening a
 * second one against the same order is safe — `applyPaymentSucceeded` is
 * idempotent and the order can only advance once. An order that has since
 * been paid or cancelled has nothing to pay, so `payment` is null and the app
 * shows it as it stands.
 */
async function replayAppOrder(
  order: AdminOrder,
  customer: PublicCustomer,
): Promise<CreateAppOrderResult> {
  let payment: AppPayment | null = null;
  if (order.status === "pending_payment" && order.totalMinor > 0) {
    try {
      payment = await createAppPaymentSession(order, customer, "");
    } catch (err) {
      // The order exists either way; failing to reopen the POS must not make
      // the app place a second one.
      console.error("[orders] reopening checkout for a retry failed", err);
    }
  }
  return {
    ok: true,
    order: toMobileOrder(order),
    payment,
    promoDropped: false,
  };
}

export async function createAppOrder(
  customer: PublicCustomer,
  body: PlaceOrderBody,
): Promise<CreateAppOrderResult> {
  // The operator's switches first: a closed cafe is the answer whatever
  // else the basket has going on, and it costs one settings read.
  const refused = orderingRefusal(
    body.kind,
    body.fulfillment,
    (await getSettings()).mobileApp.ordering,
  );
  if (refused) return { ok: false, failure: refused };

  // Ask for the POS before anything is persisted. `getPaymentProvider()` fails
  // closed on a missing `PAYMENT_PROVIDER`, and it used to be reached only
  // after the order row was written and "siparişin alındı" had been mailed —
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

  // The member's own retry is not a second order. The app repeats the id it
  // generated for this checkout attempt, so a POST it gave up on — while the
  // server was still mailing the confirmation and opening the checkout
  // session — answers with the order that first call created.
  if (body.clientOrderId) {
    const existing = await findAppOrderByClientId(
      customer.email,
      body.clientOrderId,
    );
    if (existing) return replayAppOrder(existing, customer);
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
    return {
      ok: false,
      failure: {
        status: 429,
        code: "too_many_pending",
        // Not "iptal et": the app has no way to cancel an order.
        message: `Ödemesi tamamlanmamış siparişlerin var. Ödemeyi tamamla ya da ${PENDING_ORDER_TTL_MINUTES} dakika sonra tekrar dene.`,
      },
    };
  }

  const addressRes = resolveOrderAddress(
    customer.addresses,
    body.fulfillment === "pickup" ? null : body.address,
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

  const result = await placeAppOrder({
    lines: body.lines,
    fulfillment: body.fulfillment,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: address?.phone || customer.phone,
    shippingAddress: address?.text ?? "",
    deliveryNote: [address?.note ?? "", body.note].filter(Boolean).join(" · "),
    scheduledFor: body.scheduledFor,
    promoCode: body.promoCode,
    legalConsent: consent,
    clientOrderId: body.clientOrderId,
  });
  if (!result.ok) return { ok: false, failure: failureFromResult(result) };

  let order = result.order;

  // Best-effort "order received" e-mail, exactly as the web checkout sends.
  try {
    await sendOrderPlacedEmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderNo: order.orderNo,
      items: order.items.map((it) => ({
        productName: it.detail
          ? `${it.productName} (${it.detail})`
          : it.productName,
        qty: it.qty,
        unitPriceMinor: it.unitPriceMinor,
      })),
      totalMinor: order.totalMinor,
    });
  } catch (err) {
    console.error("[email] order placed notification failed", err);
  }

  let payment: AppPayment | null = null;
  if (order.totalMinor > 0) {
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
    order: toMobileOrder(order),
    payment,
    promoDropped: result.promoDropped,
  };
}

/** `GET /orders` — the member's orders, newest first. */
export async function listAppOrders(
  customer: PublicCustomer,
): Promise<MobileOrder[]> {
  // The limit belongs in SQL: this used to read the member's entire history —
  // items jsonb, consent evidence and refund ledger included — and throw all
  // but the newest 50 away in JavaScript.
  const orders = await customerOrdersByEmail(customer.email, ORDER_LIST_LIMIT);
  return orders.map((o) => toMobileOrder(o));
}

/** `GET /orders/{id}` — only the owner's; anyone else sees nothing. */
export async function getAppOrder(
  customer: PublicCustomer,
  id: string,
): Promise<MobileOrder | null> {
  const order = await getOrder(id);
  if (!order) return null;
  if (
    order.customerEmail.trim().toLowerCase() !==
    customer.email.trim().toLowerCase()
  ) {
    return null;
  }
  return toMobileOrder(order);
}

// ─── Promo preview ───────────────────────────────────────────────────────

export type PromoPreview =
  | { ok: true; code: string; discountMinor: number }
  | { ok: false; code: string; message: string };

/**
 * Previews a code WITHOUT taking a use: a member's personal coupon first,
 * then the shared promo codes — the order the checkout applies them in.
 *
 * `kind` is what the basket is. It matters because a free-drink coupon is
 * cafe-only at the till; previewing without it told a member with a shop
 * basket that ₺280 was coming off, and then checkout charged full price.
 */
export async function previewPromo(
  code: string,
  subtotalMinor: number,
  customer: PublicCustomer | null,
  kind?: "cafe" | "shop",
): Promise<PromoPreview> {
  return (await previewPromoOutcome(code, subtotalMinor, customer, kind))
    .preview;
}

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
 * failures per tap and lock themselves — and, because the bucket was keyed on
 * the IP alone, everyone else on the venue's Wi-Fi — out of promo codes for
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
  if (!preview.ok && !found) {
    await recordLoginFailure("promo-preview", ip, identity);
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
  | { ok: true; preview: AppOrderPreview }
  | { ok: false; failure: AppFailure };

/**
 * `POST /orders/preview`: the basket priced exactly as checkout will price
 * it — lines from the database, shipping by fulfillment, the promo tried but
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

  const linesRes = await previewAppOrderLines(body.lines);
  if (!linesRes.ok) {
    return { ok: false, failure: failureFromResult(linesRes.result) };
  }
  const lines: AppOrderPreviewLine[] = linesRes.items.map((it) => ({
    name: it.productName,
    detail: it.detail ?? "",
    qty: it.qty,
    unitPriceMinor: it.unitPriceMinor,
    lineTotalMinor: it.unitPriceMinor * it.qty,
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
      taxRatePct: settings.taxRatePct,
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
      stampsToEarn: linesRes.kind === "cafe" ? 1 : 0,
    },
  };
}
