import { z } from "zod";

import { MAX_STORED_IMAGE_LENGTH } from "@/lib/admin/image-encode";
import { slugify } from "@/lib/admin/store";
import { parseStockSnapshot } from "@/lib/admin/stock-delta";
import {
  parseBackdropChoice,
  parseVesselChoice,
} from "@/lib/backdrop/scene-core";
import {
  CATALOG_MONEY_MAX_MINOR,
  MONEY_TOO_LARGE_ERROR,
  parseMoneyInput,
  parseSignedMoneyInput,
} from "@/lib/utils/format";
import { parseTaxRateInput, TAX_RATE_INPUT_ERROR } from "@/lib/utils/kdv";

const HUE_VALUES = [
  "cream",
  "warm",
  "stone",
  "caramel",
  "espresso",
  "matcha",
  "pistachio",
  "rose",
  "dawn",
  "gold",
  "sky",
] as const;

const CAT_VALUES = ["beans", "gift", "gear", "merch", "pantry"] as const;

/**
 * The item-tag vocabulary, shared with the cafe menu (`menu_items.tags`) and
 * with the app, which filters every incoming tag against this exact list and
 * silently DROPS anything else (lafmobil `src/data/types.ts` `toTags` over `ITEM_TAGS`). A tag
 * invented here would therefore never reach a customer's screen - which for an
 * allergen is the failure mode this list exists to prevent. Widening it means
 * widening the app's `ItemTag` union in the same release.
 */
export const PRODUCT_TAG_VALUES = ["signature", "new", "iced", "nuts"] as const;

/**
 * The allergens inside that vocabulary - what `/admin/urunler` offers as a
 * closed list. Today that is `nuts` alone; the shelf holds a pistachio
 * biscotti, and lafmobil rule 4 is that allergen information is never hidden.
 */
export const PRODUCT_ALLERGEN_TAGS: readonly string[] = ["nuts"];

/**
 * Comma-separated on the wire, exactly like the menu item form's `tags` field,
 * so both surfaces of the same column are filled the same way. Unknown words
 * are dropped rather than stored: the app would drop them anyway, and a tag
 * that exists only in the database reads as allergen coverage that is not
 * there.
 */
const tagList = z
  .string()
  .optional()
  .transform((raw) => {
    const seen = new Set<string>();
    for (const part of (raw ?? "").split(",")) {
      const tag = part.trim().toLowerCase();
      if (
        PRODUCT_TAG_VALUES.includes(tag as (typeof PRODUCT_TAG_VALUES)[number])
      ) {
        seen.add(tag);
      }
    }
    return [...seen];
  });

/** How many tasting-note chips one product may carry, and how long each is. */
export const PRODUCT_NOTES_MAX = 5;
export const PRODUCT_NOTE_MAX_LENGTH = 24;
export const PRODUCT_BRAND_MAX_LENGTH = 40;

/**
 * Tasting notes, typed as one line: "Kakao, Kuru incir, Esmer şeker". Commas,
 * the middle dot the app draws between them and new lines all separate, so a
 * list pasted from the canvas or the label works as typed. Inner spaces are
 * collapsed and a note repeated in another case is kept once. Too many, or
 * one too long for a chip, is an error the operator sees - never a silent
 * cut, which would publish a note they did not write.
 */
export function parseProductNotes(raw: string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(/[,\u00b7\n]/)) {
    const note = part.replace(/\s+/g, " ").trim();
    if (!note) continue;
    const key = note.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(note);
  }
  return out;
}

// Both limits are checked on the LIST, not on each element: an element check
// reports its issue at ["notes", i], the product action keys its field errors
// by the joined path ("notes.2"), and the wizard asks for "notes" - so a note
// too long for a chip used to be refused with the generic banner alone and no
// word under the "Tat notları" field about which limit was hit.
const notesList = z
  .string()
  .optional()
  .transform(parseProductNotes)
  .pipe(
    z
      .array(z.string())
      .max(PRODUCT_NOTES_MAX, `En fazla ${PRODUCT_NOTES_MAX} tat notu yazılabilir.`)
      .refine(
        (notes) => notes.every((n) => n.length <= PRODUCT_NOTE_MAX_LENGTH),
        `Her tat notu en fazla ${PRODUCT_NOTE_MAX_LENGTH} karakter olabilir.`,
      ),
  );

/** What an amount the panel cannot read is answered with, under its field. */
export const MONEY_INPUT_ERROR = "Tutarı rakamla yaz, ör. 250 ya da 1.250,00.";

/**
 * A lira field as kuruş. Empty is 0 (the optional prices); anything else goes
 * through parseMoneyInput (CLAUDE.md rule 24). `parseFloat(s.replace(",",
 * "."))` read "1.250,00" as 1,25 TL, and an unreadable value was saved as 0
 * without a word.
 */
const moneyToMinor = z.string().transform((s, ctx) => {
  const text = s.trim();
  if (!text) return 0;
  const minor = parseMoneyInput(text);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: MONEY_INPUT_ERROR });
    return z.NEVER;
  }
  if (minor > CATALOG_MONEY_MAX_MINOR) {
    ctx.addIssue({ code: "custom", message: MONEY_TOO_LARGE_ERROR });
    return z.NEVER;
  }
  return minor;
});

