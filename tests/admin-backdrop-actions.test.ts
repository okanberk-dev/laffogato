import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The panel's save actions pick the scene from the uploaded photo (glass
 * round G5, lafmobil docs/DESIGN-GLASS.md §6.5): the menu item form and the
 * product wizard, create and edit. The store is mocked; the photos are real
 * images read by sharp.
 */

const createMenuItem = vi.fn();
const updateMenuItem = vi.fn();
const getMenuItem = vi.fn();
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
  deleteMenuItem: vi.fn(),
  deleteProduct: vi.fn(),
  getMenuItem,
  getProduct,
  MENU_CATEGORY_KEYS: [
    "matcha",
    "espresso",
    "ice-coffee",
    "cold",
    "hot",
    "frappe",
    "smoothie",
    "frozen",
    "ice-tea",
    "dessert",
    "snack",
    "extras",
  ],
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  updateMenuItem,
  updateProduct,
}));

const { createMenuItemAction, updateMenuItemAction } =
  await import("@/app/admin/menu/actions");
const { createProductAction, updateProductAction } =
  await import("@/app/admin/urunler/actions");

type SharpImage = ReturnType<typeof sharp>;

async function dataUrl(
  image: SharpImage,
  format: "png" | "webp" | "jpeg",
): Promise<string> {
  const bytes = await image.toFormat(format).toBuffer();
  return `data:image/${format};base64,${bytes.toString("base64")}`;
}

/** A transparent 96 px square with a disc of `hex`: a cutout. */
function cutout(hex: string): SharpImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="30" fill="${hex}"/></svg>`;
  return sharp(Buffer.from(svg));
}

/** An opaque 96 px photo of one colour. */
function solid(hex: string): SharpImage {
  return sharp({
    create: { width: 96, height: 96, channels: 3, background: hex },
  });
}

const STRAWBERRY_CUT = await dataUrl(cutout("#E27D9A"), "webp");
const STRAWBERRY_PNG = await dataUrl(cutout("#E27D9A"), "png");
const CARAMEL_JPEG = await dataUrl(solid("#B87333"), "jpeg");

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

const NO_SCENE = {
  backdrop: null,
  backdropSource: "auto",
  backdropHex: null,
  photoCutout: false,
  vessel: null,
};

function storedMenuItem(over: Record<string, unknown>) {
  return {
    id: "mnu-0042",
    categoryKey: "frozen",
    name: "Çilek Frozen",
    desc: "Buzlu çilek",
    priceMinor: 24500,
    priceMinorL: 0,
    hue: "rose",
    image: "",
    tags: [],
    isActive: true,
    sortOrder: 0,
    updatedAt: "2026-09-24T10:00:00.000Z",
    ...NO_SCENE,
    ...over,
  };
}

function lastMenuWrite() {
  const calls = updateMenuItem.mock.calls;
  return calls[calls.length - 1][1];
}

beforeEach(() => {
  for (const fn of [
    createMenuItem,
    updateMenuItem,
    getMenuItem,
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
  createProduct.mockImplementation(async (input) => ({
    id: "prd-0099",
    ...input,
  }));
  updateMenuItem.mockResolvedValue({});
  updateProduct.mockResolvedValue({});
});

describe("menu item form", () => {
  it("stores the automatic pick of an uploaded cutout, marked as a cutout", async () => {
    await createMenuItemAction(
      null,
      menuForm({
        image: JSON.stringify([STRAWBERRY_CUT]),
        backdrop: "auto",
        vessel: "",
      }),
    );
    const input = createMenuItem.mock.calls[0][0];
    // The photo is stored as uploaded: a WebP that kept its transparency.
    expect(input.image).toBe(STRAWBERRY_CUT);
    expect(input).toMatchObject({
      backdrop: "strawberry",
      backdropSource: "auto",
      photoCutout: true,
      vessel: null,
    });
    expect(input.backdropHex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("stores an opaque photo's pick with no cutout", async () => {
    await createMenuItemAction(
      null,
      menuForm({
        categoryKey: "ice-coffee",
        hue: "caramel",
        image: JSON.stringify([CARAMEL_JPEG]),
        backdrop: "auto",
      }),
    );
    expect(createMenuItem.mock.calls[0][0]).toMatchObject({
      backdrop: "caramel",
      photoCutout: false,
    });
  });

  it("keeps a hand-chosen scene when a new photo is uploaded", async () => {
    getMenuItem.mockResolvedValue(
      storedMenuItem({
        image: CARAMEL_JPEG,
        backdrop: "gelato",
        backdropSource: "manual",
      }),
    );
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: JSON.stringify([STRAWBERRY_CUT]), backdrop: "gelato" }),
    );
    expect(lastMenuWrite()).toMatchObject({
      image: STRAWBERRY_CUT,
      backdrop: "gelato",
      backdropSource: "manual",
      // The cutout flag follows the new photo, whatever the source.
      photoCutout: true,
    });
  });

  it("recomputes from the photo when the operator goes back to Otomatik", async () => {
    getMenuItem.mockResolvedValue(
      storedMenuItem({
        image: STRAWBERRY_CUT,
        backdrop: "ice",
        backdropSource: "manual",
        photoCutout: true,
      }),
    );
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: JSON.stringify([STRAWBERRY_CUT]), backdrop: "auto" }),
    );
    expect(lastMenuWrite()).toMatchObject({
      backdrop: "strawberry",
      backdropSource: "auto",
    });
  });

  it("clears an automatic scene when the photo is removed", async () => {
    getMenuItem.mockResolvedValue(
      storedMenuItem({
        image: STRAWBERRY_CUT,
        backdrop: "strawberry",
        backdropHex: "#E27D9A",
        photoCutout: true,
      }),
    );
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: "[]", backdrop: "auto" }),
    );
    expect(lastMenuWrite()).toMatchObject({
      image: "",
      backdrop: null,
      backdropHex: null,
      photoCutout: false,
    });
  });

  it("saves the vessel shape the operator chose, and Kategoriden as null", async () => {
    getMenuItem.mockResolvedValue(storedMenuItem({}));
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: "[]", backdrop: "auto", vessel: "tulip" }),
    );
    expect(lastMenuWrite().vessel).toBe("tulip");

    getMenuItem.mockResolvedValue(storedMenuItem({ vessel: "tulip" }));
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: "[]", backdrop: "auto", vessel: "" }),
    );
    expect(lastMenuWrite().vessel).toBeNull();
  });

  it("keeps the stored scene and vessel when an old form sends neither field", async () => {
    getMenuItem.mockResolvedValue(
      storedMenuItem({
        image: STRAWBERRY_CUT,
        backdrop: "berry",
        backdropSource: "manual",
        vessel: "cloche",
        photoCutout: true,
      }),
    );
    await updateMenuItemAction(
      "mnu-0042",
      null,
      menuForm({ image: JSON.stringify([STRAWBERRY_CUT]) }),
    );
    expect(lastMenuWrite()).toMatchObject({
      backdrop: "berry",
      backdropSource: "manual",
      vessel: "cloche",
      photoCutout: true,
    });
  });

  it("never stores a photo the uploader could not fit, and never pretends it was read", async () => {
    // A data URL over the 2 MB cap is dropped by the action (the uploader
    // downscales or refuses before it gets here): no photo, no pick.
    const huge = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}`;
    await createMenuItemAction(
      null,
      menuForm({ image: JSON.stringify([huge]), backdrop: "auto" }),
    );
    expect(createMenuItem.mock.calls[0][0]).toMatchObject({
      image: "",
      backdrop: null,
      photoCutout: false,
    });
  });
});

