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

import { menuAllergenWords } from "@/lib/menu/allergens";
import { discountNotice, discountShortLabel } from "@/lib/shop/discount";
import { FOOD_LABEL_FIELDS, type FoodLabelKey } from "@/lib/shop/food-label";
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
 * m.17/2-a). The product carries the label fields since 19 Oct 2026
 * (src/lib/shop/food-label.ts); until the operator has entered the
 * ingredients and the allergens, a food page names the free means: ask us,
 * before the order.
 */
export const FOOD_INFO_ASK =
  "İçindekiler, alerjenler ve saklama koşulu için siparişten önce bize sor";
/** The ingredients are entered but the fourteen groups are not. */
export const FOOD_ALLERGEN_ASK = "Alerjenler için siparişten önce bize sor";
/** The groups are entered and the product contains none of them. */
export const NO_ALLERGENS = "14 alerjen grubunun hiçbirini içermez";

/** The order the label rows take, around the allergens. */
const LABEL_BEFORE_ALLERGENS: readonly FoodLabelKey[] = [
  "netQuantity",
  "ingredients",
];

function labelRow(p: Product, key: FoodLabelKey): ProductFact | null {
  const raw = p[key];
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  return { k: FOOD_LABEL_FIELDS.find((f) => f.key === key)!.label, v: text };
}

/** "Gluten, süt" / the none line; null when the groups are not entered. */
function allergenText(p: Product): string | null {
  const words = menuAllergenWords(p.allergens);
  if (words === null) return null;
  if (words.length === 0) return NO_ALLERGENS;
  const text = words.join(", ");
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}

export function productFacts(p: Product): ProductFact[] {
  const rows: ProductFact[] = [];
  const brand = p.brand?.trim();
  if (brand) rows.push({ k: "Marka", v: brand });
  const notes = (p.notes ?? []).map((n) => n.trim()).filter(Boolean);
  if (notes.length > 0) rows.push({ k: "Tat notları", v: notes.join(" · ") });
  for (const key of LABEL_BEFORE_ALLERGENS) {
    const row = labelRow(p, key);
    if (row) rows.push(row);
  }
  // An allergen is never withheld. The entered groups first; else the
  // shelf's `nuts` tag, the same one the app reads: "kuruyemiş" is the menu
  // band's own word, and the regulation's term follows it because a
  // pistachio is not a hazelnut.
  const allergens = allergenText(p);
  if (allergens) rows.push({ k: "Alerjenler", v: allergens });
  else if (p.tags?.includes("nuts")) {
    rows.push({ k: "Alerjenler", v: NUTS_NOTICE });
  }
  for (const f of FOOD_LABEL_FIELDS) {
    if (LABEL_BEFORE_ALLERGENS.includes(f.key)) continue;
    const row = labelRow(p, f.key);
    if (row) rows.push(row);
  }
  const sku = p.sku?.trim();
  if (sku) rows.push({ k: "SKU", v: sku });
  if (
    typeof p.weightGrams === "number" &&
    Number.isFinite(p.weightGrams) &&
    p.weightGrams > 0
  ) {
    rows.push({ k: "Ağırlık", v: `${p.weightGrams} g` });
  }
  if (FOOD_SHELVES.has(p.cat)) {
    const hasIngredients = Boolean(p.ingredients?.trim());
    if (!hasIngredients) {
      rows.push({ k: "İçindekiler", v: FOOD_INFO_ASK, ask: true });
    } else if (allergens === null) {
      rows.push({ k: "Alerjen bilgisi", v: FOOD_ALLERGEN_ASK, ask: true });
    }
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

/**
 * The discount a card, the quick look or the product page shows: the struck
 * price with the sentence naming its first and last day (Ticari Reklam
 * Yön. m.14/1), or null. The shop's mapper sends a compare-at price only
 * while its discount runs and always with its days; without the days
 * nothing is struck out here either.
 */
export function productDiscount(p: Product): {
  was: string;
  wasMinor: number | undefined;
  notice: string;
  short: string;
} | null {
  if (!p.compareAtPrice) return null;
  const notice = discountNotice(p.discountStartsAt, p.discountEndsAt);
  const short = discountShortLabel(p.discountStartsAt, p.discountEndsAt);
  if (!notice || !short) return null;
  return {
    was: p.compareAtPrice,
    wasMinor: p.compareAtPriceMinor,
    notice,
    short,
  };
}