/** The smallest price anything in the shop may be sold for: 1 kuruş. */
export const PRICE_FLOOR_MINOR = 1;

export const PRICE_REQUIRED_ERROR = "Satış fiyatını yaz.";
export const PRICE_FLOOR_ERROR = "Fiyat en az 0,01 TL olmalı.";

/** Why a variant is refused when its price plus difference is under 1 kuruş. */
export function variantFloorError(name: string): string {
  return `"${name}" varyantının fiyatı (satış fiyatı + fark) en az 0,01 TL olmalı.`;
}

/** The variants that would sell under 1 kuruş at this price. */
export function variantsBelowFloor<V extends { priceDeltaMinor: number }>(
  priceMinor: number,
  variants: readonly V[],
): V[] {
  return variants.filter((v) => priceMinor + v.priceDeltaMinor < PRICE_FLOOR_MINOR);
}

/**
 * The sale price: required, and at least 1 kuruş (admin audit CAT-05). A "0"
 * left as a placeholder gave the product away: a basket of such items
 * totals 0 and is settled as paid without the POS. The optional prices keep
 * moneyToMinor, where empty is 0 ("no was price", "no cost").
 */
const salePriceToMinor = z.string().transform((s, ctx) => {
  const text = s.trim();
  if (!text) {
    ctx.addIssue({ code: "custom", message: PRICE_REQUIRED_ERROR });
    return z.NEVER;
  }
  const minor = parseMoneyInput(text);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: MONEY_INPUT_ERROR });
    return z.NEVER;
  }
  if (minor > CATALOG_MONEY_MAX_MINOR) {
    ctx.addIssue({ code: "custom", message: MONEY_TOO_LARGE_ERROR });
    return z.NEVER;
  }
  if (minor < PRICE_FLOOR_MINOR) {
    ctx.addIssue({ code: "custom", message: PRICE_FLOOR_ERROR });
    return z.NEVER;
  }
  return minor;
});

/**
 * The product's own KDV rate: "" is the category default (null), anything
 * else a whole number from 0 to 100. A fraction or text is refused under the
 * field, never rounded into a rate nobody chose.
 */
const taxRateInput = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    const parsed = parseTaxRateInput(raw);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: TAX_RATE_INPUT_ERROR });
      return z.NEVER;
    }
    return parsed.value;
  });

const intInput = z
  .string()
  .optional()
  .transform((s) => {
    const v = parseInt(s ?? "0", 10);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  });

// The stock a form was opened with (admin audit CAT-03). It lives with the
// other client-safe stock helpers: the wizard reads its own post with it.
export { parseStockSnapshot };

const stockSnapshot = z.string().optional().transform(parseStockSnapshot);

/**
 * The opened form's own token (admin audit CAT-03): a save of the same form
 * sent again moves the stock once (`product_form_saves`). Anything that is
 * not one reads as none, and that save is a change of its own.
 */
export function parseSaveToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(token) ? token : null;
}

const MAX_IMAGES = 8;
/**
 * The stored data URL's length cap. The uploader downscales until a photo
 * fits under this same number (`image-encode.ts`) or tells the operator it
 * cannot, so the filter below never drops a photo the panel accepted.
 */
const MAX_IMAGE_BYTES = MAX_STORED_IMAGE_LENGTH;

const imagesJsonArray = z
  .string()
  .optional()
  .transform((raw) => {
    const value = (raw ?? "").trim();
    if (!value) return [] as string[];
    // Back-compat: the field used to be newline-separated; treat anything
    // that isn't a JSON array as legacy text input.
    if (!value.startsWith("[")) {
      return value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, MAX_IMAGES);
    }
    try {
      const data = JSON.parse(value);
      if (!Array.isArray(data)) return [];
      return data
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => {
          if (!v) return false;
          if (v.startsWith("data:image/")) return v.length <= MAX_IMAGE_BYTES;
          return /^https?:\/\//i.test(v);
        })
        .slice(0, MAX_IMAGES);
    } catch {
      return [];
    }
  });

const variantsJson = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data
        .map((v: unknown, idx) => {
          if (typeof v !== "object" || v === null) return null;
          const o = v as Record<string, unknown>;
          const name = String(o.name ?? "").trim();
          // A row without a name used to vanish on save with its stock and
          // price (admin audit CAT-29); it is refused under "Varyantlar".
          if (!name) {
            ctx.addIssue({
              code: "custom",
              message: `${idx + 1}. varyantın adını yaz ya da satırı sil.`,
            });
            return null;
          }
          // Signed: a smaller bag is cheaper ("-10,50"). Same reading as every
          // other amount; an unreadable one is refused under "Varyantlar"
          // instead of quietly becoming 0.
          const priceDeltaText = String(o.priceDelta ?? "").trim();
          const priceDeltaMinor = priceDeltaText
            ? parseSignedMoneyInput(priceDeltaText)
            : 0;
          if (priceDeltaMinor === null) {
            ctx.addIssue({
              code: "custom",
              message: `"${name}" varyantının fiyat farkı okunamadı. ${MONEY_INPUT_ERROR} İndirim için başına - koy.`,
            });
          } else if (Math.abs(priceDeltaMinor) > CATALOG_MONEY_MAX_MINOR) {
            ctx.addIssue({
              code: "custom",
              message: `"${name}" varyantının fiyat farkı çok büyük. ${MONEY_TOO_LARGE_ERROR}`,
            });
          }
          const stock = parseInt(String(o.stock ?? "0"), 10);
          const sku = String(o.sku ?? "").trim();
          const isActive = Boolean(o.isActive ?? true);
          return {
            id: String(o.id ?? `var-${idx + 1}`),
            name,
            priceDeltaMinor: priceDeltaMinor ?? 0,
            stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
            sku,
            isActive,
            stockAtOpen: parseStockSnapshot(o.stockAtOpen),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
    } catch {
      return [];
    }
  });

