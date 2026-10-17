import { z } from "zod";

import {
  MANUAL_PAYMENT_METHODS,
  type ManualPaymentMethod,
} from "@/lib/admin/order-actions";
import { shippingModeFor, type ShippingMode } from "@/lib/mobile/order-pricing";

export interface ManualOrderLine {
  productId: string;
  variantId?: string;
  qty: number;
}

function parseLines(raw: string): ManualOrderLine[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: ManualOrderLine[] = [];
  for (const it of data as unknown[]) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    const productId = typeof o.productId === "string" ? o.productId.trim() : "";
    const variantId =
      typeof o.variantId === "string" && o.variantId.trim()
        ? o.variantId.trim()
        : undefined;
    const qtyRaw = typeof o.qty === "number" ? o.qty : Number(o.qty);
    const qty = Number.isFinite(qtyRaw) ? Math.floor(qtyRaw) : 0;
    if (!productId || qty <= 0 || qty > 99) continue;
    out.push({ productId, variantId, qty });
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The form's length caps. The inputs carry the same numbers as `maxLength`,
 * so the browser stops the typing where the server would refuse it.
 */
export const MANUAL_ORDER_LIMITS = {
  customerName: 120,
  customerEmail: 160,
  customerPhone: 40,
  shippingAddress: 600,
  internalNote: 2000,
  promoCode: 40,
} as const;

/**
 * How a manual order reaches the customer (admin audit ORD-01, karar D4).
 * Gel-al first: most panel orders are a sale at the counter or a phone
 * order picked up at the köşk, and a parcel needs a tracking number before
 * it can be closed.
 */
export const MANUAL_FULFILLMENTS = ["pickup", "delivery", "shipping"] as const;
export type ManualFulfillment = (typeof MANUAL_FULFILLMENTS)[number];

/**
 * What the delivery costs: nothing for a pickup, the courier fee from the
 * settings for a courier, the shop's flat fee and free-shipping threshold
 * for a parcel (the web checkout's rule). Pure: the store charges with it
 * and the form previews with it.
 */
export function manualShippingMode(
  fulfillment: ManualFulfillment,
  settings: { courierFeeMinor: number },
): ShippingMode {
  return shippingModeFor(fulfillment, settings);
}

/** Starting states that mean the money was already taken (karar D5). */
export function manualStartIsPaid(status: string): boolean {
  return status === "paid" || status === "preparing";
}

const tooLong = (what: string, max: number) =>
  `${what} en fazla ${max} karakter olabilir.`;

/**
 * Manual (admin-entered) order. Line prices are NOT taken from the form - the
 * store resolves them from the DB. The form only sends product/variant ids +
 * quantities plus the customer/delivery details.
 */
export const manualOrderSchema = z
  .object({
    items: z.string().optional().default("[]"),
    customerName: z
      .string({ message: "Müşteri adını yaz." })
      .trim()
      .min(2, "Müşteri adı en az 2 karakter olmalı.")
      .max(MANUAL_ORDER_LIMITS.customerName, "Ad çok uzun."),
    customerEmail: z
      .string()
      .trim()
      .max(
        MANUAL_ORDER_LIMITS.customerEmail,
        tooLong("E-posta", MANUAL_ORDER_LIMITS.customerEmail),
      )
      .optional()
      .default(""),
    customerPhone: z
      .string()
      .trim()
      .max(
        MANUAL_ORDER_LIMITS.customerPhone,
        tooLong("Telefon", MANUAL_ORDER_LIMITS.customerPhone),
      )
      .optional()
      .default(""),
    shippingAddress: z
      .string()
      .trim()
      .max(
        MANUAL_ORDER_LIMITS.shippingAddress,
        tooLong("Adres", MANUAL_ORDER_LIMITS.shippingAddress),
      )
      .optional()
      .default(""),
    internalNote: z
      .string()
      .trim()
      .max(
        MANUAL_ORDER_LIMITS.internalNote,
        tooLong("İç not", MANUAL_ORDER_LIMITS.internalNote),
      )
      .optional()
      .default(""),
    promoCode: z
      .string()
      .trim()
      .max(
        MANUAL_ORDER_LIMITS.promoCode,
        tooLong("Promosyon kodu", MANUAL_ORDER_LIMITS.promoCode),
      )
      .optional()
      .default(""),
    status: z
      .enum(["pending_payment", "paid", "preparing"], {
        message: "Başlangıç durumunu seç.",
      })
      .default("paid"),
    fulfillment: z
      .enum(MANUAL_FULFILLMENTS, { message: "Teslimat şeklini seç." })
      .default("pickup"),
    // Read only for a paid start; an unpaid one owes no payment record.
    paymentMethod: z.string().trim().optional().default(""),
  })
  .transform((v) => ({
    lines: parseLines(v.items ?? "[]"),
    customerName: v.customerName,
    customerEmail: v.customerEmail ?? "",
    customerPhone: v.customerPhone ?? "",
    shippingAddress: v.shippingAddress ?? "",
    internalNote: v.internalNote ?? "",
    promoCode: v.promoCode ?? "",
    status: v.status,
    fulfillment: v.fulfillment as ManualFulfillment,
    paymentMethod: (manualStartIsPaid(v.status) &&
    (MANUAL_PAYMENT_METHODS as readonly string[]).includes(v.paymentMethod)
      ? v.paymentMethod
      : null) as ManualPaymentMethod | null,
  }))
  .superRefine((v, ctx) => {
    if (v.lines.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "En az bir ürün ekle.",
        path: ["items"],
      });
    }
    if (v.customerEmail && !EMAIL_RE.test(v.customerEmail)) {
      ctx.addIssue({
        code: "custom",
        message: "Geçerli bir e-posta gir ya da boş bırak.",
        path: ["customerEmail"],
      });
    }
    // A paid start with no method was a sale nobody could reconcile: cash,
    // the counter's card terminal and a transfer looked the same (ORD-19).
    if (manualStartIsPaid(v.status) && v.paymentMethod === null) {
      ctx.addIssue({
        code: "custom",
        message: "Ödemenin nasıl alındığını seç.",
        path: ["paymentMethod"],
      });
    }
    // A parcel or a courier with nowhere to go.
    if (v.fulfillment !== "pickup" && !v.shippingAddress) {
      ctx.addIssue({
        code: "custom",
        message:
          v.fulfillment === "shipping"
            ? "Kargo için teslimat adresini yaz."
            : "Kurye için teslimat adresini yaz.",
        path: ["shippingAddress"],
      });
    }
  });
