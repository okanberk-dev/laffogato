import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Menü, Kategoriler, Ürünler and Promosyon actions as the panel now calls
 * them: every one answers an ActionResult (a toast, or errors under the
 * fields), deletes sit behind ConfirmButton, and the silent paths are gone:
 *
 * - a menu item with no name, or a price the panel cannot read, was created
 *   as nothing (create) or saved blank (update);
 * - a category delete had no confirm and left products in a filter that no
 *   longer existed; an empty label returned without a word;
 * - a promo was hard-deleted on the first click, and there was no switch;
 * - the counter's "Tükendi" took a tick and the bulk bar.
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async (_message: string) => {}),
  redirect: vi.fn((_to: string) => {
    throw new Error("NEXT_REDIRECT");
  }),
  store: {
    bulkUpdateMenuItems: vi.fn(),
    bulkUpdateProducts: vi.fn(),
    createMenuItem: vi.fn(),
    createProduct: vi.fn(),
    deleteMenuItem: vi.fn(),
    deleteProduct: vi.fn(),
    getMenuItem: vi.fn(),
    markMenuPricesChanged: vi.fn(),
    listMenuItemLabels: vi.fn(),
    moveMenuItem: vi.fn(),
    getProduct: vi.fn(),
    updateMenuItem: vi.fn(),
    updateProduct: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getCategory: vi.fn(),
    listCategories: vi.fn(),
    listProducts: vi.fn(),
    restoreCategory: vi.fn(),
    updateCategory: vi.fn(),
    createPromo: vi.fn(),
    deletePromo: vi.fn(),
    getPromo: vi.fn(),
    setPromoActive: vi.fn(),
    updatePromo: vi.fn(),
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
  slugify: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

const menu = await import("@/app/admin/menu/actions");
const categories = await import("@/app/admin/kategoriler/actions");
const products = await import("@/app/admin/urunler/actions");
const promos = await import("@/app/admin/promosyon/actions");
const { categoryDeleteBlocker } = await import("@/lib/admin/category-schema");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const MENU_FORM = {
  categoryKey: "matcha",
  name: "Çilekli Matcha",
  desc: "Taze çilek",
  price: "245",
  priceL: "",
  hue: "rose",
  tags: "",
  sortOrder: "0",
  isActive: "on",
  image: "[]",
};

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

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.logAudit.mockClear();
  h.setAdminFlash.mockClear();
  h.redirect.mockClear();
  h.store.createMenuItem.mockImplementation(async (input) => ({
    id: "mnu-0099",
    ...input,
  }));
  h.store.updateMenuItem.mockResolvedValue({});
});

