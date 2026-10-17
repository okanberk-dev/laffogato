import { z } from "zod";

import {
  CATALOG_MONEY_MAX_MINOR,
  MONEY_TOO_LARGE_ERROR,
  parseMoneyInput,
} from "@/lib/utils/format";

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
    return readPrice(text, ctx);
  }),
  // L is optional: empty (or 0) means the item has one size.
  priceL: z.string().transform((raw, ctx) => {
    const text = raw.trim();
    if (!text || text === "-") return 0;
    return readPrice(text, ctx);
  }),
});
