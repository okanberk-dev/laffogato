import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMenuItem } from "@/lib/admin/store";
import {
  MENU_ALLERGENS_FIELD,
  MENU_ALLERGENS_NONE,
  MENU_ALLERGENS_SHOWN_FIELD,
  MENU_ALLERGEN_KEYS,
  menuAllergenLine,
  menuAllergenWords,
  normalizeMenuAllergens,
} from "@/lib/menu/allergens";
import {
  MENU_ALLERGEN_CONFLICT_ERROR,
  MENU_ALLERGEN_NUTS_ERROR,
  MENU_ALLERGEN_UNKNOWN_ERROR,
  readMenuAllergens,
  tagsWithAllergens,
} from "@/lib/admin/menu-allergens-schema";
import { toMobileMenuItem } from "@/lib/mobile/menu-mapper";

/**
 * The fourteen allergen groups per cafe menu item (18 Oct 2026, decision
 * OP-ALLERGEN-BOARD, TGK Etiketleme Yön. m.15/5 and m.17/3): the closed
 * list, the three stored states (not entered, none, the groups), the panel
 * form and its save, the column's check, and the optional v1 field.
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async () => {}),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  createMenuItem: vi.fn(),
  getMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "menu@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/admin/store", () => ({
  createMenuItem: h.createMenuItem,
  getMenuItem: h.getMenuItem,
  updateMenuItem: h.updateMenuItem,
  bulkUpdateMenuItems: vi.fn(),
  deleteMenuItem: vi.fn(),
  MENU_CATEGORY_KEYS: ["matcha", "dessert"],
  MENU_CATEGORY_LABELS: { matcha: "Matcha Bar", dessert: "Tatlılar" },
}));

const menu = await import("@/app/admin/menu/actions");
const { MenuItemForm } = await import("@/components/admin/menu-item-form");
const { MenuFoodInfoStatus } =
  await import("@/components/admin/menu-food-info-status");

const EK1 = [
  "gluten",
  "kabuklular",
  "yumurta",
  "balik",
  "yer_fistigi",
  "soya",
  "sut",
  "sert_kabuklu",
  "kereviz",
  "hardal",
  "susam",
  "sulfit",
  "aci_bakla",
  "yumusakcalar",
];

function boxes(
  values: string[],
  { shown = true, extra = {} as Record<string, string> } = {},
): FormData {
  const fd = new FormData();
  if (shown) fd.set(MENU_ALLERGENS_SHOWN_FIELD, "1");
  for (const v of values) fd.append(MENU_ALLERGENS_FIELD, v);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("the closed list (TGK Ek-1)", () => {
  it("is the fourteen groups, in the order of the annex", () => {
    expect(MENU_ALLERGEN_KEYS).toEqual(EK1);
  });

  it("is the list the column's check allows, key for key", () => {
    const sql = readFileSync(
      "db/migrations/20261018210100_menu_item_allergens.sql",
      "utf8",
    ).replace(/--[^\n]*/g, "");
    const list = /allergens <@ '(\[[\s\S]*?\])'::jsonb/.exec(sql)?.[1];
    expect(JSON.parse(list!)).toEqual(EK1);
    expect(sql).toMatch(
      /alter table public\.menu_items add column if not exists allergens jsonb;/,
    );
    // No default: an existing row is "not entered", never "contains none".
    expect(sql).not.toMatch(/allergens jsonb[^;]*default/i);
    expect(sql).toMatch(/\)\s*not valid;/);
  });
});

