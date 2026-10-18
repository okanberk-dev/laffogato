/**
 * The allergens of a cafe menu item (18 Oct 2026, decision OP-ALLERGEN-BOARD).
 *
 * A place that serves unpackaged food has to show, for every item, which of
 * the fourteen groups of TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme
 * Yönetmeliği Ek-1 it contains, on the menu, a board or the like (m.15/5),
 * and before the purchase when it sells at a distance, as the app does
 * (m.17/3). "Alerjenler için baristaya danış" alone is not that.
 *
 * Pure and client-safe (no Zod, no database): the panel form, the save
 * action, the store, the web menu and the mobile mapper read the same list.
 *
 * The stored value (`menu_items.allergens`, jsonb) has three states:
 * - null: not entered yet. Nothing is shown next to the item, and the app
 *   keeps "Alerjenler için baristaya danış." (the field is left out of v1).
 * - []: entered, and the item contains none of the fourteen.
 * - keys: the groups it contains, in the order of Ek-1.
 *
 * The `nuts` tag (`menu_items.tags`) stays what the shipped app reads; the
 * save keeps it in step with `sert_kabuklu` (src/app/admin/menu/actions.ts).
 */

export const MENU_ALLERGENS = [
  {
    key: "gluten",
    label: "Gluten",
    panel: "Gluten içeren tahıllar (buğday, çavdar, arpa, yulaf)",
  },
  {
    key: "kabuklular",
    label: "Kabuklular",
    panel: "Kabuklular (karides, yengeç, ıstakoz)",
  },
  { key: "yumurta", label: "Yumurta", panel: "Yumurta" },
  { key: "balik", label: "Balık", panel: "Balık" },
  { key: "yer_fistigi", label: "Yer fıstığı", panel: "Yer fıstığı" },
  { key: "soya", label: "Soya", panel: "Soya" },
  { key: "sut", label: "Süt", panel: "Süt ve süt ürünleri (laktoz dahil)" },
  {
    key: "sert_kabuklu",
    label: "Sert kabuklu meyveler",
    panel: "Sert kabuklu meyveler (badem, fındık, ceviz, kaju, Antep fıstığı)",
  },
  { key: "kereviz", label: "Kereviz", panel: "Kereviz" },
  { key: "hardal", label: "Hardal", panel: "Hardal" },
  { key: "susam", label: "Susam", panel: "Susam" },
  {
    key: "sulfit",
    label: "Sülfit",
    panel: "Sülfit (kükürt dioksit, 10 mg/kg ya da 10 mg/L üstü)",
  },
  { key: "aci_bakla", label: "Acı bakla", panel: "Acı bakla (lupin)" },
  {
    key: "yumusakcalar",
    label: "Yumuşakçalar",
    panel: "Yumuşakçalar (midye, kalamar, ahtapot)",
  },
] as const;

export type MenuAllergen = (typeof MENU_ALLERGENS)[number]["key"];

export const MENU_ALLERGEN_KEYS: readonly MenuAllergen[] = MENU_ALLERGENS.map(
  (a) => a.key,
);

const KEY_SET = new Set<string>(MENU_ALLERGEN_KEYS);

export function isMenuAllergen(value: unknown): value is MenuAllergen {
  return typeof value === "string" && KEY_SET.has(value);
}

/**
 * The allergen that the `nuts` tag stands for: every tree nut (the app's
 * "KURUYEMİŞ"). Peanuts are a legume and their own group.
 */
export const NUTS_ALLERGEN: MenuAllergen = "sert_kabuklu";

/**
 * A stored or posted value as known keys in Ek-1 order, each once; null
 * for "not entered" (null, undefined, anything that is not an array).
 */
export function normalizeMenuAllergens(raw: unknown): MenuAllergen[] | null {
  if (!Array.isArray(raw)) return null;
  const present = new Set(raw.filter(isMenuAllergen));
  return MENU_ALLERGEN_KEYS.filter((k) => present.has(k));
}

/** The groups as words for a sentence ("gluten, süt"), or null. */
export function menuAllergenWords(raw: unknown): string[] | null {
  const keys = normalizeMenuAllergens(raw);
  if (keys === null) return null;
  return keys.map((k) =>
    MENU_ALLERGENS.find((a) => a.key === k)!.label.toLocaleLowerCase("tr-TR"),
  );
}

/** "Alerjenler: gluten, süt" / "Alerjenler: yok"; null when not entered. */
export function menuAllergenLine(raw: unknown): string | null {
  const words = menuAllergenWords(raw);
  if (words === null) return null;
  return `Alerjenler: ${words.length > 0 ? words.join(", ") : "yok"}`;
}

/** The panel form: one checkbox per group, all posting under this name. */
export const MENU_ALLERGENS_FIELD = "allergens";
/** The "Hiçbirini içermez" box's value under the same name. */
export const MENU_ALLERGENS_NONE = "none";
/**
 * A hidden field the form always posts. A save without it (a tab opened
 * before the boxes existed) leaves the stored allergens alone instead of
 * reading the missing boxes as "not entered".
 */
export const MENU_ALLERGENS_SHOWN_FIELD = "allergensShown";
