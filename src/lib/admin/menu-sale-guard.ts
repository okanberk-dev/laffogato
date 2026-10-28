import { CATALOG_MONEY_MAX_MINOR } from "@/lib/utils/format";

/**
 * The menu item form's guard over an item's sale fields: its M and L prices
 * and "Menüde göster" (`isActive`). Two other writers change exactly these
 * while the form is open: the köşk's panel (`POST /api/panel/menu`, and
 * with it LafPOS) and the menu list's one-click "Tükendi" / "Satışa aç" in
 * another tab. The form used to write all three back as it had loaded
 * them, so saving a new description put a sold-out item back on sale.
 *
 * Now the edit form carries what it loaded (three hidden fields). A sale
 * field the operator did not touch is left out of the UPDATE; a touched one
 * is written only while the row still holds the loaded value, like the
 * bulk switch (store.ts `bulkUpdateMenuItems`). A save that finds a touched
 * field moved is refused whole: "Bu kalem bu arada değişti".
 * docs/PANEL-MENU.md "Sitenin formu", docs/PANEL-SENKRON.md.
 *
 * Pure: the form (client), the action and the store share it.
 */

/** The three sale fields of a menu item. */
export type MenuSaleKey = "priceMinor" | "priceMinorL" | "isActive";

export const MENU_SALE_KEYS: readonly MenuSaleKey[] = [
  "priceMinor",
  "priceMinorL",
  "isActive",
];

/** An item's sale values: kuruş, KDV included; L 0 is a single size. */
export interface MenuSaleValues {
  priceMinor: number;
  priceMinorL: number;
  isActive: boolean;
}

/** The hidden fields that carry what the edit form loaded. */
export const LOADED_SALE_FIELDS: Readonly<Record<MenuSaleKey, string>> = {
  priceMinor: "loadedPriceMinor",
  priceMinorL: "loadedPriceMinorL",
  isActive: "loadedIsActive",
};

/** The refusal when a touched sale field moved after the form was opened. */
export const MENU_ITEM_CHANGED_MEANWHILE =
  "Bu kalem bu arada değişti (panel ya da başka sekme); değişikliklerin kaydedilmedi. Sayfayı yenile.";

/** The hidden fields' values for an item as the form loads it. */
export function loadedSaleInputs(
  item: MenuSaleValues,
): Array<{ name: string; value: string }> {
  return [
    { name: LOADED_SALE_FIELDS.priceMinor, value: String(item.priceMinor) },
    { name: LOADED_SALE_FIELDS.priceMinorL, value: String(item.priceMinorL) },
    {
      name: LOADED_SALE_FIELDS.isActive,
      value: item.isActive ? "true" : "false",
    },
  ];
}

function readMinor(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !/^-?\d{1,12}$/.test(raw)) return null;
  const n = Number(raw);
  return Math.abs(n) <= CATALOG_MONEY_MAX_MINOR ? n : null;
}

/**
 * What the form loaded, or null when it does not say (a tab opened before
 * the guard existed, or a broken field): the save then writes all three as
 * it always did. All three or none.
 */
export function readLoadedSale(formData: FormData): MenuSaleValues | null {
  const priceMinor = readMinor(formData.get(LOADED_SALE_FIELDS.priceMinor));
  const priceMinorL = readMinor(formData.get(LOADED_SALE_FIELDS.priceMinorL));
  const active = formData.get(LOADED_SALE_FIELDS.isActive);
  if (priceMinor === null || priceMinorL === null) return null;
  if (active !== "true" && active !== "false") return null;
  return { priceMinor, priceMinorL, isActive: active === "true" };
}

const largeOf = (minor: number) => (minor > 0 ? minor : 0);

/**
 * The sale fields the save writes: those the form changed from what it
 * loaded (an L of 0 and a blank L are the same single size). Without what
 * was loaded, all three, as before the guard.
 */
export function touchedSaleFields(
  loaded: MenuSaleValues | null,
  input: MenuSaleValues,
): MenuSaleKey[] {
  if (!loaded) return [...MENU_SALE_KEYS];
  const out: MenuSaleKey[] = [];
  if (input.priceMinor !== loaded.priceMinor) out.push("priceMinor");
  if (largeOf(input.priceMinorL) !== largeOf(loaded.priceMinorL)) {
    out.push("priceMinorL");
  }
  if (input.isActive !== loaded.isActive) out.push("isActive");
  return out;
}
