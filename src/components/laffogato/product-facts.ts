/**
 * What the shop says about one product: the "Ürün detayları" rows of the
 * product page and of the quick look, and the free-shipping figure.
 *
 * Every row comes from the product itself (CAT-M01, decision D19). The rows
 * used to be fixed per shelf: every gift "Gluten · süt · soya izi" and "90
 * gün", every piece of gear "Bialetti × L'Affogato" and a two-year warranty,
 * every coffee Sirena's origin and tasting notes - so the bamboo chasen
 * carried a Bialetti warranty and the Kenya lot a Brazilian origin. A
 * feature the page shows and the goods lack makes them defective (6502 m.8/2)
 * and misleads about their make-up (Ticari Reklam Yön. m.7/5-a); a warranty
 * term is the maker's or importer's certificate (6502 m.56), not a shelf's.
 *
 * Pure and client-safe: the product page, the quick look and their tests
 * read it.
 */

import { priceLabel } from "@/lib/utils/format";

import type { Product } from "./data";

/** A row of the product's details; `ask` rows end with the shop's contact. */
export interface ProductFact {
  k: string;
  v: string;
  ask?: true;
}

/** The nut allergen, said the way the menu says it (the `nuts` tag). */
export const NUTS_NOTICE = "Kuruyemiş (sert kabuklu meyve) içerir";

/**
 * Shelves whose goods are, or may be, packaged food: coffee, the pantry and
 * the gift sets (the edible cup box sits under "gift"). Gear and clothing
 * are not food.
 */
const FOOD_SHELVES: ReadonlySet<string> = new Set(["beans", "pantry", "gift"]);

/**
 * Packaged food sold at a distance owes its mandatory information
 * (ingredients, the Ek-1 allergens, storage...) before the purchase, on the
 * page or by another free means the seller names (TGK Etiketleme Yön.
 * m.17/2-a). The panel holds only the `nuts` tag so far, so a food page
 * names the free means: ask us, before the order. When the product gets its
 * own ingredient and allergen fields, this row reads them instead.
 */
export const FOOD_INFO_ASK =
  "İçindekiler, alerjenler ve saklama koşulu için siparişten önce bize sor";

export function productFacts(p: Product): ProductFact[] {
  const rows: ProductFact[] = [];
  const brand = p.brand?.trim();
  if (brand) rows.push({ k: "Marka", v: brand });
  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean);
  if (notes.length > 0) rows.push({ k: "Tat notları", v: notes.join(" · ") });
  const sku = p.sku?.trim();
  if (sku) rows.push({ k: "SKU", v: sku });
  if (
    typeof p.weightGrams === "number" &&
    Number.isFinite(p.weightGrams) &&
    p.weightGrams > 0
  ) {
    rows.push({ k: "Ağırlık", v: `${p.weightGrams} g` });
  }
  // An allergen is never withheld. The shelf's `nuts` tag is the same one
  // the app reads; "kuruyemiş" is the menu band's own word, and the
  // regulation's term follows it because a pistachio is not a hazelnut.
  if (p.tags?.includes("nuts")) rows.push({ k: "Alerjenler", v: NUTS_NOTICE });
  if (FOOD_SHELVES.has(p.cat)) {
    rows.push({ k: "İçindekiler", v: FOOD_INFO_ASK, ask: true });
  }
  return rows;
}

/**
 * The free-shipping threshold as the shop writes it ("500₺"), or null when
 * it is off (0) or unknown: Ayarlar → "Ücretsiz kargo eşiği" decides, and a
 * figure the checkout does not apply is not printed (MSY m.5/1-d, Ticari
 * Reklam Yön. m.13/1).
 */
export function freeShippingFrom(thresholdMinor: number | undefined) {
  if (
    typeof thresholdMinor !== "number" ||
    !Number.isFinite(thresholdMinor) ||
    thresholdMinor <= 0
  ) {
    return null;
  }
  return priceLabel(thresholdMinor);
}