describe("menu item create / update", () => {
  it("refuses a missing name and an unreadable price under their fields", async () => {
    const res = await menu.createMenuItemAction(
      null,
      form({ ...MENU_FORM, name: " ", price: "1,250.00" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: {
        name: "Kalemin adını yaz.",
        price: expect.stringMatching(/rakamla yaz/i),
      },
    });
    expect(h.store.createMenuItem).not.toHaveBeenCalled();
  });

  it("refuses a photo it cannot store under the photo, instead of saving the item without one", async () => {
    // The shared uploader takes an http:// link (products accept one); the
    // menu stores only https, a stored photo or a site path, and used to save
    // the item with no photo behind a success toast (admin audit, 5c).
    const cases: [string, RegExp][] = [
      ['["http://cdn.example.com/latte.jpg"]', /https:\/\/ ile başlamalı/],
      [
        `["https://cdn.example.com/${"a".repeat(500)}.jpg"]`,
        /en çok 500 karakter/,
      ],
      ['["ftp://cdn.example.com/latte.jpg"]', /Fotoğraf yükle/],
      ["[not json", /Fotoğraf yükle/],
    ];
    for (const [image, message] of cases) {
      const created = await menu.createMenuItemAction(
        null,
        form({ ...MENU_FORM, image }),
      );
      expect(created).toMatchObject({ ok: false });
      expect(created.ok ? {} : created.fieldErrors).toMatchObject({
        image: expect.stringMatching(message),
      });
      h.store.getMenuItem.mockResolvedValue({
        ...ITEM,
        image: "https://cdn.example.com/eski.jpg",
      });
      const updated = await menu.updateMenuItemAction(
        ITEM.id,
        null,
        form({ ...MENU_FORM, image }),
      );
      expect(updated.ok ? {} : updated.fieldErrors).toMatchObject({
        image: expect.stringMatching(message),
      });
    }
    expect(h.store.createMenuItem).not.toHaveBeenCalled();
    expect(h.store.updateMenuItem).not.toHaveBeenCalled();
  });

  it("still stores an https link, a site path, an uploaded photo and no photo", async () => {
    for (const [image, stored] of [
      [
        '["https://cdn.example.com/latte.jpg"]',
        "https://cdn.example.com/latte.jpg",
      ],
      ["/menu/matcha-latte.webp", "/menu/matcha-latte.webp"],
      ['["data:image/jpeg;base64,AAAA"]', "data:image/jpeg;base64,AAAA"],
      ["[]", ""],
      ["", ""],
    ]) {
      h.store.createMenuItem.mockClear();
      // A save answers with the list (redirect), not a result
      await expect(
        menu.createMenuItemAction(null, form({ ...MENU_FORM, image })),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(h.store.createMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ image: stored }),
      );
    }
  });

  it("stores 1.250,00 as 1250 TL and leaves a toast for the list", async () => {
    await expect(
      menu.createMenuItemAction(
        null,
        form({ ...MENU_FORM, price: "1.250,00" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.createMenuItem.mock.calls[0][0]).toMatchObject({
      name: "Çilekli Matcha",
      priceMinor: 125_000,
      priceMinorL: 0,
    });
    expect(h.setAdminFlash).toHaveBeenCalledWith(
      '"Çilekli Matcha" menüye eklendi.',
    );
  });

  it("says a hidden item is saved, not on the menu", async () => {
    // A copy starts hidden ("Menüde göster" off).
    const { isActive: _shown, ...hidden } = MENU_FORM;
    await expect(menu.createMenuItemAction(null, form(hidden))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(h.setAdminFlash).toHaveBeenCalledWith(
      '"Çilekli Matcha" kaydedildi; “Menüde göster” işaretlenene kadar menüde görünmez.',
    );
  });

  it("Kaydet ve yenisini ekle opens the next form in the same category", async () => {
    await expect(
      menu.createMenuItemAction(
        null,
        form({ ...MENU_FORM, categoryKey: "frozen", sonra: "yeni" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirect).toHaveBeenCalledWith("/admin/menu/yeni?cat=frozen");
    expect(h.setAdminFlash).toHaveBeenCalledWith(
      '"Çilekli Matcha" menüye eklendi. Sıradakini gir.',
    );
  });

  it("no longer saves a blank name on an edit", async () => {
    h.store.getMenuItem.mockResolvedValue(ITEM);
    const res = await menu.updateMenuItemAction(
      "mnu-0042",
      null,
      form({ ...MENU_FORM, name: "" }),
    );
    expect(res.ok).toBe(false);
    expect(h.store.updateMenuItem).not.toHaveBeenCalled();
  });

  it("says so when the item was deleted while the form was open", async () => {
    h.store.getMenuItem.mockResolvedValue(null);
    const res = await menu.updateMenuItemAction(
      "mnu-0042",
      null,
      form(MENU_FORM),
    );
    expect(res).toEqual({
      ok: false,
      error: "Bu kalem silinmiş; listeye dön.",
    });
    expect(h.store.updateMenuItem).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("the menu list's ↑ / ↓ (admin audit CAT-30, the order half)", () => {
  it("moves within the category, audits the move and answers for the toast", async () => {
    h.store.moveMenuItem.mockResolvedValue("moved");
    const res = await menu.moveMenuItemAction(
      null,
      form({ id: "mnu-0042", direction: "down" }),
    );
    expect(h.store.moveMenuItem).toHaveBeenCalledWith("mnu-0042", "down");
    expect(res).toEqual({
      ok: true,
      message: "Kalem bir geriye alındı.",
      tone: "success",
    });
    expect(h.logAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "menu_item",
      entityId: "mnu-0042",
      payload: { move: "down" },
    });
  });

  it("says so at the edge, and refuses a request with no way", async () => {
    h.store.moveMenuItem.mockResolvedValue("edge");
    expect(
      await menu.moveMenuItemAction(
        null,
        form({ id: "mnu-0042", direction: "up" }),
      ),
    ).toEqual({ ok: false, error: "Kalem zaten en başta." });
    expect(
      await menu.moveMenuItemAction(null, form({ id: "mnu-0042" })),
    ).toMatchObject({ ok: false });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("menu tags (admin audit CAT-10, decision D21)", () => {
  it("keeps only the four tags the app knows, from the ticked boxes", async () => {
    const fd = form(MENU_FORM);
    fd.delete("tags");
    for (const t of ["nuts", "new", "IGP", "nuts"]) fd.append("tags", t);
    await expect(menu.createMenuItemAction(null, fd)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    // In the vocabulary's order, once each; "IGP" never reached the app.
    expect(h.store.createMenuItem.mock.calls[0][0].tags).toEqual([
      "new",
      "nuts",
    ]);
  });

  it("reads an older form's comma list the same way", async () => {
    h.store.getMenuItem.mockResolvedValue(ITEM);
    await expect(
      menu.updateMenuItemAction(
        "mnu-0042",
        null,
        form({ ...MENU_FORM, tags: "Signature, fındık, nut, ICED " }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.updateMenuItem.mock.calls[0][1].tags).toEqual([
      "signature",
      "iced",
    ]);
  });
});

describe("menu bulk tool (admin audit CAT-20)", () => {
  it("logs the ids and the names it read before the write", async () => {
    h.store.listMenuItemLabels.mockResolvedValue([
      { id: "mnu-0001", name: "Matcha Latte" },
      { id: "mnu-0002", name: "Affogato" },
    ]);
    h.store.bulkUpdateMenuItems.mockResolvedValue({ updated: 2 });
    const res = await menu.bulkMenuAction(
      {},
      form({ ids: "mnu-0001,mnu-0002", op: "delete" }),
    );
    expect(res).toEqual({ ok: { op: "delete", updated: 2 } });
    expect(h.store.listMenuItemLabels).toHaveBeenCalledWith([
      "mnu-0001",
      "mnu-0002",
    ]);
    const read = h.store.listMenuItemLabels.mock.invocationCallOrder[0];
    const write = h.store.bulkUpdateMenuItems.mock.invocationCallOrder[0];
    expect(read).toBeLessThan(write);
    expect(h.logAudit).toHaveBeenCalledWith({
      action: "bulk_delete",
      entity: "menu_item",
      payload: {
        op: "delete",
        value: undefined,
        updated: 2,
        idCount: 2,
        ids: ["mnu-0001", "mnu-0002"],
        names: ["Matcha Latte", "Affogato"],
      },
    });
  });
});

describe("the row's Tükendi / Satışa aç", () => {
  it("hides the item in one click and says so", async () => {
    h.store.getMenuItem.mockResolvedValue(ITEM);
    h.store.bulkUpdateMenuItems.mockResolvedValue({ updated: 1 });
    const res = await menu.setMenuItemActiveAction(
      null,
      form({ id: "mnu-0042", isActive: "false" }),
    );
    expect(h.store.bulkUpdateMenuItems).toHaveBeenCalledWith(["mnu-0042"], {
      kind: "deactivate",
    });
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toContain("tükendi");
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { name: ITEM.name, isActive: false },
      }),
    );
  });

  it("takes the state asked for, not a flip, and refuses anything else", async () => {
    const res = await menu.setMenuItemActiveAction(
      null,
      form({ id: "mnu-0042", isActive: "toggle" }),
    );
    expect(res.ok).toBe(false);
    expect(h.store.bulkUpdateMenuItems).not.toHaveBeenCalled();
  });
});

describe("menu and product deletes", () => {
  it("answers a real delete and audits it with the name", async () => {
    h.store.getMenuItem.mockResolvedValue(ITEM);
    h.store.deleteMenuItem.mockResolvedValue(true);
    const res = await menu.deleteMenuItemAction(null, form({ id: "mnu-0042" }));
    expect(res).toEqual({
      ok: true,
      message: '"Çilekli Matcha" silindi.',
      tone: "success",
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityId: "mnu-0042" }),
    );
  });

  it("does not claim a delete that removed nothing", async () => {
    h.store.getProduct.mockResolvedValue(null);
    h.store.deleteProduct.mockResolvedValue(false);
    const res = await products.deleteProductAction(
      null,
      form({ id: "prd-0001" }),
    );
    expect(res).toEqual({ ok: false, error: "Ürün zaten silinmiş." });
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("from the record's own page, answers with its list and the toast", async () => {
    // `then=list`: the page has nothing left to show after the delete.
    h.store.getMenuItem.mockResolvedValue(ITEM);
    h.store.deleteMenuItem.mockResolvedValue(true);
    h.store.getProduct.mockResolvedValue({ name: "Sirena", sku: "SIRE-1" });
    h.store.deleteProduct.mockResolvedValue(true);
    h.store.getPromo.mockResolvedValue({ code: "GUZ10" });
    h.store.deletePromo.mockResolvedValue(true);
    const cases = [
      () =>
        menu.deleteMenuItemAction(null, form({ id: "mnu-0042", then: "list" })),
      () =>
        products.deleteProductAction(
          null,
          form({ id: "prd-0001", then: "list" }),
        ),
      () => promos.deletePromoAction(null, form({ id: "prm-1", then: "list" })),
    ];
    for (const run of cases)
      await expect(run()).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirect.mock.calls.map((c) => c[0])).toEqual([
      "/admin/menu",
      "/admin/urunler",
      "/admin/promosyon",
    ]);
    expect(h.setAdminFlash.mock.calls.map((c) => c[0])).toEqual([
      '"Çilekli Matcha" silindi.',
      '"Sirena" silindi.',
      "GUZ10 silindi.",
    ]);
  });

  it("never takes the list's address from the form", async () => {
    h.store.getMenuItem.mockResolvedValue(ITEM);
    h.store.deleteMenuItem.mockResolvedValue(true);
    await expect(
      menu.deleteMenuItemAction(
        null,
        form({ id: "mnu-0042", then: "list", next: "https://evil.test" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.redirect).toHaveBeenCalledWith("/admin/menu");
  });
});

describe("categories", () => {
  const BEANS = { id: "cat-1", slug: "beans", label: "Çekirdek" };

  it("refuses an empty label and an unknown slug under their fields", async () => {
    const res = await categories.createCategoryAction(
      null,
      form({ slug: "shoes", label: " ", icon: "", sortOrder: "" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: {
        slug: "Listeden bir slug seç.",
        label: "Kategorinin görünen adını yaz.",
      },
    });
    expect(h.store.createCategory).not.toHaveBeenCalled();
  });

  it("creates with a toast for the list", async () => {
    h.store.listCategories.mockResolvedValue([]);
    h.store.createCategory.mockResolvedValue({ ...BEANS, id: "cat-9" });
    await expect(
      categories.createCategoryAction(
        null,
        form({ slug: "beans", label: "Çekirdek", icon: "", sortOrder: "3" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.createCategory).toHaveBeenCalledWith({
      slug: "beans",
      label: "Çekirdek",
      icon: "◯",
      sortOrder: 3,
    });
    expect(h.setAdminFlash).toHaveBeenCalledWith(
      '"Çekirdek" kategorisi eklendi.',
    );
  });

  it("refuses a slug another category already has (admin audit CAT-06)", async () => {
    // All five slugs are seeded: "+ Yeni kategori" could only make a twin,
    // and every category select in the panel then listed "Çekirdek" twice.
    h.store.listCategories.mockResolvedValue([BEANS]);
    const res = await categories.createCategoryAction(
      null,
      form({ slug: "beans", label: "Kahve", icon: "", sortOrder: "" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.stringContaining('"Çekirdek"') },
    });
    expect(h.store.createCategory).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("refuses an edit that moves a category onto another one's slug", async () => {
    const GIFT = { id: "cat-3", slug: "gift", label: "Hediye" };
    h.store.getCategory.mockResolvedValue({
      ...BEANS,
      icon: "◯",
      sortOrder: 0,
    });
    h.store.listCategories.mockResolvedValue([BEANS, GIFT]);
    h.store.listProducts.mockResolvedValue([]);
    const res = await categories.updateCategoryAction(
      "cat-1",
      null,
      form({ slug: "gift", label: "Çekirdek", icon: "", sortOrder: "" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.stringContaining('"Hediye"') },
    });
    expect(h.store.updateCategory).not.toHaveBeenCalled();
  });

  it("refuses to delete a category its products still use", async () => {
    h.store.getCategory.mockResolvedValue(BEANS);
    h.store.listCategories.mockResolvedValue([BEANS]);
    h.store.listProducts.mockResolvedValue([
      { cat: "beans" },
      { cat: "beans" },
    ]);
    const res = await categories.deleteCategoryAction(
      null,
      form({ id: "cat-1" }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? "" : res.error).toContain("2 ürün");
    expect(h.store.deleteCategory).not.toHaveBeenCalled();
  });

  it("deletes an empty one, or a duplicate of a slug that stays", async () => {
    h.store.getCategory.mockResolvedValue(BEANS);
    h.store.listCategories.mockResolvedValue([
      BEANS,
      { id: "cat-2", slug: "beans", label: "Kahve" },
    ]);
    h.store.listProducts.mockResolvedValue([{ cat: "beans" }]);
    h.store.deleteCategory.mockResolvedValue(true);
    const res = await categories.deleteCategoryAction(
      null,
      form({ id: "cat-1" }),
    );
    expect(res).toMatchObject({ ok: true, message: '"Çekirdek" silindi.' });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entity: "category" }),
    );
  });

  it("does not strand products when the slug is changed on the edit form", async () => {
    // The only "beans" row moved to "gift": every bean product was left in a
    // filter that no longer existed, the same hole the delete guard closes.
    h.store.getCategory.mockResolvedValue({
      ...BEANS,
      icon: "☕",
      sortOrder: 0,
    });
    h.store.listCategories.mockResolvedValue([BEANS]);
    h.store.listProducts.mockResolvedValue([
      { cat: "beans" },
      { cat: "beans" },
    ]);
    const res = await categories.updateCategoryAction(
      "cat-1",
      null,
      form({ slug: "gift", label: "Çekirdek", icon: "", sortOrder: "" }),
    );
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? {} : res.fieldErrors).toMatchObject({
      slug: expect.stringContaining("2 ürün"),
    });
    expect(h.store.updateCategory).not.toHaveBeenCalled();
  });

  it("still saves a label edit, or a slug change nothing depends on", async () => {
    h.store.getCategory.mockResolvedValue({
      ...BEANS,
      icon: "☕",
      sortOrder: 0,
    });
    h.store.listCategories.mockResolvedValue([BEANS]);
    h.store.listProducts.mockResolvedValue([{ cat: "beans" }]);
    h.store.updateCategory.mockResolvedValue({ ...BEANS, label: "Kahve" });
    await expect(
      categories.updateCategoryAction(
        "cat-1",
        null,
        form({ slug: "beans", label: "Kahve", icon: "", sortOrder: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    h.store.listProducts.mockResolvedValue([{ cat: "gear" }]);
    await expect(
      categories.updateCategoryAction(
        "cat-1",
        null,
        form({ slug: "gift", label: "Kahve", icon: "", sortOrder: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.updateCategory).toHaveBeenCalledTimes(2);
  });

  it("puts a category back when a twin went in the same moment (delete race)", async () => {
    // Two operators each delete one of two "beans" rows: each check saw the
    // other row and let its delete through, and no "beans" was left.
    const TWIN = { id: "cat-2", slug: "beans", label: "Kahve" };
    h.store.getCategory.mockResolvedValue(BEANS);
    h.store.listCategories
      .mockResolvedValueOnce([BEANS, TWIN]) // the check
      .mockResolvedValueOnce([]); // after the delete: the twin is gone too
    h.store.listProducts.mockResolvedValue([{ cat: "beans" }]);
    h.store.deleteCategory.mockResolvedValue(true);
    h.store.restoreCategory.mockResolvedValue(undefined);
    const res = await categories.deleteCategoryAction(
      null,
      form({ id: "cat-1" }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? "" : res.error).toContain("1 ürün");
    expect(h.store.restoreCategory).toHaveBeenCalledWith(BEANS);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("categoryDeleteBlocker: products by slug, twins exempt", () => {
    const cats = [BEANS, { id: "cat-3", slug: "gift", label: "Hediye" }];
    expect(categoryDeleteBlocker(BEANS, cats, [{ cat: "gift" }])).toBeNull();
    expect(categoryDeleteBlocker(BEANS, cats, [{ cat: "beans" }])).toMatch(
      /1 ürün var/,
    );
    expect(
      categoryDeleteBlocker(
        BEANS,
        [...cats, { id: "cat-4", slug: "beans" }],
        [{ cat: "beans" }],
      ),
    ).toBeNull();
  });
});

describe("promos", () => {
  const PROMO = { id: "prm-0003", code: "GUZ10", isActive: true };

  it("switches a code off from the list and audits the state", async () => {
    h.store.setPromoActive.mockResolvedValue({ ...PROMO, isActive: false });
    const res = await promos.setPromoActiveAction(
      null,
      form({ id: "prm-0003", isActive: "false" }),
    );
    expect(h.store.setPromoActive).toHaveBeenCalledWith("prm-0003", false);
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.message).toContain("GUZ10");
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        payload: { code: "GUZ10", isActive: false },
      }),
    );
  });

  it("refuses a flip request and a code that is gone", async () => {
    expect(
      (await promos.setPromoActiveAction(null, form({ id: "prm-0003" }))).ok,
    ).toBe(false);
    h.store.setPromoActive.mockResolvedValue(null);
    const gone = await promos.setPromoActiveAction(
      null,
      form({ id: "prm-0003", isActive: "true" }),
    );
    expect(gone).toEqual({
      ok: false,
      error: "Kod bulunamadı; sayfayı yenile.",
    });
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  describe("an expired code on the edit form", () => {
    // YAZ25 ran out on 1 Eki 23:59 (stored as UTC) and is still ticked
    // Aktif: expiry never flips isActive. The form shows that date back.
    const EXPIRED = {
      ...PROMO,
      code: "YAZ25",
      kind: "pct",
      value: 25,
      usageLimit: 50,
      expiresAt: "2026-10-01T20:59:00.000Z",
    };
    const FIELDS = {
      code: "YAZ25",
      kind: "pct",
      valuePct: "25",
      minSubtotal: "0,00",
      usageLimit: "80",
      expiresAt: "2026-10-01T23:59",
      isActive: "on",
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-17T09:00:00.000Z"));
      h.store.getPromo.mockResolvedValue(EXPIRED);
      h.store.updatePromo.mockImplementation(async (_id, input) => ({
        ok: true,
        promo: { ...EXPIRED, ...input },
      }));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("saves a new limit and stays expired when the date is left alone", async () => {
      // The untouched past date was refused, and the refusal said "süresiz
      // için boş bırak": the way out was an active 25% code with no end.
      await expect(
        promos.updatePromoAction("prm-0003", {}, form(FIELDS)),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(h.store.updatePromo).toHaveBeenCalledWith(
        "prm-0003",
        expect.objectContaining({
          usageLimit: 80,
          expiresAt: "2026-10-01T20:59:00.000Z",
        }),
      );
    });

    it("still refuses a past date typed in, and never points at blank", async () => {
      const moved = await promos.updatePromoAction(
        "prm-0003",
        {},
        form({ ...FIELDS, expiresAt: "2026-10-05T23:59" }),
      );
      expect(moved.fieldErrors?.expiresAt).toBe(
        "Bu tarih geçmişte kaldı. İleri bir tarih seç.",
      );
      // A new code gets no pass from another code's date.
      const fresh = await promos.createPromoAction({}, form(FIELDS));
      expect(fresh.fieldErrors?.expiresAt).toBe(
        "Bu tarih geçmişte kaldı. İleri bir tarih seç.",
      );
      expect(h.store.updatePromo).not.toHaveBeenCalled();
      expect(h.store.createPromo).not.toHaveBeenCalled();
    });

    it("answers a code deleted meanwhile instead of saving", async () => {
      h.store.getPromo.mockResolvedValue(null);
      const gone = await promos.updatePromoAction("prm-0003", {}, form(FIELDS));
      expect(gone).toEqual({ error: "Kod bulunamadı; sayfayı yenile." });
      expect(h.store.updatePromo).not.toHaveBeenCalled();
    });
  });

  it("deletes with a toast, and only audits a real removal", async () => {
    h.store.getPromo.mockResolvedValue(PROMO);
    h.store.deletePromo.mockResolvedValue(true);
    const res = await promos.deletePromoAction(null, form({ id: "prm-0003" }));
    expect(res).toMatchObject({ ok: true, message: "GUZ10 silindi." });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", payload: { code: "GUZ10" } }),
    );

    h.logAudit.mockClear();
    h.store.deletePromo.mockResolvedValue(false);
    const again = await promos.deletePromoAction(
      null,
      form({ id: "prm-0003" }),
    );
    expect(again).toEqual({ ok: false, error: "Kod zaten silinmiş." });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});
