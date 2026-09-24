import { describe, expect, it } from "vitest";

import {
  BACKDROP_ALGO_VERSION,
  BACKDROP_FAMILIES,
  BACKDROP_KEYS,
  familyForHue,
  HUE_TO_FAMILY,
  isBackdropKey,
  isVesselKey,
  NO_AUTO_PICK_CATEGORIES,
  VESSEL_KEYS,
  VESSEL_NAMES,
} from "@/lib/backdrop/families";

/**
 * The lists the app mirrors in `src/theme/backdrops.ts` (lafmobil
 * docs/DESIGN-GLASS.md §6.2-§6.3, §4.4). Order matters: the app holds its
 * copy to the contract's, and the contract to this one.
 */

describe("backdrop families", () => {
  it("are the twelve product families, in the design's order", () => {
    expect(BACKDROP_KEYS).toEqual([
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
    ]);
    expect(Object.keys(BACKDROP_FAMILIES)).toEqual([...BACKDROP_KEYS]);
  });

  it("never include the app's screen scenes", () => {
    for (const scene of ["house", "velvet"]) {
      expect(isBackdropKey(scene)).toBe(false);
    }
  });

  it("carry the body colours of DESIGN-GLASS §6.2 and a Turkish name", () => {
    expect(
      Object.fromEntries(
        BACKDROP_KEYS.map((k) => [k, BACKDROP_FAMILIES[k].ref]),
      ),
    ).toEqual({
      espresso: "#3D2818",
      caramel: "#B87333",
      latte: "#D9B98C",
      cocoa: "#6B4226",
      spice: "#C98F5F",
      citrus: "#E8C24A",
      matcha: "#8DB060",
      pistachio: "#A9B870",
      strawberry: "#E27D9A",
      berry: "#7B2F5E",
      ice: "#9CC3E6",
      gelato: "#F0C8D4",
    });
    for (const k of BACKDROP_KEYS) {
      expect(BACKDROP_FAMILIES[k].name.trim()).not.toBe("");
    }
    expect(BACKDROP_FAMILIES.caramel.name).toBe("Karamel");
  });

  it("recognise only their own keys", () => {
    expect(isBackdropKey("caramel")).toBe(true);
    for (const v of ["Caramel", "", " caramel", null, undefined, 3, {}]) {
      expect(isBackdropKey(v)).toBe(false);
    }
  });
});

describe("vessel shapes", () => {
  it("are the six shapes, in the app's order, each with a Turkish name", () => {
    expect(VESSEL_KEYS).toEqual([
      "tumbler",
      "cup",
      "tulip",
      "cloche",
      "shot",
      "pack",
    ]);
    expect(Object.keys(VESSEL_NAMES)).toEqual([...VESSEL_KEYS]);
    expect(isVesselKey("tulip")).toBe(true);
    for (const v of ["glass", "", "Cup", null, 1]) {
      expect(isVesselKey(v)).toBe(false);
    }
  });
});

describe("hue prior (DESIGN-GLASS §6.3)", () => {
  it("maps the menu's 14 hue keys, the shop's included", () => {
    expect(HUE_TO_FAMILY).toEqual({
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
    });
    for (const family of Object.values(HUE_TO_FAMILY)) {
      expect(isBackdropKey(family)).toBe(true);
    }
  });

  it("has no prior for an unknown, empty or inherited key", () => {
    expect(familyForHue("rose")).toBe("strawberry");
    for (const hue of [
      "",
      null,
      undefined,
      "teal",
      "constructor",
      "toString",
    ]) {
      expect(familyForHue(hue)).toBeNull();
    }
  });
});

it("skips the automatic pick for gear and merch only", () => {
  expect([...NO_AUTO_PICK_CATEGORIES]).toEqual(["gear", "merch"]);
  expect(BACKDROP_ALGO_VERSION).toBe("v1");
});
