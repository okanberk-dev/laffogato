import "server-only";

import { z } from "zod";

import { CART_KEY_PATTERN } from "./cart-key";
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  isValidPhone,
  NAME_MAX,
  NAME_MIN,
  PHONE_MESSAGE,
  type DeliveryField,
} from "./delivery";

/**
 * Server-side parsing of the checkout's order form (CLAUDE.md rule 3). The
 * same rules the browser applies (`delivery.ts`), so a form the checkout
 * accepted is never refused here - and a scripted one is.
 *
 * The form carries no card field: the card is posted by the page's own
 * native form to /odeme/paynkolay and never reaches this action
 * (`tests/saved-cards.test.ts`).
 */

const fieldsSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(NAME_MIN, "Ad soyad yaz.")
    .max(NAME_MAX, "Ad soyad çok uzun."),
  customerPhone: z
    .string()
    .trim()
    .max(30, PHONE_MESSAGE)
    .refine(isValidPhone, PHONE_MESSAGE),
  shippingAddress: z
    .string()
    .trim()
    .min(ADDRESS_MIN, "Teslimat adresini yaz.")
    .max(ADDRESS_MAX, "Teslimat adresi çok uzun."),
  promoCode: z.string().trim().max(40).default(""),
});

export type CheckoutFields = z.infer<typeof fieldsSchema>;

const FIELD_OF: Record<string, DeliveryField> = {
  customerName: "customerName",
  customerPhone: "customerPhone",
  shippingAddress: "line1",
};

type Raw = FormDataEntryValue | null | undefined;

function text(value: Raw): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The fields as the action read them from its form (the action keeps the
 * `formData.get("…")` calls, which `tests/frontend-form-contract.test.ts`
 * holds against the form's field names).
 */
export function parseCheckoutFields(raw: {
  customerName: Raw;
  customerPhone: Raw;
  shippingAddress: Raw;
  promoCode: Raw;
}):
  | { ok: true; fields: CheckoutFields }
  | { ok: false; field?: DeliveryField; message: string } {
  const parsed = fieldsSchema.safeParse({
    customerName: text(raw.customerName) ?? "",
    customerPhone: text(raw.customerPhone) ?? "",
    shippingAddress: text(raw.shippingAddress) ?? "",
    promoCode: text(raw.promoCode),
  });
  if (parsed.success) return { ok: true, fields: parsed.data };
  const issue = parsed.error.issues[0];
  const key = String(issue?.path[0] ?? "");
  return {
    ok: false,
    field: FIELD_OF[key],
    message: issue?.message || "Teslimat bilgilerini kontrol et.",
  };
}

const claimSchema = z.object({
  reuseOrderId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  // A sealed payload is a few hundred characters; anything far longer is not
  // ours and is not worth decrypting.
  reuseData: z.string().min(1).max(8192),
  reuseSignature: z.string().min(1).max(256),
  reuseCartKey: z.string().regex(CART_KEY_PATTERN),
});

export interface ReuseClaimInput {
  orderId: string;
  data: string;
  signature: string;
  cartKey: string;
}

/** The pending order the browser offers back, or `null` when none or malformed. */
export function parseReuseClaim(raw: {
  reuseOrderId: Raw;
  reuseData: Raw;
  reuseSignature: Raw;
  reuseCartKey: Raw;
}): ReuseClaimInput | null {
  const parsed = claimSchema.safeParse({
    reuseOrderId: text(raw.reuseOrderId),
    reuseData: text(raw.reuseData),
    reuseSignature: text(raw.reuseSignature),
    reuseCartKey: text(raw.reuseCartKey),
  });
  if (!parsed.success) return null;
  return {
    orderId: parsed.data.reuseOrderId,
    data: parsed.data.reuseData,
    signature: parsed.data.reuseSignature,
    cartKey: parsed.data.reuseCartKey,
  };
}
