"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { applyPromoCode, getSettings, placeOrder } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { applyCustomerCoupon } from "@/lib/customer/coupons";
import { sendOrderPlacedEmail } from "@/lib/email/send";
import { getPaymentProvider } from "@/lib/payment";
import { SITE } from "@/lib/seo/site";
import { type CheckoutConfig } from "@/lib/utils/commerce";

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
    const coupon = await applyCustomerCoupon(code, customer.email, subtotalMinor);
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
  if (!result.ok) return { error: result.error };
  return {
    ok: {
      code: result.promo.code,
      discountMinor: result.discountMinor,
      finalMinor: Math.max(0, subtotalMinor - result.discountMinor),
    },
  };
}

/**
 * Returns the authoritative shipping config so the checkout can show real
 * shipping/free-shipping math (matching what the server will charge).
 */
export async function getCheckoutConfigAction(): Promise<CheckoutConfig> {
  const s = await getSettings();
  return {
    shippingFlatMinor: s.shippingFlatMinor,
    shippingFreeThresholdMinor: s.shippingFreeThresholdMinor,
    taxRatePct: s.taxRatePct,
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
  });

  if (!result.ok) {
    if (result.reason === "empty") redirect("/?cart=empty");
    const params = new URLSearchParams({
      cart: result.reason,
      item: "productName" in result ? result.productName : "",
      available: "available" in result ? String(result.available) : "",
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
  });

  redirect(session.redirectUrl);
}
