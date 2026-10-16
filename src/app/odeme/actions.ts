"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  applyPaymentSucceeded,
  applyPromoCode,
  getOrder,
  isOwnUnpaidWebOrder,
  placeOrder,
  type AdminOrder,
  type PlaceOrderFailure,
} from "@/lib/admin/store";
import { clientIp, reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { checkoutCartKey, type CartKeyInput } from "@/lib/checkout/cart-key";
import { REUSE_HEADROOM_MS, reuseDecision } from "@/lib/checkout/reuse";
import type {
  CheckoutQuote,
  CheckoutStart,
  SavedCardsChange,
} from "@/lib/checkout/start";
import {
  parseCheckoutFields,
  parseReuseClaim,
} from "@/lib/checkout/start-schema";
import { getActiveCustomer } from "@/lib/customer/auth";
import {
  applyCustomerCoupon,
  CAFE_ONLY_COUPON_MESSAGE,
  couponAllowedForKind,
  evaluateCoupon,
} from "@/lib/customer/coupons";
import { ensureCardUserKey } from "@/lib/customer/store";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import { checkoutConsentVersion } from "@/lib/legal/store";
import { getPaymentProvider } from "@/lib/payment";
import { PaynkolayPaymentProvider } from "@/lib/payment/paynkolay";
import { deleteCheckoutSavedCard } from "@/lib/payment/saved-cards";
import { SITE } from "@/lib/seo/site";

export interface PromoPreviewState {
  error?: string;
  ok?: { code: string; discountMinor: number; finalMinor: number };
}

export async function previewPromoAction(
  _prev: PromoPreviewState,
  formData: FormData,
): Promise<PromoPreviewState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Kod gir." };

  // Unauthenticated and previously unlimited: the form answered "geçersiz kod"
  // or a real discount, which is a working oracle for guessing codes. The same
  // counter that guards the login forms bounds it - generously, because a
  // customer mistyping their own coupon is the common case.
  //
  // Reserved (counted before the lookup), not checked here and recorded on a
  // miss: a burst sent in parallel all passed the check before the first miss
  // was written, so the cap bounded nothing for a script. A hit counts too and
  // is never cleared - clearing on a valid code would let anyone holding one
  // public campaign code reset the counter between guesses.
  const ip = await clientIp();
  const limit = await reserveLoginAttempt("promo-preview", ip, "");
  if (limit.blocked) {
    return {
      error: `Çok fazla deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }

  const subtotal = parseFloat(
    String(formData.get("subtotal") ?? "0").replace(",", "."),
  );
  const subtotalMinor = Number.isFinite(subtotal)
    ? Math.round(subtotal * 100)
    : 0;
  // A logged-in member's personal coupon wins over a global promo with the same
  // string. If the coupon is theirs but invalid (used/expired/under minimum) we
  // surface that reason; only a "not mine" miss falls through to global promos.
  const customer = await getActiveCustomer();
  if (customer) {
    const coupon = await applyCustomerCoupon(
      code,
      customer.email,
      subtotalMinor,
    );
    let ok = coupon.ok ? coupon : null;
    // Claimed by the member's own unpaid web checkout - the one a declined
    // card left behind. That order gives it back before the next one claims
    // it (supersedeUnpaidWebOrders), or the retry pays for that very order,
    // so it is not "already used" for this customer.
    if (
      !ok &&
      coupon.found &&
      coupon.coupon?.redeemedAt &&
      (await isOwnUnpaidWebOrder(customer.email, coupon.coupon.redeemedOrderNo))
    ) {
      const held = evaluateCoupon(
        { ...coupon.coupon, redeemedAt: "" },
        subtotalMinor,
        Date.now(),
      );
      if (!held.ok) return { error: held.error };
      ok = { ...coupon, ok: true, discountMinor: held.discountMinor };
    }
    if (ok?.coupon) {
      // The web sells shop goods only; a drink coupon would be dropped from
      // the order (insertOrderRow) after the preview had promised it.
      if (!couponAllowedForKind(ok.coupon, undefined)) {
        return { error: CAFE_ONLY_COUPON_MESSAGE };
      }
      const discountMinor = ok.discountMinor ?? 0;
      return {
        ok: {
          code: ok.coupon.code,
          discountMinor,
          finalMinor: Math.max(0, subtotalMinor - discountMinor),
        },
      };
    }
    if (coupon.found) return { error: coupon.error };
  }
  const result = await applyPromoCode(code, subtotalMinor);
  if (!result.ok) return { error: result.error };
  return {
    ok: {
      code: result.promo.code,
      discountMinor: result.discountMinor,
      finalMinor: Math.max(0, subtotalMinor - result.discountMinor),
    },
  };
}

interface ClientCartItem {
  productId?: string;
  variantId?: string;
  name: string;
  /** Major units (₺) as the design's `Product.price` stores them. */
  price: number;
  qty: number;
}

function parseItems(raw: string): ClientCartItem[] {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: ClientCartItem[] = [];
    for (const it of data as unknown[]) {
      if (typeof it !== "object" || it === null) continue;
      const o = it as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : null;
      const price = typeof o.price === "number" ? o.price : Number(o.price);
      const qty = typeof o.qty === "number" ? o.qty : Number(o.qty ?? 1);
      // Whole units only: a tampered `qty: 1.5` reached `(qty)::int` in
      // claim_order_stock and came back as an uncaught 500.
      if (
        !name ||
        !Number.isFinite(price) ||
        !Number.isInteger(qty) ||
        qty <= 0
      ) {
        continue;
      }
      out.push({
        productId: typeof o.productId === "string" ? o.productId : undefined,
        variantId: typeof o.variantId === "string" ? o.variantId : undefined,
        name,
        price,
        qty,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Builds the durable record proving the customer confirmed the Ön Bilgilendirme
 * Formu and the Mesafeli Satış Sözleşmesi before the order was created - the
 * evidence Mesafeli Sözleşmeler Yönetmeliği requires and an acquiring bank asks
 * for on a chargeback. Returns `null` when the box was not ticked.
 */
async function readLegalConsent(formData: FormData) {
  if (String(formData.get("legalConsent") ?? "") !== "on") return null;
  const h = await headers();
  return {
    acceptedAt: new Date().toISOString(),
    documents: [...CHECKOUT_CONSENT_DOCS],
    version: await checkoutConsentVersion(),
    ip: await clientIp(),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

/** The order as created, for the browser to compare with what it showed. */
function quoteOf(
  order: AdminOrder,
  submitted: CartKeyInput,
  promoDropped: boolean,
): CheckoutQuote {
  return {
    orderId: order.id,
    // The order's own key: with the code as it was APPLIED, so a code that
    // was dropped does not make the next press look like a changed basket.
    cartKey: checkoutCartKey({ ...submitted, promoCode: order.promoCode }),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    promoCode: order.promoCode,
    promoDropped,
    lines: order.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      unitPriceMinor: it.unitPriceMinor,
      qty: it.qty,
    })),
  };
}

/** A refused basket, said on the checkout itself (fixed copy, our names). */
function cartRefusal(result: PlaceOrderFailure): CheckoutStart {
  const name = "productName" in result ? result.productName : "";
  let message: string;
  switch (result.reason) {
    case "out_of_stock":
      message =
        result.available > 0
          ? `${name} için yeterli stok kalmadı (en çok ${result.available} adet). Adedi azaltıp yeniden dene.`
          : `${name} şu an stokta yok. Sepetten çıkarıp yeniden dene.`;
      break;
    case "not_found":
      message = `${name} artık satışta değil. Sepetten çıkarıp yeniden dene.`;
      break;
    case "qty_too_high":
      message = `${name} için en çok ${result.max} adet sipariş verebilirsin.`;
      break;
    case "shop_closed":
      message = "Mağaza şu an sipariş almıyor. Birazdan yeniden dene.";
      break;
    case "empty":
      message = "Sepetin boş görünüyor. Mağazadan ürün ekleyip yeniden dene.";
      break;
  }
  return { kind: "error", error: { code: "cart", message } };
}

const UNAVAILABLE: CheckoutStart = {
  kind: "error",
  error: {
    code: "unavailable",
    message:
      "Ödeme şu an başlatılamadı ve kartından para çekilmedi. Birazdan yeniden dene.",
  },
};

/**
 * "Siparişi onayla ve öde" on /odeme: creates the order - or reuses the one
 * an earlier, unpaid attempt created - and answers with what the browser
 * needs for the next step (docs/PAYNKOLAY.md §15.5).
 *
 * The card never comes here. It is typed in the page's native pay form,
 * which posts straight to /odeme/paynkolay once this answers `card` with the
 * order's sealed payment payload; this action reads only the separate order
 * form (`tests/saved-cards.test.ts` keeps card names out of this file).
 */
export async function startCheckoutAction(
  formData: FormData,
): Promise<CheckoutStart> {
  // Siparişler yalnızca e-postası doğrulanmış hesaplarla verilebilir.
  const customer = await getActiveCustomer();
  if (!customer) {
    return { kind: "redirect", url: "/uye/giris?next=/odeme" };
  }
  if (!customer.emailVerified) {
    return { kind: "redirect", url: "/odeme?verify=required" };
  }

  // Every press can create an order: a stock and coupon claim and
  // POS lookups for the member's older unpaid orders. Counted first, success
  // or not, per member (rate-limit.ts, "checkout-start").
  const budget = await reserveLoginAttempt(
    "checkout-start",
    "",
    customer.email,
  );
  if (budget.blocked) {
    const minutes = Math.max(1, Math.ceil(budget.retryAfterSeconds / 60));
    return {
      kind: "error",
      error: {
        code: "limit",
        minutes,
        message: `Çok fazla deneme yapıldı. ${minutes} dakika sonra yeniden dene.`,
      },
    };
  }

  const items = parseItems(String(formData.get("items") ?? "[]"));
  if (items.length === 0) return cartRefusal({ ok: false, reason: "empty" });

  // No confirmation, no contract: the order is never created. The button is
  // disabled until both boxes are ticked and the hidden field exists only
  // then, so reaching this branch means a tampered or scripted submit.
  const legalConsent = await readLegalConsent(formData);
  if (!legalConsent) {
    return {
      kind: "error",
      error: {
        code: "consent",
        message:
          "Siparişi tamamlamak için Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni onaylaman gerekiyor.",
      },
    };
  }

  const parsed = parseCheckoutFields({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    shippingAddress: formData.get("shippingAddress"),
    promoCode: formData.get("promoCode"),
  });
  if (!parsed.ok) {
    return {
      kind: "error",
      error: { code: "delivery", field: parsed.field, message: parsed.message },
    };
  }
  const fields = parsed.fields;
  const submitted: CartKeyInput = {
    items: items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      qty: it.qty,
    })),
    customerName: fields.customerName,
    customerPhone: fields.customerPhone,
    shippingAddress: fields.shippingAddress,
    promoCode: fields.promoCode,
  };

  // The provider is resolved BEFORE the order exists. It used to be looked
  // up after placeOrder and the "siparişin alındı" mail, so a misconfigured
  // deployment (PAYMENT_PROVIDER unset or mock in production - rule 17)
  // left a pending order holding stock and a mailed customer behind a 500.
  // The app path already worked this way.
  let provider: ReturnType<typeof getPaymentProvider>;
  try {
    provider = getPaymentProvider();
  } catch (err) {
    console.error(
      "[odeme] payment provider unavailable",
      err instanceof Error ? err.message : "unknown",
    );
    return UNAVAILABLE;
  }
  const direct =
    provider instanceof PaynkolayPaymentProvider &&
    provider.checkoutMode === "direct"
      ? provider
      : null;

  // A retry after a decline: the same order, if the browser's claim holds
  // in every respect (src/lib/checkout/reuse.ts). Nothing is claimed or
  // minted again; the payload handed back is the one the order got.
  const claim = parseReuseClaim({
    reuseOrderId: formData.get("reuseOrderId"),
    reuseData: formData.get("reuseData"),
    reuseSignature: formData.get("reuseSignature"),
    reuseCartKey: formData.get("reuseCartKey"),
  });
  if (claim && direct) {
    const post = direct.readBridgePost(claim.data, claim.signature);
    const fresh =
      !!post &&
      direct.isBridgeFresh(post, new Date(Date.now() + REUSE_HEADROOM_MS));
    let order: AdminOrder | null = null;
    if (post && fresh && post.fields.clientRefCode === claim.orderId) {
      try {
        order = await getOrder(claim.orderId);
      } catch (err) {
        console.error(
          `[odeme] pending order unreadable order=${claim.orderId}`,
          err instanceof Error ? err.message : "unknown",
        );
      }
    }
    const decision = reuseDecision({
      claim: { orderId: claim.orderId, cartKey: claim.cartKey },
      payload: post
        ? {
            clientRefCode: post.fields.clientRefCode,
            amount: post.fields.amount,
          }
        : null,
      fresh,
      order,
      customerEmail: customer.email,
      submitted,
    });
    if (decision.reuse && order) {
      return {
        kind: "card",
        d: claim.data,
        s: claim.signature,
        quote: quoteOf(order, submitted, false),
      };
    }
    console.info(
      `[odeme] new order instead of reuse order=${claim.orderId} reason=${decision.reuse ? "unread" : decision.reason}`,
    );
  }

  let result: Awaited<ReturnType<typeof placeOrder>>;
  try {
    result = await placeOrder({
      items: items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId,
        name: it.name,
        priceMinor: Math.round(it.price * 100),
        qty: it.qty,
      })),
      customerName: fields.customerName,
      // Doğrulanmış hesabın e-postası yetkilidir (client değeri yok sayılır).
      customerEmail: customer.email,
      customerPhone: fields.customerPhone,
      shippingAddress: fields.shippingAddress,
      promoCode: fields.promoCode || undefined,
      legalConsent,
    });
  } catch (err) {
    console.error(
      "[odeme] placing the order failed",
      err instanceof Error ? err.message : "unknown",
    );
    return UNAVAILABLE;
  }
  if (!result.ok) return cartRefusal(result);

  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  revalidatePath("/");

  const order = result.order;

  // No "siparişin alındı" mail here: the order is not paid yet, and a
  // declined card used to leave one such mail per attempt. The customer's
  // mail goes out once the payment moves the order to paid
  // (`applyPaymentSucceeded` → `notifyOrderPaid`); the zero-total settle
  // below goes through the same door.

  const quote = quoteOf(order, submitted, result.promoDropped);
  const promoQuery = result.promoDropped ? "?promo=dropped" : "";

  // Nothing to collect: a 100% promo, or a fixed coupon at least as large as
  // the basket (shipping is waived at a zero net). The POS refuses a 0.00
  // charge and confirmReturn rejects any amount <= 0, so these orders could
  // never complete and expired after 45 minutes. Settle them here, the way
  // POST /api/mobile/v1/orders already does.
  if (order.totalMinor === 0) {
    const settled = await applyPaymentSucceeded({
      orderId: order.id,
      provider: "free",
      providerRef: `free_${order.id}`,
      amountMinor: 0,
      currency: "TRY",
      raw: { source: "zero_total" },
    });
    if (!settled.ok) {
      console.error(
        "[odeme] settling a zero-total order failed",
        settled.error,
      );
    }
    const promoParam = result.promoDropped ? "&promo=dropped" : "";
    return {
      kind: "paid",
      url: `/odeme/basarili?ref=${encodeURIComponent(order.id)}${promoParam}`,
    };
  }

  try {
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
      billingAddress: { city: "", district: "", line1: order.shippingAddress },
      shippingAddress: { city: "", district: "", line1: order.shippingAddress },
      items: order.items.map((it) => ({
        productId: "",
        name: it.productName,
        unitPriceMinor: it.unitPriceMinor,
        quantity: it.qty,
      })),
      successUrl: `${SITE.url}/odeme/donus${promoQuery}`,
      failureUrl: `${SITE.url}/odeme?error=payment`,
      buyerIp: legalConsent.ip,
      // The same saved cards as in the app: one member, one set of cards,
      // whichever surface they check out from (docs/PAYNKOLAY.md §16). No
      // key is minted while PayNkolay has not granted card storage.
      cardUserKey: direct?.cardStorageEnabled
        ? (await ensureCardUserKey(customer.email)) || undefined
        : undefined,
    });
    if (!direct) {
      return { kind: "redirect", url: session.redirectUrl, quote };
    }
    // The card form posts the payload itself; the bridge URL's host (from
    // PAYNKOLAY_SUCCESS_URL) is not used, so www and apex both work.
    const bridge = new URL(session.redirectUrl);
    const d = bridge.searchParams.get("d") ?? "";
    const s = bridge.searchParams.get("s") ?? "";
    if (!d || !s) throw new Error("checkout session carries no payload");
    return { kind: "card", d, s, quote };
  } catch (err) {
    console.error(
      `[odeme] payment session failed order=${order.id}`,
      err instanceof Error ? err.message : "unknown",
    );
    return UNAVAILABLE;
  }
}

/**
 * Deletes one of the signed-in member's cards saved at PayNkolay, from the
 * checkout's list. The member's key is the signed-in account's own
 * (`deleteCheckoutSavedCard`); the browser only names the card by `tranId`.
 * Counted per member: each delete is two calls to the POS.
 */
export async function deleteSavedCardAction(
  formData: FormData,
): Promise<SavedCardsChange> {
  const customer = await getActiveCustomer();
  if (!customer || !customer.emailVerified) {
    return {
      ok: false,
      message:
        "Oturumun kapanmış görünüyor. Sayfayı yenileyip yeniden giriş yap.",
    };
  }
  const tranId = String(formData.get("tranId") ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(tranId)) {
    return { ok: false, message: "Silinecek kart bulunamadı." };
  }
  const budget = await reserveLoginAttempt("card-delete", "", customer.email);
  if (budget.blocked) {
    const minutes = Math.max(1, Math.ceil(budget.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `Çok fazla deneme yapıldı. ${minutes} dakika sonra yeniden dene.`,
    };
  }
  const result = await deleteCheckoutSavedCard(customer.email, tranId);
  if (result.ok) return { ok: true, cards: result.cards };
  return {
    ok: false,
    message:
      result.reason === "not_found"
        ? "Silinecek kart bulunamadı."
        : "Kart şu an silinemedi. Birazdan yeniden dene.",
  };
}
