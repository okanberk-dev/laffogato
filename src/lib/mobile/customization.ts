import { z } from "zod";

/**
 * Cafe drink customisation - the server constant behind `GET /menu`
 * (docs/API-MOBILE.md §1) and the only place an option is ever priced.
 *
 * Pure and client-safe on purpose: no "server-only", no database. The order
 * path resolves a line's options through `resolveOptionPricing` so the extra
 * charge comes from THIS table and never from the request body; the app only
 * ever sends option ids.
 *
 * Prices are minor units (kuruş). `allergens` is carried on every syrup and,
 * since 23 Sep 2026, on every milk - empty or not - so the nut warning is data
 * rather than a special case the app has to remember. The almond milk is a
 * tree nut exactly as the hazelnut syrup is; until then a member who chose it
 * was shown no warning at all (lafmobil rule 4).
 */

/**
 * Every milk id an order line may carry. "oat" stays here only as history:
 * it was sold until 5 Kas 2026 and old orders, receipts and the panel's sales
 * counts name it. It is no longer OFFERED (`CUSTOMIZATION.milks`), so a new
 * line that asks for it is refused by `resolveOptionPricing`.
 */
export const MILK_IDS = ["normal", "lactose-free", "oat", "almond"] as const;
export const ROAST_IDS = ["intense", "light"] as const;
export const SYRUP_IDS = ["none", "vanilla", "caramel", "hazelnut"] as const;
export const ORDER_ITEM_SIZES = ["M", "L", "single"] as const;

export type MilkId = (typeof MILK_IDS)[number];
export type RoastId = (typeof ROAST_IDS)[number];
export type SyrupId = (typeof SYRUP_IDS)[number];
/** Mirrors `OrderItemSize` in src/lib/admin/store.ts without importing it. */
export type OrderItemSize = (typeof ORDER_ITEM_SIZES)[number];

export type Allergen = "nuts";

export interface MilkOption {
  id: MilkId;
  label: string;
  priceMinor: number;
  allergens: Allergen[];
}

export interface RoastOption {
  id: RoastId;
  label: string;
}

export interface SyrupOption {
  id: SyrupId;
  label: string;
  priceMinor: number;
  allergens: Allergen[];
}

export interface Customization {
  milks: MilkOption[];
  roasts: RoastOption[];
  syrups: SyrupOption[];
  extraShotMinor: number;
  sugarMax: number;
}

export const CUSTOMIZATION: Customization = {
  // Three milks (operator, 5 Kas 2026: "çok fazla süt seçeneği var;
  // laktozsuz, badem, normal"). Oat left the menu that day.
  milks: [
    { id: "normal", label: "Normal", priceMinor: 0, allergens: [] },
    { id: "lactose-free", label: "Laktozsuz", priceMinor: 0, allergens: [] },
    { id: "almond", label: "Badem", priceMinor: 2500, allergens: ["nuts"] },
  ],
  roasts: [
    { id: "intense", label: "Yoğun" },
    { id: "light", label: "Hafif" },
  ],
  syrups: [
    { id: "none", label: "Şurup yok", priceMinor: 0, allergens: [] },
    { id: "vanilla", label: "Vanilya", priceMinor: 5000, allergens: [] },
    { id: "caramel", label: "Karamel", priceMinor: 5000, allergens: [] },
    { id: "hazelnut", label: "Fındık", priceMinor: 5000, allergens: ["nuts"] },
  ],
  extraShotMinor: 5000,
  sugarMax: 3,
};

/** The options a cafe line carries (contract §3, `lines[].options`). */
export interface LineOptions {
  milk: MilkId;
  roast: RoastId;
  sugar: number;
  syrup: SyrupId;
  extraShot: boolean;
  note: string;
}

export const DEFAULT_LINE_OPTIONS: LineOptions = {
  milk: "normal",
  roast: "intense",
  sugar: 0,
  syrup: "none",
  extraShot: false,
  note: "",
};

/**
 * Wire validation for `lines[].options`. Every field is optional on the way
 * in and defaulted, so a line with `options: {}` (or none at all) is a plain
 * drink. Unknown ids fail here, before pricing, with a message the app can
 * show as-is.
 */
