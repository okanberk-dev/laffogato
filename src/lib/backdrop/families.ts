/**
 * The scene families the app draws behind a product, and the vessel shapes
 * it draws for an item with no photo (glass round, 24 Sep 2026; lafmobil
 * docs/DESIGN-GLASS.md §6.2, §6.3 and §4.4).
 *
 * Client-safe and pure: the panel's select lists, the mobile mapper, the
 * server-side pick and the backfill script all read these lists.
 *
 * Both key lists are part of the contract (docs/API-MOBILE.md §1, "backdrop ·
 * photoCutout · vessel") and exist twice: here and in the app's
 * `src/theme/backdrops.ts`, in the same order. A test on each side holds its
 * list to the contract's. A new value goes into the contract first, then into
 * both lists in the same release: the app treats an unknown key as null.
 */

/**
 * The twelve product families, in the order of DESIGN-GLASS §6.2. `house`
 * and `velvet` are screen scenes of the app, not product families: the server
 * never stores or publishes them.
 */
export const BACKDROP_KEYS = [
  "espresso",
  "caramel",
  "latte",
  "cocoa",
  "spice",
  "citrus",
  "matcha",
  "pistachio",
  "strawberry",
  "berry",
  "ice",
  "gelato",
] as const;

export type BackdropKey = (typeof BACKDROP_KEYS)[number];

export interface BackdropFamily {
  /** Short Turkish name for the panel ("Otomatik: Karamel"). */
  name: string;
  /** What the family covers, for the select list; "" when the name says it. */
  examples: string;
  /**
   * The drink's BODY colour the automatic pick compares against (#RRGGBB),
   * not the scene's light. The app's `backdrops.ts` carries the light values;
   * the server needs only this one.
   */
  ref: string;
}

export const BACKDROP_FAMILIES: Readonly<Record<BackdropKey, BackdropFamily>> =
  {
    espresso: { name: "Espresso", examples: "", ref: "#3D2818" },
    caramel: { name: "Karamel", examples: "", ref: "#B87333" },
    latte: { name: "Latte ve krema", examples: "", ref: "#D9B98C" },
    cocoa: { name: "Kakao", examples: "", ref: "#6B4226" },
    spice: {
      name: "Baharat",
      examples: "chai, balkabağı, şeftali",
      ref: "#C98F5F",
    },
    citrus: {
      name: "Narenciye ve güneş",
      examples: "limon, mango, ananas, çay",
      ref: "#E8C24A",
    },
    matcha: { name: "Matcha", examples: "", ref: "#8DB060" },
    pistachio: {
      name: "Antep fıstığı ve adaçayı",
      examples: "",
      ref: "#A9B870",
    },
    strawberry: { name: "Çilek", examples: "", ref: "#E27D9A" },
    berry: { name: "Orman meyvesi ve erik", examples: "", ref: "#7B2F5E" },
    ice: { name: "Buz mavisi", examples: "soda, su", ref: "#9CC3E6" },
    gelato: {
      name: "Gelato pasteli",
      examples: "dondurmalı kalemler",
      ref: "#F0C8D4",
    },
  };

export function isBackdropKey(value: unknown): value is BackdropKey {
  return (
    typeof value === "string" &&
    (BACKDROP_KEYS as readonly string[]).includes(value)
  );
}

/**
 * The drawn vessel shapes, in the app's order (DESIGN-GLASS §4.4). The
 * operator picks one in the panel for a photo-less item whose category shape
 * does not fit (tea in a `tulip`); null means "from the category".
 */
export const VESSEL_KEYS = [
  "tumbler",
  "cup",
  "tulip",
  "cloche",
  "shot",
  "pack",
] as const;

export type VesselKey = (typeof VESSEL_KEYS)[number];

/** Turkish names for the panel's "Kap biçimi" list. */
export const VESSEL_NAMES: Readonly<Record<VesselKey, string>> = {
  tumbler: "Uzun bardak",
  cup: "Fincan ve tabak",
  tulip: "İnce belli bardak",
  cloche: "Cam fanus",
  shot: "Shot bardağı",
  pack: "Paket (kutu, torba)",
};

export function isVesselKey(value: unknown): value is VesselKey {
  return (
    typeof value === "string" &&
    (VESSEL_KEYS as readonly string[]).includes(value)
  );
}

/**
 * The item's `hue` as the pick's prior (DESIGN-GLASS §6.3): the menu's 14
 * keys (the app's 12 plus the site's `dark` and `strawberry`) and every key
 * the shop's `img` uses. A photo whose body colour lands inside the accept
 * radius of this family keeps it, and a near tie between two families is
 * settled by it (see `pick.ts`).
 */
export const HUE_TO_FAMILY: Readonly<Record<string, BackdropKey>> = {
  caramel: "caramel",
  espresso: "espresso",
  cream: "latte",
  dawn: "spice",
  warm: "cocoa",
  gold: "citrus",
  matcha: "matcha",
  pistachio: "pistachio",
  rose: "strawberry",
  strawberry: "strawberry",
  bougainvillea: "berry",
  sky: "ice",
  stone: "ice",
  dark: "espresso",
};

/** The family a `hue` points at, or null for an unknown or empty hue. */
export function familyForHue(
  hue: string | null | undefined,
): BackdropKey | null {
  if (!hue) return null;
  return Object.prototype.hasOwnProperty.call(HUE_TO_FAMILY, hue)
    ? HUE_TO_FAMILY[hue]
    : null;
}

/**
 * Shop categories where no automatic pick runs (DESIGN-GLASS §6.5 step 8): a
 * moka pot or an apron has no drink body, so its photo's colour says nothing
 * about the scene. The category mapping applies in the app; the operator can
 * still choose a family by hand.
 */
export const NO_AUTO_PICK_CATEGORIES: readonly string[] = ["gear", "merch"];

/**
 * The pick algorithm's version. A later change to the thresholds or the
 * refs bumps it, so the backfill can say which rule a stored pick came from.
 */
export const BACKDROP_ALGO_VERSION = "v1";
