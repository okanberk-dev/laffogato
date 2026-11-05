/**
 * The light behind a product - the site's copy of the app's scene pigments.
 *
 * lafmobil draws every product on porcelain with a pastel halo that comes
 * from the product's own colour (DESIGN-GLASS §6 and §13.8: "ışık üründen
 * gelir" - latte amber behind a latte, matcha green behind a matcha). The
 * twelve family keys are part of the API contract and live, client-safe, in
 * src/lib/backdrop/families.ts; the LIGHT values are the app's alone
 * (src/theme/backdrops.ts, `backdrops`, light stops) and are copied here as
 * pigment, the way the app keeps them: not interface roles, never text or
 * control colours, only the paint behind an object.
 *
 * `core` is the halo's centre, `mid` its half-strength ring, `edge` where it
 * melts into porcelain, `floor` the band the object stands on. `house` (the
 * L'Af green) and `velvet` (bordo) are screen scenes, not product families.
 */
import { familyForHue, type BackdropKey } from "@/lib/backdrop/families";

export type SceneKey = BackdropKey | "house" | "velvet" | "porcelain";

export interface Scene {
  core: string;
  mid: string;
  edge: string;
  floor: string;
  /** A second light (gelato only: mint beside the pink). */
  core2?: string;
}

export const SCENES: Readonly<Record<SceneKey, Scene>> = {
  espresso: { core: "#e0a77a", mid: "#e6c3a8", edge: "#f9e8db", floor: "#f3d8c4" },
  caramel: { core: "#fdaf6d", mid: "#ffcfa8", edge: "#fde6d5", floor: "#fad6ba" },
  latte: { core: "#ecc08c", mid: "#f6dabc", edge: "#f6e9db", floor: "#efdac3" },
  cocoa: { core: "#df9d80", mid: "#e4bba9", edge: "#fbe6de", floor: "#f6d6c9" },
  spice: { core: "#f8a983", mid: "#fac9b2", edge: "#fde6db", floor: "#fad5c4" },
  citrus: { core: "#f1c669", mid: "#fae0ac", edge: "#f6ead2", floor: "#efdcb5" },
  matcha: { core: "#aad081", mid: "#cae1b2", edge: "#e4f0da", floor: "#d3e5c2" },
  pistachio: { core: "#c2cf92", mid: "#dae3bf", edge: "#e9eedd", floor: "#dbe2c7" },
  strawberry: { core: "#ff9bb1", mid: "#fec0cc", edge: "#ffe3e8", floor: "#fed0d8" },
  berry: { core: "#ec89b3", mid: "#ecafc7", edge: "#ffe2ed", floor: "#ffcfe1" },
  ice: { core: "#9bb9fe", mid: "#bcd1ff", edge: "#e2ebff", floor: "#d0defe" },
  gelato: {
    core: "#edbecc",
    mid: "#f8dbe3",
    edge: "#f5e7eb",
    floor: "#edd7dd",
    core2: "#b9dacc",
  },
  house: { core: "#72cbac", mid: "#a8dac6", edge: "#daf1e8", floor: "#c3e8d9" },
  velvet: { core: "#f3899b", mid: "#f2b0b8", edge: "#ffe3e6", floor: "#fed1d6" },
  // Not the app's: a neutral stage for things with no drink body (a moka
  // pot, an apron), the porcelain ground's own deep stop and vignette.
  porcelain: { core: "#e8ded1", mid: "#efe8de", edge: "#f7f3ed", floor: "#ece4d8" },
};

/** The site's `hue` keys (menu items, shop products) → a scene. */
export function sceneForHue(hue: string | undefined | null): SceneKey {
  if (hue === "stone") return "porcelain";
  return familyForHue(hue) ?? "latte";
}

/**
 * The product's backdrop as a CSS background: a flat colour block in the
 * scene's palest tone - clean product photography on a solid wash, never a
 * glow (the café-retail system is colour-block throughout, 5 Kas 2026).
 */
export function sceneBackground(key: SceneKey): string {
  return SCENES[key].edge;
}
