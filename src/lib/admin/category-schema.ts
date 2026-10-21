import { z } from "zod";

/**
 * Shop categories: the form's rules and the delete guard. Pure (no store, no
 * database) so the action and the tests share them.
 */

/**
 * The fixed slugs products point at (`products.cat`). The shop's filter bar,
 * its labels and the /magaza/<kategori> pages are fixed to these five in the
 * storefront code (shop-page.tsx, seo/pages.ts): a category row only names
 * and orders them inside the panel (admin audit CAT-06, decision D18).
 */
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
  const used = strandedProducts(category, categories, products);
  if (used === 0) return null;
  return `Bu kategoride ${used} ürün var. Önce ürünleri başka bir kategoriye taşı (Ürünler → toplu işlem → Kategoriye taşı).`;
}

/**
 * Why a category's slug cannot change to `nextSlug`, or null when it can.
 *
 * Same hole as the delete from the other side: the edit form offers the five
 * slugs, and moving the only "beans" row to "gift" left every bean product
 * in a filter that no longer existed.
 */
export function categorySlugChangeBlocker(
  category: { id: string; slug: string },
  nextSlug: string,
  categories: ReadonlyArray<{ id: string; slug: string }>,
  products: ReadonlyArray<{ cat: string }>,
): string | null {
  if (nextSlug === category.slug) return null;
  const used = strandedProducts(category, categories, products);
  if (used === 0) return null;
  return `Bu slug'a bağlı ${used} ürün var. Slug'ı değiştirmeden önce ürünleri başka bir kategoriye taşı (Ürünler → toplu işlem → Kategoriye taşı).`;
}

/** Products left without a category if this row's slug went away. */
function strandedProducts(
  category: { id: string; slug: string },
  categories: ReadonlyArray<{ id: string; slug: string }>,
  products: ReadonlyArray<{ cat: string }>,
): number {
  const twin = categories.some(
    (c) => c.id !== category.id && c.slug === category.slug,
  );
  if (twin) return 0;
  return products.filter((p) => p.cat === category.slug).length;
}

/**
 * Why `slug` cannot be given to a category, or null when it can: another
 * row (any but `exceptId`) already carries it.
 *
 * Nothing refused a twin, and with all five slugs seeded "+ Yeni kategori"
 * could only ever make one: two "Çekirdek" rows in every category select
 * of the panel (admin audit CAT-06). Rows that are already twins keep
 * working; only a new one is refused.
 */
export function categorySlugTaken(
  slug: string,
  categories: ReadonlyArray<{ id: string; slug: string; label: string }>,
  exceptId?: string,
): string | null {
  const owner = categories.find((c) => c.id !== exceptId && c.slug === slug);
  if (!owner) return null;
  return `Bu slug zaten "${owner.label}" kategorisinde. Adını ya da sırasını değiştirmek için listeden onu düzenle.`;
}

/** The slugs no category row carries yet, in the shop's order. */
export function freeCategorySlugs(
  categories: ReadonlyArray<{ slug: string }>,
): ShopCategorySlug[] {
  const used = new Set(categories.map((c) => c.slug));
  return SHOP_CATEGORY_SLUGS.filter((s) => !used.has(s));
}