/** Length caps shared by the wizard and the CSV import. */
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const PRODUCT_SKU_MAX_LENGTH = 40;
export const PRODUCT_TAG_MAX_LENGTH = 80;
export const PRODUCT_DESC_MAX_LENGTH = 2000;

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ürün adı en az 2 karakter olmalı.")
      .max(
        PRODUCT_NAME_MAX_LENGTH,
        `Ürün adı en fazla ${PRODUCT_NAME_MAX_LENGTH} karakter olabilir.`,
      ),
    slug: z.string().trim().optional(),
    sku: z
      .string()
      .trim()
      .max(
        PRODUCT_SKU_MAX_LENGTH,
        `SKU en fazla ${PRODUCT_SKU_MAX_LENGTH} karakter olabilir.`,
      )
      .optional(),
    tag: z
      .string()
      .trim()
      .min(1, "Etiket gerekli.")
      .max(
        PRODUCT_TAG_MAX_LENGTH,
        `Etiket en fazla ${PRODUCT_TAG_MAX_LENGTH} karakter olabilir.`,
      ),
    desc: z
      .string()
      .trim()
      .min(1, "Açıklama gerekli.")
      .max(
        PRODUCT_DESC_MAX_LENGTH,
        `Açıklama en fazla ${PRODUCT_DESC_MAX_LENGTH} karakter olabilir.`,
      ),
    cat: z.enum(CAT_VALUES).default("beans"),
    img: z.enum(HUE_VALUES).default("cream"),
    images: imagesJsonArray,
    tags: tagList,
    brand: z
      .string()
      .trim()
      .max(
        PRODUCT_BRAND_MAX_LENGTH,
        `Marka en fazla ${PRODUCT_BRAND_MAX_LENGTH} karakter olabilir.`,
      )
      .optional()
      .default(""),
    notes: notesList,
    price: salePriceToMinor,
    compareAtPrice: moneyToMinor.optional(),
    cost: moneyToMinor.optional(),
    stock: intInput,
    stockAtOpen: stockSnapshot,
    saveToken: z.string().optional().transform(parseSaveToken),
    lowStockThreshold: intInput,
    weightGrams: intInput,
    taxRatePct: taxRateInput,
    seoTitle: z.string().trim().max(80).optional().default(""),
    seoDescription: z.string().trim().max(220).optional().default(""),
    featured: z.string().optional(),
    isNew: z.string().optional(),
    isActive: z.string().optional(),
    variants: variantsJson,
    // "Sahne" and "Kap biçimi" (glass round): the save action turns these
    // choices and the first photo into the scene columns (scene.ts).
    backdrop: z.string().optional().transform(parseBackdropChoice),
    vessel: z.string().optional().transform(parseVesselChoice),
  })
  // Each variant sells at price + its difference, and the order line is
  // max(0, that): a "-400" on a 320 TL product gave the variant away, and
  // the app's shop feed published the negative price (CAT-05).
  .superRefine((v, ctx) => {
    for (const variant of variantsBelowFloor(v.price, v.variants)) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: variantFloorError(variant.name),
      });
    }
  })
  .transform((v) => ({
    name: v.name,
    slug: v.slug?.trim() ? slugify(v.slug) : slugify(v.name),
    sku: v.sku ?? "",
    tag: v.tag,
    desc: v.desc,
    cat: v.cat,
    img: v.img,
    images: v.images,
    tags: v.tags,
    brand: v.brand ?? "",
    notes: v.notes,
    priceMinor: v.price,
    compareAtPriceMinor: v.compareAtPrice ?? 0,
    costMinor: v.cost ?? 0,
    stock: v.stock,
    stockAtOpen: v.stockAtOpen,
    saveToken: v.saveToken,
    lowStockThreshold: v.lowStockThreshold,
    weightGrams: v.weightGrams,
    taxRatePct: v.taxRatePct ?? null,
    seoTitle: v.seoTitle ?? "",
    seoDescription: v.seoDescription ?? "",
    featured: v.featured === "on",
    isNew: v.isNew === "on",
    isActive: v.isActive === "on",
    variants: v.variants,
    backdropChoice: v.backdrop,
    vesselChoice: v.vessel,
  }));