describe("product wizard", () => {
  it("picks the scene from the FIRST photo and marks a PNG cutout", async () => {
    await createProductAction(
      {},
      productForm({
        cat: "gift",
        img: "rose",
        images: JSON.stringify([STRAWBERRY_PNG, CARAMEL_JPEG]),
        backdrop: "auto",
        vessel: "",
      }),
    );
    expect(createProduct.mock.calls[0][0]).toMatchObject({
      images: [STRAWBERRY_PNG, CARAMEL_JPEG],
      backdrop: "strawberry",
      backdropSource: "auto",
      photoCutout: true,
      vessel: null,
    });
  });

  it("runs no automatic pick for gear, but still reads the cutout", async () => {
    await createProductAction(
      {},
      productForm({
        cat: "gear",
        img: "caramel",
        images: JSON.stringify([STRAWBERRY_CUT]),
        backdrop: "auto",
      }),
    );
    expect(createProduct.mock.calls[0][0]).toMatchObject({
      backdrop: null,
      backdropSource: "auto",
      photoCutout: true,
    });
  });

  it("keeps a hand choice and the vessel across a new first photo", async () => {
    getProduct.mockResolvedValue({
      id: "prd-0001",
      images: [CARAMEL_JPEG],
      ...NO_SCENE,
      backdrop: "espresso",
      backdropSource: "manual",
      vessel: "pack",
    });
    await updateProductAction(
      "prd-0001",
      {},
      productForm({
        images: JSON.stringify([STRAWBERRY_CUT]),
        backdrop: "espresso",
        vessel: "pack",
      }),
    );
    expect(updateProduct.mock.calls[0][1]).toMatchObject({
      backdrop: "espresso",
      backdropSource: "manual",
      photoCutout: true,
      vessel: "pack",
    });
  });

  it("clears an automatic scene when every photo is removed", async () => {
    getProduct.mockResolvedValue({
      id: "prd-0001",
      images: [CARAMEL_JPEG],
      ...NO_SCENE,
      backdrop: "caramel",
      backdropHex: "#B87333",
    });
    await updateProductAction(
      "prd-0001",
      {},
      productForm({ images: "[]", backdrop: "auto" }),
    );
    expect(updateProduct.mock.calls[0][1]).toMatchObject({
      images: [],
      backdrop: null,
      backdropHex: null,
      photoCutout: false,
    });
  });

  it("passes the scene choice through the schema, not as a stored column", async () => {
    await createProductAction(
      {},
      productForm({ images: "[]", backdrop: "citrus", vessel: "shot" }),
    );
    const input = createProduct.mock.calls[0][0];
    expect(input).toMatchObject({
      backdrop: "citrus",
      backdropSource: "manual",
      vessel: "shot",
    });
    expect(input).not.toHaveProperty("backdropChoice");
    expect(input).not.toHaveProperty("vesselChoice");
  });
});
