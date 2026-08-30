// Wire validation for `POST /orders` and `POST /orders/preview`
// (docs/API-MOBILE.md §3). Pure — no "server-only", no database. Every
// message is Turkish and safe to show as-is; the route hands the first one
// back in the `{ error, message }` body.

import { z } from "zod";

import { lineOptionsSchema, orderItemSizeSchema } from "./customization";
import { fulfillmentAllowed } from "./order-pricing";

/** Per-line quantity ceiling — mirrors `MAX_LINE_QTY` in the store. */
export const MAX_APP_LINE_QTY = 99;
/** A basket, not a wholesale order. */
export const MAX_APP_LINES = 30;

const id = (what: string) =>
  z
    .string({ error: `${what} geçersiz.` })
    .trim()
    .min(1, { error: `${what} eksik.` })
    .max(64, { error: `${what} geçersiz.` });

const qtySchema = z
  .number({ error: "Adet geçersiz." })
  .int({ error: "Adet tam sayı olmalı." })
  .min(1, { error: "Adet en az 1 olmalı." })
  .max(MAX_APP_LINE_QTY, {
    error: `Bir üründen en fazla ${MAX_APP_LINE_QTY} adet sipariş edebilirsin.`,
  });

export const cafeLineSchema = z.object({
  menuItemId: id("Menü ürünü"),
  qty: qtySchema,
  size: orderItemSizeSchema,
  // `prefault` parses the fallback, so `options: {}` and a missing `options`
  // both come out with every field defaulted rather than as a bare `{}`.
  options: lineOptionsSchema.prefault({}),
});

export const shopLineSchema = z.object({
  productId: id("Ürün"),
  variantId: id("Ürün seçeneği").optional(),
  qty: qtySchema,
  note: z
    .string({ error: "Satır notu geçersiz." })
    .trim()
    .max(120, { error: "Satır notu en fazla 120 karakter olabilir." })
    .default(""),
});

export type CafeLineInput = z.infer<typeof cafeLineSchema>;
export type ShopLineInput = z.infer<typeof shopLineSchema>;
export type OrderLineInput = CafeLineInput | ShopLineInput;

export function isCafeLine(line: OrderLineInput): line is CafeLineInput {
  return "menuItemId" in line;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

/**
 * A line is a cafe line when it names a menu item, a shop line otherwise. The
 * two are told apart by key rather than a `z.union`, so a bad option on a
 * cafe line reports "Geçersiz süt seçimi." instead of a two-branch union
 * error the app could not show.
 */
const lineSchema = z.unknown().transform((raw, ctx): OrderLineInput => {
  if (!isRecord(raw)) {
    ctx.addIssue({ code: "custom", message: "Sepet satırı geçersiz." });
    return z.NEVER;
  }
  const schema = "menuItemId" in raw ? cafeLineSchema : shopLineSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      });
    }
    return z.NEVER;
  }
  return parsed.data;
});

export const inlineAddressSchema = z.object({
  title: z
    .string({ error: "Adres başlığı geçersiz." })
    .trim()
    .max(40, { error: "Adres başlığı en fazla 40 karakter olabilir." })
    .default(""),
  fullName: z
    .string({ error: "Alıcı adı geçersiz." })
    .trim()
    .min(2, { error: "Alıcı adı zorunlu." })
    .max(100, { error: "Alıcı adı çok uzun." }),
  phone: z
    .string({ error: "Telefon geçersiz." })
    .trim()
    .min(7, { error: "Geçerli bir telefon gir." })
    .max(30, { error: "Telefon çok uzun." }),
  city: z
    .string({ error: "Şehir geçersiz." })
    .trim()
    .min(2, { error: "Şehir zorunlu." })
    .max(80, { error: "Şehir çok uzun." }),
  district: z
    .string({ error: "İlçe geçersiz." })
    .trim()
    .max(80, { error: "İlçe çok uzun." })
    .default(""),
  neighbourhood: z
    .string({ error: "Mahalle geçersiz." })
    .trim()
    .max(80, { error: "Mahalle çok uzun." })
    .default(""),
  line: z
    .string({ error: "Adres satırı geçersiz." })
    .trim()
    .min(5, { error: "Adres satırı zorunlu." })
    .max(200, { error: "Adres satırı çok uzun." }),
  note: z
    .string({ error: "Adres notu geçersiz." })
    .trim()
    .max(200, { error: "Adres notu en fazla 200 karakter olabilir." })
    .default(""),
});

export const savedAddressSchema = z.object({ id: id("Adres") });

export type InlineAddressInput = z.infer<typeof inlineAddressSchema>;
export type OrderAddressInput =
  | z.infer<typeof savedAddressSchema>
  | InlineAddressInput
  | null;

/** `{ id }` picks a saved address, an object is typed inline, null is none. */
const addressSchema = z
  .unknown()
  .optional()
  .transform((raw, ctx): OrderAddressInput => {
    if (raw === undefined || raw === null) return null;
    if (!isRecord(raw)) {
      ctx.addIssue({ code: "custom", message: "Adres geçersiz." });
      return z.NEVER;
    }
    const schema = "id" in raw ? savedAddressSchema : inlineAddressSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }
      return z.NEVER;
    }
    return parsed.data;
  });