export const lineOptionsSchema = z.object({
  milk: z
    .enum(MILK_IDS, { error: "Geçersiz süt seçimi." })
    .default(DEFAULT_LINE_OPTIONS.milk),
  roast: z
    .enum(ROAST_IDS, { error: "Geçersiz kavurma seçimi." })
    .default(DEFAULT_LINE_OPTIONS.roast),
  sugar: z
    .number({ error: "Şeker sayısı geçersiz." })
    .int()
    .min(0, { error: "Şeker sayısı 0'dan küçük olamaz." })
    .max(CUSTOMIZATION.sugarMax, {
      error: `En fazla ${CUSTOMIZATION.sugarMax} şeker seçilebilir.`,
    })
    .default(DEFAULT_LINE_OPTIONS.sugar),
  syrup: z
    .enum(SYRUP_IDS, { error: "Geçersiz şurup seçimi." })
    .default(DEFAULT_LINE_OPTIONS.syrup),
  extraShot: z
    .boolean({ error: "Ekstra shot seçimi geçersiz." })
    .default(DEFAULT_LINE_OPTIONS.extraShot),
  note: z
    .string({ error: "Not metni geçersiz." })
    .trim()
    .max(200, { error: "Not en fazla 200 karakter olabilir." })
    .default(DEFAULT_LINE_OPTIONS.note),
});

/**
 * Menu categories that take no customisation: a slice of cake has no milk,
 * roast, sugar, syrup, extra shot or barista note. Mirrors the app's
 * `NON_CUSTOMIZABLE` (lafmobil src/components/menu/orderability.ts), which
 * never draws the customise screen for them and always sends the defaults.
 */
export const NON_CUSTOMIZABLE_CATEGORIES: readonly string[] = [
  "dessert",
  "snack",
  "extras",
];

export function isCustomizableCategory(
  categoryKey: string | undefined,
): boolean {
  return !NON_CUSTOMIZABLE_CATEGORIES.includes(categoryKey ?? "");
}

/**
 * Which option groups a drink offers (operator, 5 Kas 2026: "diğer
 * ürünlerde de seçenekleri azaltabilirsin"). Until then every customizable
 * drink drew every group, so a soda offered milk, a roast and an extra shot.
 *
 * Sent on every `/menu` item as `optionGroups` (additive, §1). It narrows
 * what the app DRAWS; it does not narrow what an order may carry: an app
 * build from before it draws every group, and its lines are priced exactly
 * as before (`resolveOptionPricing`), so nothing a member already has in a
 * basket is refused because of it.
 *
 * By category, with a handful of drinks narrowed by name where the category
 * is wider than the cup (an espresso takes no milk; Turkish coffee only
 * sugar). The name rule is a refinement, not a dependency: a renamed drink
 * falls back to its category's groups. A category this table does not know
 * keeps every group, so a new one is never stripped by accident.
 */
export const OPTION_GROUPS = [
  "milk",
  "roast",
  "sugar",
  "syrup",
  "extraShot",
] as const;
export type OptionGroup = (typeof OPTION_GROUPS)[number];

const ESPRESSO_DRINK: readonly OptionGroup[] = OPTION_GROUPS;

export const CATEGORY_OPTION_GROUPS: Readonly<
  Record<string, readonly OptionGroup[]>
> = {
  espresso: ESPRESSO_DRINK,
  "ice-coffee": ESPRESSO_DRINK,
  matcha: ["milk", "sugar", "syrup"],
  frappe: ["milk", "sugar", "syrup"],
  hot: ["milk", "sugar"],
  "ice-tea": ["sugar"],
  smoothie: [],
  frozen: [],
  cold: [],
};

/** Keyed by the lower-cased Turkish name (`turkishLower`). */
export const ITEM_OPTION_GROUPS: Readonly<
  Record<string, readonly OptionGroup[]>
