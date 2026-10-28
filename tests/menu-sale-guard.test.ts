import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOADED_SALE_FIELDS,
  loadedSaleInputs,
  MENU_ITEM_CHANGED_MEANWHILE,
  readLoadedSale,
  touchedSaleFields,
} from "@/lib/admin/menu-sale-guard";

/**
 * The menu item form's guard over the sale fields (senkron plan S1,
 * docs/PANEL-MENU.md "Sitenin formu"). The form used to write the prices
 * and "Menüde göster" back as it had loaded them: a description saved in a
 * tab opened before the köşk's panel (or another tab) marked the item
 * "Tükendi" put it back on sale, and a price the panel set was silently
 * undone. Now the edit form carries what it loaded; the save writes only
 * the sale fields changed here, each only while the row still holds the
 * loaded value (the store half is pinned against a real Postgres in
 * tests/db-integration-panel-menu.test.ts).
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async (_entry: unknown) => {}),
  setAdminFlash: vi.fn(async (_message: string) => {}),
  redirect: vi.fn((_to: string) => {
    throw new Error("NEXT_REDIRECT");
  }),
  store: {
    getMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    markMenuPricesChanged: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "menu@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/admin/store", () => ({
  ...h.store,
  MENU_CATEGORY_KEYS: ["matcha", "frozen"],
  MENU_CATEGORY_LABELS: { matcha: "Matcha", frozen: "Frozen" },
}));

const menu = await import("@/app/admin/menu/actions");
const { MenuItemForm } = await import("@/components/admin/menu-item-form");

const ITEM = {
  id: "mnu-0042",
  categoryKey: "matcha",
  name: "Çilekli Matcha",
  desc: "Taze çilek",
  priceMinor: 24_500,
  priceMinorL: 0,
  hue: "rose",
  image: "",
  tags: [],
  isActive: true,
  sortOrder: 0,
  updatedAt: "2026-10-01T10:00:00.000Z",
  backdrop: null,
  backdropSource: "auto",
  backdropHex: null,
  photoCutout: false,
  vessel: null,
};

/** The edit form as it posts: the visible fields and what it loaded. */
function form(
  fields: Record<string, string> = {},
  loaded: Record<string, string> | null = {
    loadedPriceMinor: "24500",
    loadedPriceMinorL: "0",
    loadedIsActive: "true",
  },
): FormData {
  const fd = new FormData();
  const all = {
    categoryKey: "matcha",
    name: "Çilekli Matcha",
    desc: "Taze çilek",
    price: "245,00",
    priceL: "",
    hue: "rose",
    sortOrder: "0",
    isActive: "on",
    image: "[]",
    ...(loaded ?? {}),
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.logAudit.mockClear();
  h.setAdminFlash.mockClear();
  h.redirect.mockClear();
  h.store.getMenuItem.mockResolvedValue(ITEM);
  h.store.updateMenuItem.mockResolvedValue(ITEM);
});

describe("the guard's rules (menu-sale-guard.ts)", () => {
  const loaded = { priceMinor: 24_500, priceMinorL: 0, isActive: true };

  it("names the fields the form changed from what it loaded", () => {
    expect(touchedSaleFields(loaded, loaded)).toEqual([]);
    expect(
      touchedSaleFields(loaded, { ...loaded, priceMinor: 26_000 }),
    ).toEqual(["priceMinor"]);
    expect(touchedSaleFields(loaded, { ...loaded, isActive: false })).toEqual([
      "isActive",
    ]);
    expect(
      touchedSaleFields(loaded, { ...loaded, priceMinorL: 28_000 }),
    ).toEqual(["priceMinorL"]);
    // A blank L and a stored 0 (or a stray negative) are the same single size.
    expect(touchedSaleFields({ ...loaded, priceMinorL: -5 }, loaded)).toEqual(
      [],
    );
    // Without what was loaded (a tab from before the guard): all three.
    expect(touchedSaleFields(null, loaded)).toEqual([
      "priceMinor",
      "priceMinorL",
      "isActive",
    ]);
  });

  it("reads all three hidden fields or none", () => {
    const fd = new FormData();
    for (const { name, value } of loadedSaleInputs({
      priceMinor: 24_500,
      priceMinorL: 28_000,
      isActive: false,
    })) {
      fd.set(name, value);
    }
    expect(readLoadedSale(fd)).toEqual({
      priceMinor: 24_500,
      priceMinorL: 28_000,
      isActive: false,
    });
    for (const [name, value] of [
      [LOADED_SALE_FIELDS.priceMinor, "245,00"],
      [LOADED_SALE_FIELDS.priceMinorL, ""],
      [LOADED_SALE_FIELDS.isActive, "on"],
      [LOADED_SALE_FIELDS.priceMinor, "1e9"],
    ] as const) {
      const broken = new FormData();
      for (const [k, v] of fd.entries()) broken.set(k, v);
      broken.set(name, value);
      expect(readLoadedSale(broken)).toBeNull();
    }
    expect(readLoadedSale(new FormData())).toBeNull();
  });
});

