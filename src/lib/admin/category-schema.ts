import { z } from "zod";

/**
 * Shop categories: the form's rules and the delete guard. Pure (no store, no
 * database) so the action and the tests share them.
 */

/** The fixed slugs the shop filters on (`products.cat`). */
export const SHOP_CATEGORY_SLUGS = [
  "beans",
  "gift",
  "gear",
  "merch",
  "pantry",
] as const;

export type ShopCategorySlug = (typeof SHOP_CATEGORY_SLUGS)[number];

/**
 * The category form. An unknown slug used to fall back to "beans" and an
 * empty label made the create return without a word; both are now refused
 * under their field.
 */
export const categoryFormSchema = z.object({
  slug: z.enum(SHOP_CATEGORY_SLUGS, { error: "Listeden bir slug seç." }),
  label: z
    .string()
    .trim()
    .min(1, "Kategorinin görünen adını yaz.")
    .max(40, "Ad en fazla 40 karakter olabilir."),
  icon: z
    .string()
    .trim()
    .max(2, "İkon tek karakter olmalı.")
    .transform((v) => v || "◯"),
  sortOrder: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return 0;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 999) {
        ctx.addIssue({
          code: "custom",
          message: "Sıralama 0 ile 999 arasında bir tam sayı olmalı.",
        });
        return z.NEVER;
      }
      return n;
    }),
});

/**
 * Why a category cannot be deleted, or null when it can.
 *
 * Products point at a category by its slug (`products.cat`), not by its id.
 * Deleting the only category with a slug its products use left them in a
 * filter that no longer exists; the delete also had no confirm. A duplicate
 * row with the same slug can go: the products keep a category.
 */
export function categoryDeleteBlocker(
  category: { id: string; slug: string },
  categories: ReadonlyArray<{ id: string; slug: string }>,
  products: ReadonlyArray<{ cat: string }>,
): string | null {
  const twin = categories.some(
    (c) => c.id !== category.id && c.slug === category.slug,
  );
  if (twin) return null;
  const used = products.filter((p) => p.cat === category.slug).length;
  if (used === 0) return null;
  return `Bu kategoride ${used} ürün var. Önce ürünleri başka bir kategoriye taşı (Ürünler → toplu işlem → Kategoriye taşı).`;
}