describe("normalizeMenuAllergens / menuAllergenLine", () => {
  it("keeps not entered (null) apart from none ([])", () => {
    expect(normalizeMenuAllergens(null)).toBeNull();
    expect(normalizeMenuAllergens(undefined)).toBeNull();
    expect(normalizeMenuAllergens("sut")).toBeNull();
    expect(normalizeMenuAllergens([])).toEqual([]);
    expect(menuAllergenLine(null)).toBeNull();
    expect(menuAllergenLine([])).toBe("Alerjenler: yok");
  });

  it("orders known keys as the annex does, once each, and drops the rest", () => {
    expect(
      normalizeMenuAllergens(["sut", "gluten", "sut", "nuts", 3, "susam"]),
    ).toEqual(["gluten", "sut", "susam"]);
    expect(menuAllergenLine(["sut", "gluten"])).toBe("Alerjenler: gluten, süt");
    expect(menuAllergenLine(["sert_kabuklu", "yer_fistigi", "sulfit"])).toBe(
      "Alerjenler: yer fıstığı, sert kabuklu meyveler, sülfit",
    );
    expect(menuAllergenWords(["sut", "gluten"])).toEqual(["gluten", "süt"]);
    expect(menuAllergenWords([])).toEqual([]);
    expect(menuAllergenWords(null)).toBeNull();
  });
});

describe("readMenuAllergens (the panel's boxes)", () => {
  it("reads no box as not entered and the none box as none", () => {
    expect(readMenuAllergens(boxes([]))).toEqual({
      ok: true,
      allergens: null,
    });
    expect(readMenuAllergens(boxes([MENU_ALLERGENS_NONE]))).toEqual({
      ok: true,
      allergens: [],
    });
    expect(readMenuAllergens(boxes(["sut", "gluten"]))).toEqual({
      ok: true,
      allergens: ["gluten", "sut"],
    });
  });

  it("keeps the stored value when the form had no boxes", () => {
    expect(readMenuAllergens(boxes(["sut"], { shown: false }))).toEqual({
      ok: true,
      allergens: undefined,
    });
  });

  it("refuses none next to a group, and a key off the list, under the field", () => {
    for (const [values, message] of [
      [[MENU_ALLERGENS_NONE, "sut"], MENU_ALLERGEN_CONFLICT_ERROR],
      [["nuts"], MENU_ALLERGEN_UNKNOWN_ERROR],
    ] as const) {
      const read = readMenuAllergens(boxes([...values]));
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.issues[0]?.path[0]).toBe("allergens");
        expect(read.issues[0]?.message).toBe(message);
      }
    }
  });
});

describe("tagsWithAllergens (the app reads only `nuts`)", () => {
  it("adds nuts for tree nuts, not for peanuts", () => {
    expect(tagsWithAllergens(["iced"], ["sert_kabuklu"])).toEqual({
      ok: true,
      tags: ["iced", "nuts"],
    });
    expect(tagsWithAllergens([], ["yer_fistigi"])).toEqual({
      ok: true,
      tags: [],
    });
  });

  it("refuses a nuts tag next to an entered list without tree nuts", () => {
    expect(tagsWithAllergens(["nuts"], ["sut"])).toEqual({
      ok: false,
      error: MENU_ALLERGEN_NUTS_ERROR,
    });
    expect(tagsWithAllergens(["nuts"], [])).toEqual({
      ok: false,
      error: MENU_ALLERGEN_NUTS_ERROR,
    });
  });

  it("leaves the tags alone while the allergens are not entered", () => {
    expect(tagsWithAllergens(["nuts"], null)).toEqual({
      ok: true,
      tags: ["nuts"],
    });
    expect(tagsWithAllergens(["nuts"], undefined)).toEqual({
      ok: true,
      tags: ["nuts"],
    });
  });
});

const MENU_FORM = {
  categoryKey: "dessert",
  name: "Klasik Spoonful",
  desc: "Kaşık kaşık kremalı klasik tatlı.",
  price: "220",
  priceL: "",
  hue: "cream",
  tags: "",
  sortOrder: "0",
  isActive: "on",
  image: "[]",
};