describe("the edit form", () => {
  const noop = async () => ({ ok: true as const, message: "" });
  const hidden = (html: string) =>
    (
      html.match(/<input[^>]*type="hidden"[^>]*name="loaded[^"]*"[^>]*>/g) ?? []
    ).map((t) => [
      /name="([^"]+)"/.exec(t)?.[1],
      /value="([^"]*)"/.exec(t)?.[1],
    ]);

  it("carries the prices and the state it loaded, as stored", () => {
    const html = renderToStaticMarkup(
      createElement(MenuItemForm, {
        action: noop,
        item: { ...ITEM, priceMinorL: 28_000, isActive: false } as never,
        submitLabel: "Kaydet",
        cancelHref: "/admin/menu",
      }),
    );
    expect(hidden(html)).toEqual([
      ["loadedPriceMinor", "24500"],
      ["loadedPriceMinorL", "28000"],
      ["loadedIsActive", "false"],
    ]);
    // "Menüde göster" stays on the form, with the stored state.
    expect(html).toMatch(/<input[^>]*name="isActive"/);
    expect(html).toContain("uygulamada en geç yaklaşık 15 dakika");
    expect(html).not.toContain("en geç 5 dakika");
  });

  it("has nothing to guard on a new item or a copy", () => {
    for (const item of [undefined, ITEM]) {
      const html = renderToStaticMarkup(
        createElement(MenuItemForm, {
          action: noop,
          item: item as never,
          submitLabel: "Menüye ekle",
          cancelHref: "/admin/menu",
          mode: "wizard",
        }),
      );
      expect(hidden(html)).toEqual([]);
      expect(html).toContain("uygulamada en geç yaklaşık 15 dakika");
    }
  });
});

describe("updateMenuItemAction", () => {
  it("hands the store what the form loaded", async () => {
    await expect(
      menu.updateMenuItemAction(ITEM.id, null, form({ desc: "Yeni" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.updateMenuItem).toHaveBeenCalledWith(
      ITEM.id,
      expect.objectContaining({ desc: "Yeni", priceMinor: 24_500 }),
      { priceMinor: 24_500, priceMinorL: 0, isActive: true },
    );
  });

  it("refuses a save whose touched field moved meanwhile, and keeps the form", async () => {
    h.store.updateMenuItem.mockResolvedValue("stale");
    const res = await menu.updateMenuItemAction(
      ITEM.id,
      null,
      form({ price: "260" }),
    );
    expect(res).toEqual({ ok: false, error: MENU_ITEM_CHANGED_MEANWHILE });
    expect(MENU_ITEM_CHANGED_MEANWHILE).toMatch(/bu arada değişti/);
    expect(h.redirect).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.store.markMenuPricesChanged).not.toHaveBeenCalled();
  });

  it("does not mark the price list for a price it left alone", async () => {
    // The panel set 250 ₺ after the form opened on 245 ₺; the form saved
    // only its description. The store wrote no price: no mark, no price in
    // the trail.
    h.store.getMenuItem.mockResolvedValue({ ...ITEM, priceMinor: 25_000 });
    await expect(
      menu.updateMenuItemAction(ITEM.id, null, form({ desc: "Yeni" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.markMenuPricesChanged).not.toHaveBeenCalled();
    expect(h.logAudit.mock.calls[0]?.[0]).toMatchObject({
      payload: expect.not.objectContaining({ priceMinor: expect.anything() }),
    });
  });

  it("marks the price list for a price it changed", async () => {
    await expect(
      menu.updateMenuItemAction(ITEM.id, null, form({ price: "260" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.markMenuPricesChanged).toHaveBeenCalledTimes(1);
    expect(h.logAudit.mock.calls[0]?.[0]).toMatchObject({
      payload: { priceMinor: 26_000 },
    });
    expect(h.logAudit.mock.calls[0]?.[0]).toMatchObject({
      payload: expect.not.objectContaining({ priceMinorL: expect.anything() }),
    });
  });

  it("keeps out of the trail the other size's price it did not write", async () => {
    // The form opened on M 140 ₺ / L 160 ₺; meanwhile the köşk's panel set
    // L to 170 ₺. The form touched only M: the store kept the panel's L,
    // so the owner's trail must not say this save put L back to 160 ₺.
    const twoSizes = { ...ITEM, priceMinor: 14_000, priceMinorL: 16_000 };
    h.store.getMenuItem.mockResolvedValue({ ...twoSizes, priceMinorL: 17_000 });
    h.store.updateMenuItem.mockResolvedValue({
      ...twoSizes,
      priceMinor: 14_500,
      priceMinorL: 17_000,
    });
    await expect(
      menu.updateMenuItemAction(
        ITEM.id,
        null,
        form(
          { price: "145", priceL: "160" },
          {
            loadedPriceMinor: "14000",
            loadedPriceMinorL: "16000",
            loadedIsActive: "true",
          },
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.updateMenuItem.mock.calls[0]?.[2]).toEqual({
      priceMinor: 14_000,
      priceMinorL: 16_000,
      isActive: true,
    });
    expect(h.store.markMenuPricesChanged).toHaveBeenCalledTimes(1);
    const payload = (h.logAudit.mock.calls[0]?.[0] as { payload: object })
      .payload;
    expect(payload).toMatchObject({ priceMinor: 14_500 });
    expect(payload).not.toHaveProperty("priceMinorL");
  });

  it("keeps the old rule for a tab opened before the guard", async () => {
    h.store.getMenuItem.mockResolvedValue({ ...ITEM, priceMinor: 25_000 });
    await expect(
      menu.updateMenuItemAction(ITEM.id, null, form({}, null)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.updateMenuItem.mock.calls[0]?.[2]).toBeNull();
    // It writes the 245 ₺ it shows over the stored 250 ₺, as it always did.
    expect(h.store.markMenuPricesChanged).toHaveBeenCalledTimes(1);
  });

  it("says so when the item went between the read and the save", async () => {
    h.store.updateMenuItem.mockResolvedValue(null);
    const res = await menu.updateMenuItemAction(ITEM.id, null, form());
    expect(res).toMatchObject({ ok: false });
    expect(h.redirect).not.toHaveBeenCalled();
  });
});
