import { describe, it, expect } from "vitest";

import { MENU } from "@/components/laffogato/data";
import { menuFamily } from "@/components/laffogato/visuals";

/**
 * Before the category-aware router existed, every menu item whose name did not
 * look like an espresso, a matcha or an affogato fell through to `EspressoCup`
 * — so a lemonade, a cheesecake and a sandwich all rendered as a hot coffee.
 * These tests lock that shut: a category may only resolve to the espresso cup
 * if it genuinely is one.
 */

const ALL_ITEMS = Object.entries(MENU).flatMap(([cat, c]) =>
  c.items.map((it) => ({ cat, name: it.name })),
);

describe("menu art coverage", () => {
  it("covers every item on the menu", () => {
    expect(ALL_ITEMS.length).toBeGreaterThan(80);
    for (const { cat, name } of ALL_ITEMS) {
      expect(menuFamily(cat, name), `${cat}/${name}`).toBeTruthy();
    }
  });

  it("only draws an espresso cup for actual coffee", () => {
    const wrong = ALL_ITEMS.filter(
      ({ cat, name }) =>
        menuFamily(cat, name) === "espresso" && cat !== "espresso",
    );
    expect(
      wrong,
      `espresso fincanına düşen kalemler: ${JSON.stringify(wrong)}`,
    ).toEqual([]);
  });

  it("gives each category its own drawing family", () => {
    const expected: Record<string, string> = {
      matcha: "matcha",
      "ice-coffee": "iced",
      frappe: "frappe",
      smoothie: "smoothie",
      frozen: "frozen",
      "ice-tea": "iced",
      dessert: "cake",
      snack: "snack",
      extras: "extra",
    };
    for (const [cat, family] of Object.entries(expected)) {
      const items = MENU[cat]?.items ?? [];
      expect(items.length, `${cat} boş`).toBeGreaterThan(0);
      for (const it of items) {
        // Affogato outranks its category — it is the signature ritual.
        if (/affogato/i.test(it.name)) continue;
        expect(menuFamily(cat, it.name), `${cat}/${it.name}`).toBe(family);
      }
    }
  });

  it("separates bottled drinks from poured ones in Cold Drinks", () => {
    expect(menuFamily("cold", "Su")).toBe("bottle");
    expect(menuFamily("cold", "Soda")).toBe("bottle");
    expect(menuFamily("cold", "L'Af Limon")).toBe("iced");
    expect(menuFamily("cold", "Cool Lime")).toBe("iced");
  });

  it("pours Turkish tea into a tea glass, not a mug", () => {
    expect(menuFamily("hot", "Tea")).toBe("tea");
    expect(menuFamily("hot", "Salep")).toBe("mug");
    expect(menuFamily("hot", "Hot Chocolate")).toBe("mug");
  });

  it("keeps the affogato ritual whatever category it sits in", () => {
    expect(menuFamily("matcha", "Matcha Affogato")).toBe("affogato");
    expect(menuFamily("espresso", "L'Affogato")).toBe("affogato");
  });
});
