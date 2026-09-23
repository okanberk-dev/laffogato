import { z } from "zod";

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
 * Manual (admin-entered) order. Line prices are NOT taken from the form - the
 * store resolves them from the DB. The form only sends product/variant ids +
 * quantities plus the customer/delivery details.
 */
export const manualOrderSchema = z
  .object({
    items: z.string().optional().default("[]"),
    customerName: z
      .string()
      .trim()
      .min(2, "Müşteri adı en az 2 karakter olmalı.")
      .max(120, "Ad çok uzun."),
    customerEmail: z.string().trim().max(160).optional().default(""),
    customerPhone: z.string().trim().max(40).optional().default(""),
    shippingAddress: z.string().trim().max(600).optional().default(""),
    internalNote: z.string().trim().max(2000).optional().default(""),
    promoCode: z.string().trim().max(40).optional().default(""),
    status: z.enum(["pending_payment", "paid", "preparing"]).default("paid"),
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
  }))
  .superRefine((v, ctx) => {
    if (v.lines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "En az bir ürün ekle.",
        path: ["items"],
      });
    }
    if (v.customerEmail && !EMAIL_RE.test(v.customerEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir e-posta gir ya da boş bırak.",
        path: ["customerEmail"],
      });
    }
  });