const orderFields = {
  kind: z.enum(["cafe", "shop"], { error: "Sipariş türü geçersiz." }),
  fulfillment: z.enum(["pickup", "delivery", "shipping"], {
    error: "Teslimat türü geçersiz.",
  }),
  lines: z
    .array(lineSchema, { error: "Sepet satırları geçersiz." })
    .min(1, { error: "Sepet boş." })
    .max(MAX_APP_LINES, {
      error: `Bir siparişte en fazla ${MAX_APP_LINES} satır olabilir.`,
    }),
  address: addressSchema,
  scheduledFor: z
    .union([
      z.literal(""),
      z.iso.datetime({ offset: true, error: "Planlanan saat geçersiz." }),
    ])
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null)),
  promoCode: z
    .string({ error: "Promosyon kodu geçersiz." })
    .trim()
    .max(40, { error: "Promosyon kodu çok uzun." })
    .default(""),
  note: z
    .string({ error: "Sipariş notu geçersiz." })
    .trim()
    .max(500, { error: "Sipariş notu en fazla 500 karakter olabilir." })
    .default(""),
};

type OrderFieldsParsed = {
  kind: "cafe" | "shop";
  fulfillment: "pickup" | "delivery" | "shipping";
  lines: OrderLineInput[];
  address: OrderAddressInput;
};

/**
 * Rules that span fields. `kind` is what the basket says it is — the client's
 * `kind` must agree, so a stale app cannot ship a cappuccino.
 *
 * `requireAddress` separates the two callers. Placing an order needs somewhere
 * to send it; pricing one does not, because shipping is derived from
 * `fulfillment` and the settings alone (see `shippingModeFor`) and never from
 * the address. Demanding it on the preview meant the basket screen — which
 * runs before any address is picked — got a 400 for every shop basket and
 * every courier basket, and fell back to the device's own estimate under an
 * \"offline\" label while perfectly online.
 */
function crossFieldRules(
  v: OrderFieldsParsed,
  ctx: z.RefinementCtx,
  requireAddress: boolean,
): void {
  const cafe = v.lines.filter(isCafeLine).length;
  const shop = v.lines.length - cafe;
  if (cafe > 0 && shop > 0) {
    ctx.addIssue({
      code: "custom",
      message: "Kafe ürünleri ile mağaza ürünleri aynı siparişte verilemez.",
      path: ["lines"],
    });
    return;
  }
  const derived = cafe > 0 ? "cafe" : "shop";
  if (v.kind !== derived) {
    ctx.addIssue({
      code: "custom",
      message: "Sipariş türü sepetle uyuşmuyor.",
      path: ["kind"],
    });
    return;
  }
  if (!fulfillmentAllowed(v.kind, v.fulfillment)) {
    ctx.addIssue({
      code: "custom",
      message:
        v.kind === "cafe"
          ? "Kafe siparişi gel-al ya da kurye ile teslim edilir."
          : "Mağaza siparişi kargo ile gönderilir.",
      path: ["fulfillment"],
    });
    return;
  }
  if (requireAddress && v.fulfillment !== "pickup" && v.address === null) {
    ctx.addIssue({
      code: "custom",
      message: "Teslimat adresi gerekli.",
      path: ["address"],
    });
  }
}

/**
 * `POST /orders/preview` — the order body without the consent flag, and
 * without the address: the basket is priced before there is one.
 */
export const previewOrderBodySchema = z
  .object(orderFields)
  .superRefine((v, ctx) => crossFieldRules(v, ctx, false));

/** `POST /orders` — the same body, plus the distance-selling confirmation. */
export const placeOrderBodySchema = z
  .object({
    ...orderFields,
    legalConsent: z.literal(true, {
      error:
        "Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ni onaylaman gerekiyor.",
    }),
  })
  .superRefine((v, ctx) => crossFieldRules(v, ctx, true));

export type PreviewOrderBody = z.infer<typeof previewOrderBodySchema>;
export type PlaceOrderBody = z.infer<typeof placeOrderBodySchema>;

/** `POST /promo/preview` (contract §5). */
export const promoPreviewBodySchema = z.object({
  code: z
    .string({ error: "Kod geçersiz." })
    .trim()
    .min(1, { error: "Kod gir." })
    .max(40, { error: "Kod çok uzun." }),
  subtotalMinor: z
    .number({ error: "Ara toplam geçersiz." })
    .int({ error: "Ara toplam kuruş cinsinden tam sayı olmalı." })
    .min(0, { error: "Ara toplam negatif olamaz." })
    .max(100_000_000, { error: "Ara toplam geçersiz." }),
});

export type PromoPreviewBody = z.infer<typeof promoPreviewBodySchema>;

/**
 * The one message a `{ error: "invalid_body" }` response carries. Issues are
 * in document order, so the first one is the earliest field the app should
 * point at.
 */
export function firstIssueMessage(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message || "Sipariş bilgileri geçersiz.";
}