const ITEM: AdminMenuItem = {
  id: "mnu-0067",
  categoryKey: "dessert",
  name: "Klasik Spoonful",
  desc: "Kaşık kaşık kremalı klasik tatlı.",
  priceMinor: 22_000,
  priceMinorL: 0,
  hue: "cream",
  image: "",
  tags: [],
  allergens: ["sut"],
  isActive: true,
  sortOrder: 0,
  updatedAt: "2026-10-01T10:00:00.000Z",
  backdrop: null,
  backdropSource: "auto",
  backdropHex: null,
  photoCutout: false,
  vessel: null,
};

describe("the menu item save", () => {
  beforeEach(() => {
    h.createMenuItem.mockReset();
    h.updateMenuItem.mockReset();
    h.getMenuItem.mockReset();
    h.logAudit.mockClear();
    h.createMenuItem.mockImplementation(async (input) => ({
      id: "mnu-0099",
      ...input,
    }));
    h.updateMenuItem.mockResolvedValue({});
  });

  it("stores the ticked groups in annex order and audits them", async () => {
    await expect(
      menu.createMenuItemAction(
        null,
        boxes(["sut", "gluten", "yumurta"], { extra: MENU_FORM }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.createMenuItem.mock.calls[0][0].allergens).toEqual([
      "gluten",
      "yumurta",
      "sut",
    ]);
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          allergens: ["gluten", "yumurta", "sut"],
        }),
      }),
    );
  });

  it("stores none as [] and nothing ticked as null", async () => {
    await expect(
      menu.createMenuItemAction(
        null,
        boxes([MENU_ALLERGENS_NONE], { extra: MENU_FORM }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      menu.createMenuItemAction(null, boxes([], { extra: MENU_FORM })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.createMenuItem.mock.calls[0][0].allergens).toEqual([]);
    expect(h.createMenuItem.mock.calls[1][0].allergens).toBeNull();
  });

  it("adds the nuts tag for tree nuts so the shipped app warns too", async () => {
    await expect(
      menu.createMenuItemAction(
        null,
        boxes(["sert_kabuklu"], { extra: { ...MENU_FORM, tags: "iced" } }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.createMenuItem.mock.calls[0][0].tags).toEqual(["iced", "nuts"]);
  });

  it("refuses two answers about nuts, and a conflict, under Alerjenler", async () => {
    const nuts = await menu.createMenuItemAction(
      null,
      boxes(["sut"], { extra: { ...MENU_FORM, tags: "nuts" } }),
    );
    expect(nuts).toEqual({
      ok: false,
      error: "Formdaki uyarıları gider.",
      fieldErrors: { allergens: MENU_ALLERGEN_NUTS_ERROR },
    });
    const both = await menu.createMenuItemAction(
      null,
      boxes([MENU_ALLERGENS_NONE, "sut"], {
        extra: { ...MENU_FORM, name: "" },
      }),
    );
    expect(both).toMatchObject({
      ok: false,
      fieldErrors: {
        name: "Kalemin adını yaz.",
        allergens: MENU_ALLERGEN_CONFLICT_ERROR,
      },
    });
    expect(h.createMenuItem).not.toHaveBeenCalled();
  });

  it("an edit from a form without the boxes keeps the stored allergens", async () => {
    h.getMenuItem.mockResolvedValue(ITEM);
    await expect(
      menu.updateMenuItemAction(
        "mnu-0067",
        null,
        boxes([], { shown: false, extra: MENU_FORM }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    // No key at all: `{ allergens: undefined }` would be written as NULL.
    expect(h.updateMenuItem.mock.calls[0][1]).not.toHaveProperty("allergens");
  });

  it("an edit that unticks every box stores not entered", async () => {
    h.getMenuItem.mockResolvedValue(ITEM);
    await expect(
      menu.updateMenuItemAction(
        "mnu-0067",
        null,
        boxes([], { extra: MENU_FORM }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.updateMenuItem.mock.calls[0][1].allergens).toBeNull();
  });
});

describe("the panel form", () => {
  const render = (item?: AdminMenuItem) =>
    renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: async () => ({ ok: true as const, message: "" }),
        item,
        submitLabel: "Kaydet",
        cancelHref: "/admin/menu",
      }),
    );
  /** Whether the box with this value is ticked, whatever the attribute order. */
  const checked = (html: string, value: string) => {
    const tag = (html.match(/<input[^>]*>/g) ?? []).find(
      (t) =>
        t.includes(`name="${MENU_ALLERGENS_FIELD}"`) &&
        t.includes(`value="${value}"`),
    );
    expect(tag, value).toBeDefined();
    return tag!.includes('checked=""');
  };

  it("offers the fourteen groups and none in a fieldset, with the marker", () => {
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Alerjenler<\/legend>/);
    // Every box is there, and a new item starts with none ticked: not
    // entered, not "none".
    for (const key of [...EK1, MENU_ALLERGENS_NONE]) {
      expect(checked(html, key), key).toBe(false);
    }
    expect(html).toContain(
      `type="hidden" name="${MENU_ALLERGENS_SHOWN_FIELD}" value="1"`,
    );
  });

  it("ticks what the item has, and none only for []", () => {
    const html = render(ITEM);
    expect(checked(html, "sut")).toBe(true);
    expect(checked(html, "gluten")).toBe(false);
    expect(checked(html, MENU_ALLERGENS_NONE)).toBe(false);
    expect(
      checked(render({ ...ITEM, allergens: [] }), MENU_ALLERGENS_NONE),
    ).toBe(true);
    expect(
      checked(render({ ...ITEM, allergens: null }), MENU_ALLERGENS_NONE),
    ).toBe(false);
  });
});

describe("the menu page's allergen count", () => {
  it("counts the items not entered, [] counts as entered", () => {
    const html = renderToStaticMarkup(
      createElement(MenuFoodInfoStatus, {
        items: [
          { allergens: null },
          { allergens: [] },
          { allergens: ["sut"] },
          {},
        ],
        priceDate: "",
      }),
    );
    expect(html).toContain("Alerjeni girilmemiş kalem: 2 / 4.");
    const done = renderToStaticMarkup(
      createElement(MenuFoodInfoStatus, {
        items: [{ allergens: [] }],
        priceDate: "2026-10-18",
      }),
    );
    expect(done).toContain("Alerjenler bütün kalemlerde girildi (1 / 1).");
  });
});

describe("GET /menu `allergens` (v1, additive)", () => {
  const SITE = "https://laffogato.net";

  it("is left out while not entered, so the app keeps its notice", () => {
    expect(
      toMobileMenuItem({ ...ITEM, allergens: null }, SITE),
    ).not.toHaveProperty("allergens");
    const { allergens: _drop, ...older } = ITEM;
    void _drop;
    expect(toMobileMenuItem(older, SITE)).not.toHaveProperty("allergens");
  });

  it("is [] for none and the known keys in annex order otherwise", () => {
    expect(
      toMobileMenuItem({ ...ITEM, allergens: [] }, SITE).allergens,
    ).toEqual([]);
    expect(
      toMobileMenuItem(
        {
          ...ITEM,
          allergens: ["sut", "gluten"] as AdminMenuItem["allergens"],
        },
        SITE,
      ).allergens,
    ).toEqual(["gluten", "sut"]);
  });

  it("leaves tags (and the nuts the shipped app reads) as they were", () => {
    const out = toMobileMenuItem(
      { ...ITEM, tags: ["nuts"], allergens: ["sert_kabuklu"] },
      SITE,
    );
    expect(out.tags).toEqual(["nuts"]);
    expect(out.allergens).toEqual(["sert_kabuklu"]);
  });

  it("is in the contract", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    expect(doc).toContain(
      "### `allergens` - alerjen grupları (18 Eki 2026, yalnız ekleme)",
    );
    for (const key of EK1) expect(doc).toContain(`\`${key}\``);
  });
});
