/**
 * Menu items that have a rehber page: the menu card links its dish to the
 * guide, an internal link in context (the footer lists every guide too, but a
 * dish pointing at its own guide is the stronger signal).
 *
 * Matched on the item's name as the panel writes it. The first rule that
 * matches wins, so the narrower names come first ("Matcha Affogato" is an
 * affogato). Client-safe: slugs only, no guide bodies.
 */
const MENU_GUIDE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/affogato/i, "affogato-nedir"],
  [/tiramis[uù]/i, "tiramisu-tarifi"],
  [/cold brew/i, "cold-brew-nedir"],
  [/frappe/i, "frappe-nedir"],
  [/(İspanyol|Ispanyol|Spanish) Latte/i, "spanish-latte-nedir"],
  [/chai/i, "chai-tea-latte"],
  [/matcha/i, "matcha-nedir"],
  [/san sebastian/i, "san-sebastian-cheesecake"],
  [
    /^(Espresso|Doppio|Ristretto|Cortado|Flat White|Cappuccino|Caffè Latte|Latte|Americano|Macchiato)$/i,
    "espresso-cesitleri",
  ],
];

/** The guide slug for a menu item, or null when it has none. */
export function menuItemGuide(name: string): string | null {
  const trimmed = name.trim();
  for (const [rule, slug] of MENU_GUIDE_RULES) {
    if (rule.test(trimmed)) return slug;
  }
  return null;
}
