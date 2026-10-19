import { z } from "zod";

import {
  CATALOG_MONEY_MAX_MINOR,
  MONEY_TOO_LARGE_ERROR,
  parseMoneyInput,
} from "@/lib/utils/format";
import { parseTaxRateInput, TAX_RATE_INPUT_ERROR } from "@/lib/utils/kdv";

import { PRODUCT_TAG_VALUES } from "./product-schema";

/**
 * The menu item form's checked fields: name and the two prices.
 *
 * The save used to read prices with `parseFloat(s.replace(",", "."))`, so
 * "1.250,00" became 1,25 TL and anything unreadable became 0 TL, and the
 * create returned without a word when the name was empty while the update
 * saved a blank name. Each field now answers under itself (ActionForm's
 * FormFieldError, keyed by these names).
 */

export const MENU_PRICE_ERROR = "Fiyatı rakamla yaz, ör. 245 ya da 1.250,00.";
export const MENU_PRICE_ZERO_ERROR = "Fiyat 0 olamaz: en az 0,01 TL yaz.";

/** A typed price as kuruş, or the issue that refuses it. */
function readPrice(text: string, ctx: z.RefinementCtx): number {
  const minor = parseMoneyInput(text);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: MENU_PRICE_ERROR });
    return z.NEVER;
  }
  if (minor > CATALOG_MONEY_MAX_MINOR) {
    ctx.addIssue({ code: "custom", message: MONEY_TOO_LARGE_ERROR });
    return z.NEVER;
  }
  return minor;
}

export const menuItemFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Kalemin adını yaz.")
    .max(120, "Ad en fazla 120 karakter olabilir."),
  price: z.string().transform((raw, ctx) => {
    const text = raw.trim();
    if (!text) {
      ctx.addIssue({ code: "custom", message: "Fiyatı yaz." });
      return z.NEVER;
    }
    const minor = readPrice(text, ctx);
    // A 0 TL cup is a free cup: a basket of them totals 0 and is settled as
    // paid without the POS (admin audit CAT-05). L alone may be 0 below.
    if (minor === 0) {
      ctx.addIssue({ code: "custom", message: MENU_PRICE_ZERO_ERROR });
      return z.NEVER;
    }
    return minor;
  }),
  // L is optional: empty (or 0) means the item has one size.
  priceL: z.string().transform((raw, ctx) => {
    const text = raw.trim();
    if (!text || text === "-") return 0;
    return readPrice(text, ctx);
  }),
  // The item's own KDV rate: "" (or absent) is the menu default, null.
  taxRatePct: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      const parsed = parseTaxRateInput(raw);
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: TAX_RATE_INPUT_ERROR });
        return z.NEVER;
      }
      return parsed.value;
    }),
});

type ItemTag = (typeof PRODUCT_TAG_VALUES)[number];

/**
 * The menu item's tags as the form offers them: the app's whole vocabulary
 * (`PRODUCT_TAG_VALUES`, docs/API-MOBILE.md §1), in Turkish. The field used
 * to be free text with the hint "signature, new, iced, nuts, IGP": any word
 * was saved, and the app drops every tag outside the four, so "fındık" or
 * "nut" was an allergen warning no customer ever saw (admin audit CAT-10).
 */
export const MENU_TAG_OPTIONS: ReadonlyArray<readonly [ItemTag, string]> = [
  ["signature", "İmza"],
  ["new", "Yeni"],
  ["iced", "Buzlu"],
  ["nuts", "Sert kabuklu yemiş (fındık · fıstık)"],
];

const isItemTag = (t: string): t is ItemTag =>
  (PRODUCT_TAG_VALUES as readonly string[]).includes(t);

/**
 * The tags a menu save stores: the ticked boxes (one `tags` value each), or
 * a comma list from an older form, kept only where the app knows the word,
 * once each, in the vocabulary's order.
 */
export function menuTagsFromForm(values: readonly unknown[]): ItemTag[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const part of value.split(",")) seen.add(part.trim().toLowerCase());
  }
  return PRODUCT_TAG_VALUES.filter((t) => seen.has(t));
}

/** The stored tags the form cannot show, and the next save will drop. */
export function unknownMenuTags(tags: readonly string[]): string[] {
  return tags.filter((t) => !isItemTag(t));
}
