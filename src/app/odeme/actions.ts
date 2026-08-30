"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { applyPromoCode, placeOrder } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { applyCustomerCoupon } from "@/lib/customer/coupons";
import { sendOrderPlacedEmail } from "@/lib/email/send";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";
import { getCardUserKey } from "@/lib/customer/store";
import { getPaymentProvider } from "@/lib/payment";
import { SITE } from "@/lib/seo/site";
import {
  checkLoginLimit,
  clientIp,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";

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
  // counter that guards the login forms bounds it — generously, because a
  // customer mistyping their own coupon is the common case.
  const ip = await clientIp();
  const limit = await checkLoginLimit("promo-preview", ip, "");
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
    if (coupon.ok && coupon.coupon) {
      const discountMinor = coupon.discountMinor ?? 0;
      return {
        ok: {
          code: coupon.coupon.code,
          discountMinor,
          finalMinor: Math.max(0, subtotalMinor - discountMinor),
        },
      };
    }
    if (coupon.found) return { error: coupon.error };
  }
  const result = await applyPromoCode(code, subtotalMinor);
  if (!result.ok) {
    await recordLoginFailure("promo-preview", ip, "");
    return { error: result.error };
  }
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
      if (
        !name ||
        !Number.isFinite(price) ||
        !Number.isFinite(qty) ||
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
 * Formu and the Mesafeli Satış Sözleşmesi before the order was created — the
 * evidence Mesafeli Sözleşmeler Yönetmeliği requires and an acquiring bank asks
 * for on a chargeback. Returns `null` when the box was not ticked.
 */
async function readLegalConsent(formData: FormData) {
  if (String(formData.get("legalConsent") ?? "") !== "on") return null;
  const h = await headers();
  return {
    acceptedAt: new Date().toISOString(),
    documents: [...CHECKOUT_CONSENT_DOCS],
    version: LEGAL_UPDATED,
    ip: await clientIp(),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

export async function placeOrderAction(formData: FormData) {
  // Siparişler yalnızca e-postası doğrulanmış hesaplarla verilebilir.
  const customer = await getActiveCustomer();
  if (!customer) {
    redirect("/uye/giris?next=/odeme");
  }
  if (!customer.emailVerified) {
    redirect("/odeme?verify=required");
  }

  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (items.length === 0) {
    redirect("/?cart=empty");
  }

  // No confirmation, no contract: the order is never created. The checkbox is
  // also `required` client-side, so reaching this branch means a tampered or
  // scripted submit.
  const legalConsent = await readLegalConsent(formData);
  if (!legalConsent) {
    redirect("/odeme?error=consent");
  }

  const result = await placeOrder({
    items: items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      priceMinor: Math.round(it.price * 100),
      qty: it.qty,
    })),
    customerName:
      String(formData.get("customerName") ?? "") || customer.name || undefined,
    // Doğrulanmış hesabın e-postası yetkilidir (client değeri override edilir).
    customerEmail: customer.email,
    customerPhone:
      String(formData.get("customerPhone") ?? "") ||
      customer.phone ||
      undefined,
    shippingAddress: String(formData.get("shippingAddress") ?? "") || undefined,
    promoCode: String(formData.get("promoCode") ?? "") || undefined,
    legalConsent,
  });

  if (!result.ok) {
    if (result.reason === "empty") redirect("/?cart=empty");
    const params = new URLSearchParams({
      cart: result.reason,
      item: "productName" in result ? result.productName : "",
      // `available` doubles as the numeric detail for the notice: the stock
      // left, or the per-line cap.
      available:
        "available" in result
          ? String(result.available)
          : "max" in result
            ? String(result.max)
            : "",
    });
    redirect(`/?${params.toString()}`);
  }

  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  revalidatePath("/");

  // Hand off to the payment provider. The order is `pending_payment`; the
  // provider's checkout settles it (mock → /odeme/donus auto-confirms in dev,
  // a real POS → its signed webhook). We redirect the customer to the
  // provider's `redirectUrl`. The promo-dropped flag rides through the return
  // URL so the success page can still warn.
  const order = result.order;

  // Best-effort "order received" e-mail (logs in dev when Resend is unset).
  try {
    await sendOrderPlacedEmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderNo: order.orderNo,
      items: order.items.map((it) => ({
        productName: it.productName,
        qty: it.qty,
        unitPriceMinor: it.unitPriceMinor,
      })),
      totalMinor: order.totalMinor,
    });
  } catch (err) {
    console.error("[email] order placed notification failed", err);
  }

  const promoQuery = result.promoDropped ? "?promo=dropped" : "";
  const provider = getPaymentProvider();
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
    // whichever surface they check out from.
    cardUserKey: (await getCardUserKey(customer.email)) || undefined,
  });

  redirect(session.redirectUrl);
}
