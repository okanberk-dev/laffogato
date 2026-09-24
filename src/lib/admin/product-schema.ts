import { z } from "zod";

import { slugify } from "@/lib/admin/store";

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

const moneyToMinor = z
  .string()
  .transform((s) => s.trim().replace(",", "."))
  .transform((s) => {
    if (!s) return 0;
    const v = parseFloat(s);
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  })
  .pipe(z.number().int().nonnegative());

const intInput = z
  .string()
  .optional()
  .transform((s) => {
    const v = parseInt(s ?? "0", 10);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  });

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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
  .transform((raw) => {
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data
        .map((v: unknown, idx) => {
          if (typeof v !== "object" || v === null) return null;
          const o = v as Record<string, unknown>;
          const name = String(o.name ?? "").trim();
          if (!name) return null;
          const priceDeltaText = String(o.priceDelta ?? "0").replace(",", ".");
          const priceDelta = parseFloat(priceDeltaText);
          const stock = parseInt(String(o.stock ?? "0"), 10);
          const sku = String(o.sku ?? "").trim();
          const isActive = Boolean(o.isActive ?? true);
          return {
            id: String(o.id ?? `var-${idx + 1}`),
            name,
            priceDeltaMinor: Number.isFinite(priceDelta)
              ? Math.round(priceDelta * 100)
              : 0,
            stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
            sku,
            isActive,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
    } catch {
      return [];
    }
  });

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Ürün adı en az 2 karakter olmalı."),
    slug: z.string().trim().optional(),
    sku: z.string().trim().optional(),
    tag: z.string().trim().min(1, "Etiket gerekli."),
    desc: z.string().trim().min(1, "Açıklama gerekli."),
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
    price: moneyToMinor,
    compareAtPrice: moneyToMinor.optional(),
    cost: moneyToMinor.optional(),
    stock: intInput,
    lowStockThreshold: intInput,
    weightGrams: intInput,
    seoTitle: z.string().trim().max(80).optional().default(""),
    seoDescription: z.string().trim().max(220).optional().default(""),
    featured: z.string().optional(),
    isNew: z.string().optional(),
    isActive: z.string().optional(),
    variants: variantsJson,
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
    lowStockThreshold: v.lowStockThreshold,
    weightGrams: v.weightGrams,
    seoTitle: v.seoTitle ?? "",
    seoDescription: v.seoDescription ?? "",
    featured: v.featured === "on",
    isNew: v.isNew === "on",
    isActive: v.isActive === "on",
    variants: v.variants,
  }));
