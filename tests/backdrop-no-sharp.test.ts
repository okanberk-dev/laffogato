import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The colour step never stops a save (review L-1, 25 Sep 2026). sharp is a
 * native module: a deploy whose function lacked the platform binary used to
 * fail on `import sharp from "sharp"` at the top of `from-image.ts`, and with
 * it every action in the menu and product action files, delete and bulk
 * included. Here sharp cannot load at all, as on such a deploy.
 */

vi.mock("sharp", () => {
  throw new Error(
    'Could not load the "sharp" module using the linux-x64 runtime',
  );
});

const createMenuItem = vi.fn();
const updateMenuItem = vi.fn();
const getMenuItem = vi.fn();
const deleteMenuItem = vi.fn();
const createProduct = vi.fn();
const updateProduct = vi.fn();
const getProduct = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "menu@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn() }));
// The saves leave a toast in a cookie; there is no request here.
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  bulkUpdateMenuItems: vi.fn(),
  bulkUpdateProducts: vi.fn(),
  createMenuItem,
  createProduct,
  deleteMenuItem,
  deleteProduct: vi.fn(),
  getMenuItem,
  getProduct,
  MENU_CATEGORY_KEYS: ["frozen", "ice-coffee"],
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  updateMenuItem,
  updateProduct,
}));

const errors = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => errors.mockRestore());

// The imports themselves are the first check: with a static sharp import
// these two modules could not load here at all.
const { createMenuItemAction, deleteMenuItemAction, updateMenuItemAction } =
  await import("@/app/admin/menu/actions");
const { updateProductAction } = await import("@/app/admin/urunler/actions");

/** Any uploaded photo: sharp never gets to look at it. */
const PHOTO = "data:image/webp;base64,UklGRhQAAABXRUJQVlA4IAgAAAAwAQCdASoBAAEA";

function menuForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  const all: Record<string, string> = {
    categoryKey: "frozen",
    name: "Çilek Frozen",
    desc: "Buzlu çilek",
    price: "245",
    hue: "rose",
    tags: "",
    sortOrder: "0",
    isActive: "on",
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) fd.set(k, v);
  return fd;
}

function productForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  const all: Record<string, string> = {
    name: "Sirena Espresso",
    tag: "Çekirdek · 250g",
    desc: "Espresso harmanı",
    cat: "beans",
    img: "caramel",
    price: "320",
    stock: "10",
    ...fields,
  };
  for (const [k, v] of Object.entries(all)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of [
    createMenuItem,
    updateMenuItem,
    getMenuItem,
    deleteMenuItem,
    createProduct,
    updateProduct,
    getProduct,
  ]) {
    fn.mockReset();
  }
  createMenuItem.mockImplementation(async (input) => ({
    id: "mnu-0099",
    ...input,
  }));
  updateMenuItem.mockResolvedValue({});
  updateProduct.mockResolvedValue({});
  errors.mockClear();
});

describe("a save when sharp will not load", () => {
  it("stores a new photo without a pick, taken as opaque, and says why in the log", async () => {
    await createMenuItemAction(
      null,
      menuForm({ image: JSON.stringify([PHOTO]), backdrop: "auto" }),
    );
    expect(createMenuItem).toHaveBeenCalledTimes(1);
    expect(createMenuItem.mock.calls[0][0]).toMatchObject({
      name: "Çilek Frozen",
      image: PHOTO,
      backdrop: null,
      backdropSource: "auto",
      backdropHex: null,
      photoCutout: false,
    });
    // The loader's reason (vitest wraps the factory's error in its own).
    expect(errors).toHaveBeenCalledWith(
      "[backdrop] sharp could not be loaded, saving without a scene pick:",
      expect.any(String),
    );
  });

  it("keeps what was measured for the same photo", async () => {
    getMenuItem.mockResolvedValue({
      id: "mnu-0042",
      categoryKey: "frozen",
      name: "Çilek Frozen",
      desc: "Buzlu çilek",
      priceMinor: 24500,
      priceMinorL: 0,
      hue: "rose",
      image: PHOTO,
      tags: [],
      isActive: true,
      sortOrder: 0,
      updatedAt: "2026-09-24T10:00:00.000Z",
      backdrop: "strawberry",
      backdropSource: "auto",
      backdropHex: "#E27D9A",
      photoCutout: true,
      vessel: "tulip",
    });
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({
        image: JSON.stringify([PHOTO]),
        backdrop: "auto",
        vessel: "tulip",
        price: "255",
      }),
    );
    expect(updateMenuItem.mock.calls[0][1]).toMatchObject({
      priceMinor: 25500,
      backdrop: "strawberry",
      backdropSource: "auto",
      backdropHex: "#E27D9A",
      photoCutout: true,
      vessel: "tulip",
    });
  });

  it("still writes the operator's hand choice and vessel", async () => {
    getProduct.mockResolvedValue({
      id: "prd-0001",
      images: [],
      backdrop: null,
      backdropSource: "auto",
      backdropHex: null,
      photoCutout: false,
      vessel: null,
    });
    await updateProductAction(
      "prd-0001",
      {},
      productForm({
        images: JSON.stringify([PHOTO]),
        backdrop: "espresso",
        vessel: "pack",
      }),
    );
    expect(updateProduct.mock.calls[0][1]).toMatchObject({
      images: [PHOTO],
      backdrop: "espresso",
      backdropSource: "manual",
      photoCutout: false,
      vessel: "pack",
    });
  });

  it("leaves the actions that never read a photo untouched", async () => {
    const fd = new FormData();
    fd.set("id", "mnu-0042");
    await deleteMenuItemAction(null, fd);
    expect(deleteMenuItem).toHaveBeenCalledWith("mnu-0042");
  });
});