> = {
  espresso: ["roast", "sugar", "extraShot"],
  americano: ["roast", "sugar", "syrup", "extraShot"],
  "buzlu americano": ["roast", "sugar", "syrup", "extraShot"],
  "türk kahvesi": ["sugar"],
  "filtre kahve": ["milk", "sugar"],
  "cold brew": ["milk", "sugar", "syrup"],
  "buzlu chai": ["milk", "sugar"],
  çay: ["sugar"],
};

function turkishLower(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

/** The groups a menu item offers, in `OPTION_GROUPS` order; [] = none. */
export function optionGroupsFor(
  categoryKey: string | undefined,
  name: string,
): OptionGroup[] {
  if (!isCustomizableCategory(categoryKey)) return [];
  const own = ITEM_OPTION_GROUPS[turkishLower(name)];
  const groups =
    own ?? CATEGORY_OPTION_GROUPS[categoryKey ?? ""] ?? OPTION_GROUPS;
  return OPTION_GROUPS.filter((g) => groups.includes(g));
}

export const orderItemSizeSchema = z.enum(ORDER_ITEM_SIZES, {
  error: "Geçersiz boy seçimi.",
});

export interface OptionPricing {
  /** Human summary for the order line, e.g. "M · yulaf · +1 shot". */
  detail: string;
  /** Total surcharge of the chosen options, minor units. */
  extraMinor: number;
  /** Allergens introduced by the options (the drink's own tags are separate). */
  allergens: Allergen[];
}

/** Thrown for an option id that is not in the table - a client bug. */
export class UnknownOptionError extends RangeError {
  constructor(field: string, value: unknown) {
    super(`Bilinmeyen seçenek: ${field}=${String(value)}`);
    this.name = "UnknownOptionError";
  }
}

function lookup<T extends { id: string }>(
  list: readonly T[],
  field: string,
  id: string,
): T {
  const found = list.find((o) => o.id === id);
  if (!found) throw new UnknownOptionError(field, id);
  return found;
}

/**
 * Prices a cafe line's options and writes its `detail` string.
 *
 * Defaults are silent: a "normal" milk, an "intense" roast, no sugar and no
 * syrup add nothing to the string, so a plain M cappuccino reads "M" and a
 * single-size item with nothing chosen reads "". Labels come from the table
 * and are lower-cased with Turkish rules ("Fındık" → "fındık").
 *
 * Validate with `lineOptionsSchema` first; an id outside the table throws
 * `UnknownOptionError` rather than pricing as zero.
 */
export function resolveOptionPricing(
  options: Partial<LineOptions> | null | undefined,
  size: OrderItemSize = "single",
): OptionPricing {
  const opts: LineOptions = { ...DEFAULT_LINE_OPTIONS, ...(options ?? {}) };
  const milk = lookup(CUSTOMIZATION.milks, "milk", opts.milk);
  const roast = lookup(CUSTOMIZATION.roasts, "roast", opts.roast);
  const syrup = lookup(CUSTOMIZATION.syrups, "syrup", opts.syrup);
  const sugar = Math.min(
    Math.max(0, Math.trunc(Number(opts.sugar) || 0)),
    CUSTOMIZATION.sugarMax,
  );

  const parts: string[] = [];
  if (size !== "single") parts.push(size);
  if (milk.id !== DEFAULT_LINE_OPTIONS.milk) parts.push(lower(milk.label));
  if (roast.id !== DEFAULT_LINE_OPTIONS.roast) parts.push(lower(roast.label));
  if (syrup.id !== DEFAULT_LINE_OPTIONS.syrup) {
    parts.push(`${lower(syrup.label)} şurubu`);
  }
  if (sugar > 0) parts.push(`${sugar} şeker`);
  if (opts.extraShot) parts.push("+1 shot");

  const extraMinor =
    milk.priceMinor +
    syrup.priceMinor +
    (opts.extraShot ? CUSTOMIZATION.extraShotMinor : 0);

  return {
    detail: parts.join(" · "),
    extraMinor,
    // Once each, whichever of the two brought it.
    allergens: [...new Set([...milk.allergens, ...syrup.allergens])],
  };
}

function lower(label: string): string {
  return label.toLocaleLowerCase("tr-TR");
}
