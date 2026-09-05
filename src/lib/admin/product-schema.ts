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
