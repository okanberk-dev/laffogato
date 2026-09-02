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
  getOrder,
  getSettings,
  placeAppOrder,
  previewAppOrderLines,
  type AdminOrder,
  type AppOrderFailure,
  type OrderLegalConsent,
} from "@/lib/admin/store";
import { applyCustomerCoupon } from "@/lib/customer/coupons";
import { sendOrderPlacedEmail } from "@/lib/email/send";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";
import { getDb, TABLES } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payment";
import { SITE } from "@/lib/seo/site";

import { resolveOrderAddress } from "./order-address";
import { toMobileOrder, type MobileOrder } from "./order-mapper";
import { computeTotalsWithShipping, shippingModeFor } from "./order-pricing";
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
} as const;

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

export async function createAppOrder(
  customer: PublicCustomer,
  body: PlaceOrderBody,
): Promise<CreateAppOrderResult> {
  const open = (await customerOrdersByEmail(customer.email)).filter(
    (o) => o.status === "pending_payment",
  ).length;
  if (open >= MAX_OPEN_ORDERS) {
    return {
      ok: false,
      failure: {
        status: 429,
        code: "too_many_pending",
        message:
          "Ödemesi tamamlanmamış siparişlerin var. Önce onları tamamla ya da iptal et.",
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
  const orders = await customerOrdersByEmail(customer.email);
  return orders.slice(0, ORDER_LIST_LIMIT).map((o) => toMobileOrder(o));
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
 */
export async function previewPromo(
  code: string,
  subtotalMinor: number,
  customer: PublicCustomer | null,
): Promise<PromoPreview> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, code: "", message: "Kod gir." };
  if (customer) {
    const coupon = await applyCustomerCoupon(
      trimmed,
      customer.email,
      subtotalMinor,
    );
    if (coupon.ok && coupon.coupon) {
      return {
        ok: true,
        code: coupon.coupon.code,
        discountMinor: coupon.discountMinor ?? 0,
      };
    }
    // The member's own coupon, but not usable: say why rather than falling
    // through to "invalid code".
    if (coupon.found) {
      return {
        ok: false,
        code: trimmed,
        message: coupon.error ?? "Kupon kullanılamıyor.",
      };
    }
  }
  const promo = await applyPromoCode(trimmed, subtotalMinor);
  if (!promo.ok) return { ok: false, code: trimmed, message: promo.error };
  return {
    ok: true,
    code: promo.promo.code,
    discountMinor: promo.discountMinor,
  };
}

export type LimitedPromoPreview =
  | { limited: true; retryAfterSeconds: number }
  | { limited: false; preview: PromoPreview };

/**
 * The same preview behind the counter that guards the web form: a code
 * oracle with no limit is a code guesser's best friend. Failures count, a
 * customer mistyping their own coupon has plenty of room.
 */
export async function previewPromoRateLimited(
  code: string,
  subtotalMinor: number,
  customer: PublicCustomer | null,
): Promise<LimitedPromoPreview> {
  const ip = await clientIp();
  const limit = await checkLoginLimit("promo-preview", ip, "");
  if (limit.blocked) {
    return { limited: true, retryAfterSeconds: limit.retryAfterSeconds };
  }
  const preview = await previewPromo(code, subtotalMinor, customer);
  if (!preview.ok) await recordLoginFailure("promo-preview", ip, "");
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

  const settings = await getSettings();
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
