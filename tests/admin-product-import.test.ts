import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

import type { ProductImportState } from "@/lib/admin/product-import-core";
import type { AdminCategory, ProductImportView } from "@/lib/admin/store";

/**
 * Product CSV import (/admin/urunler/ice-aktar): the dry run writes
 * nothing, the import creates and updates by SKU, the same file twice
 * changes nothing, stock moves by a delta with a stock move, one audit row
 * per import, and both actions check the role. The store is a small
 * in-memory catalogue so a second run sees what the first one wrote.
 */

const h = vi.hoisted(() => {
  const db = {
    products: [] as Array<Record<string, unknown>>,
    moves: [] as Array<{ productId: string; delta: number; note: string; actor: string }>,
    seq: 100,
  };
  return {
    db,
    formState: null as ProductImportState | null,
    requireRole: vi.fn(async (_section: string) => ({
      email: "owner@laffogato.net",
      role: "owner",
    })),
    getAdminSession: vi.fn(),
    safeAudit: vi.fn(async (_input: unknown) => true),
    revalidatePath: vi.fn(),
    store: {
      listProductsForImport: vi.fn(async () =>
        db.products.map((p) => structuredClone(p)),
      ),
      listCategories: vi.fn(async () => CATEGORIES_FOR_MOCK),
      getProduct: vi.fn(async (id: string) => {
        const p = db.products.find((x) => x.id === id);
        return p ? { ...structuredClone(p), images: [] } : null;
      }),
      createProduct: vi.fn(async (input: Record<string, unknown>) => {
        db.seq += 1;
        const row = { ...input, id: `prd-0${db.seq}` };
        db.products.push(row);
        return row;
      }),
      patchProductFromImport: vi.fn(
        async (id: string, patch: Record<string, unknown>) => {
          const p = db.products.find((x) => x.id === id);
          if (!p) return null;
          Object.assign(p, patch);
          return { id };
        },
      ),
      adjustStock: vi.fn(
        async (input: { productId: string; delta: number; note: string; actor: string }) => {
          const p = db.products.find((x) => x.id === input.productId);
          if (!p) return { ok: false, error: "Ürün bulunamadı." };
          p.stock = (p.stock as number) + input.delta;
          db.moves.push(input);
          return { ok: true, move: {}, product: p };
        },
      ),
    },
  };
});

const CATEGORIES_FOR_MOCK = vi.hoisted(
  () =>
    [
      { id: "c1", slug: "beans", label: "Kahve çekirdeği", icon: "", sortOrder: 0 },
      { id: "c2", slug: "gear", label: "Ekipman", icon: "", sortOrder: 1 },
      { id: "c3", slug: "gift", label: "İkram", icon: "", sortOrder: 2 },
    ] as const,
);

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // The answer the import form renders, when a test sets one.
    useActionState: ((reducer: unknown, initial: unknown) =>
      h.formState
        ? [h.formState, () => {}, false]
        : actual.useActionState(
            reducer as Parameters<typeof actual.useActionState>[0],
            initial as never,
          )) as typeof actual.useActionState,
  };
});
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: h.requireRole,
  getAdminSession: h.getAdminSession,
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit: h.safeAudit }));
vi.mock("@/lib/backdrop/scene", () => ({
  sceneColumns: vi.fn(async () => ({
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: "tulip",
  })),
}));
vi.mock("@/lib/admin/store", () => ({
  ...h.store,
  NO_BACKDROP: {
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
  },
  slugify: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

const { applyProductImport, IMPORT_OUT_OF_TIME, planProductImport, readImportFile } =
  await import("@/lib/admin/product-import");
const { productImportTemplate } = await import("@/lib/admin/product-import-core");
const actions = await import("@/app/admin/urunler/ice-aktar/actions");
const route = await import("@/app/admin/urunler/ice-aktar/sablon/route");
const { ProductImportForm } = await import(
  "@/components/admin/product-import-form"
);

const CATEGORIES = CATEGORIES_FOR_MOCK as unknown as AdminCategory[];

function product(over: Partial<ProductImportView> = {}): ProductImportView {
  return {
    id: "prd-0001",
    name: "Sirena Espresso",
    slug: "sirena-espresso",
    sku: "SIRE-00001",
    tag: "Çekirdek · 250 g",
    desc: "Espresso harmanı.",
    cat: "beans",
    img: "caramel",
    priceMinor: 32_000,
    compareAtPriceMinor: 0,
    stock: 10,
    taxRatePct: null,
    isActive: true,
    brand: "Sirena",
    weightGrams: 250,
    variants: [],
    ...over,
  };
}

const HEADER =
  "sku;name;category;price;compareAtPrice;stock;taxRatePct;isActive;description;brand;weight";

function csv(...lines: string[]): string {
  return `﻿${[HEADER, ...lines].join("\r\n")}\r\n`;
}

function plan(text: string, products: ProductImportView[] = [product()]) {
  return planProductImport(text, { products, categories: CATEGORIES });
}

function okPlan(text: string, products?: ProductImportView[]) {
  const p = plan(text, products);
  if (!p.ok) throw new Error(p.error);
  return p;
}

function upload(text: string, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("file", new File([text], "urunler.csv", { type: "text/csv" }));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const IDLE = { phase: "idle" as const };

beforeEach(() => {
  h.formState = null;
  h.db.products = [product() as unknown as Record<string, unknown>];
  h.db.moves = [];
  h.db.seq = 100;
  for (const fn of Object.values(h.store)) fn.mockClear();
  h.requireRole.mockReset();
  h.requireRole.mockImplementation(async () => ({
    email: "owner@laffogato.net",
    role: "owner",
  }));
  h.safeAudit.mockClear();
  h.revalidatePath.mockClear();
});

describe("the file as a whole", () => {
  it("needs a sku column, one copy of each column and at least one row", () => {
    expect(plan("name;price\nA;1\n")).toMatchObject({
      ok: false,
      error: expect.stringContaining("sku sütunu yok"),
    });
    expect(plan("sku;price;fiyat\nA;1;2\n")).toMatchObject({
      ok: false,
      error: expect.stringContaining('"price" sütunu iki kez var'),
    });
    expect(plan(`${HEADER}\r\n`)).toMatchObject({
      ok: false,
      error: expect.stringContaining("başka satır yok"),
    });
    expect(plan("")).toMatchObject({ ok: false, error: "Dosya boş." });
  });

  it("refuses more than 500 rows", () => {
    const rows = Array.from({ length: 501 }, (_, i) => `S-${i};;;;;;;;;;`);
    const p = plan(csv(...rows));
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toContain("en fazla 500 satır");
  });

  it("skips a column it does not know, and says so", () => {
    const p = okPlan("sku;renk;price\nSIRE-00001;kırmızı;320\n");
    expect(p.notices).toEqual(["Tanımadığım sütunlar atlandı: renk."]);
    expect(p.rows[0].view.status).toBe("unchanged");
  });

  it("reads Turkish header names too", () => {
    const p = okPlan("SKU;Ürün adı;Fiyat\nSIRE-00001;Sirena Espresso;340\n");
    expect(p.rows[0].view).toMatchObject({
      status: "update",
      messages: ["Fiyat: 320₺ → 340₺"],
    });
  });
});

describe("row checks", () => {
  it("refuses a bad price, a 0 price and an unknown category, with the reason", () => {
    const p = okPlan(
      csv(
        "N-1;Yeni Kup;Kahve çekirdeği;on lira;;5;;evet;Açıklama;;",
        "N-2;Yeni Kup 2;Kahve çekirdeği;0;;5;;evet;Açıklama;;",
        "N-3;Yeni Kup 3;Çaydanlık;120;;5;;evet;Açıklama;;",
      ),
    );
    const [bad, zero, cat] = p.rows.map((r) => r.view);
    expect(bad.status).toBe("error");
    expect(bad.messages[0]).toMatch(/^Fiyat: Tutarı rakamla yaz/);
    expect(zero.messages).toEqual(["Fiyat: Fiyat en az 0,01 TL olmalı."]);
    expect(cat.messages[0]).toContain('Kategori bulunamadı: "Çaydanlık"');
    expect(p.rows.every((r) => r.action === null)).toBe(true);
  });

  it("refuses every row of a SKU the file holds twice", () => {
    const p = okPlan(
      csv(
        "N-9;Bir;Ekipman;100;;1;;evet;A;;",
        "n-9;İki;Ekipman;100;;1;;evet;B;;",
        "N-8;Üç;Ekipman;100;;1;;evet;C;;",
      ),
    );
    const [first, second, third] = p.rows.map((r) => r.view);
    expect(first.status).toBe("error");
    expect(first.messages[0]).toContain("dosyada birden çok satırda var (satır 2, 3)");
    expect(second.status).toBe("error");
    expect(third.status).toBe("create");
  });

  it("refuses a SKU two products share in the panel", () => {
    const p = okPlan(csv("SIRE-00001;;;400;;;;;;;"), [
      product(),
      product({ id: "prd-0009" }),
    ]);
    expect(p.rows[0].view.messages[0]).toContain("prd-0001, prd-0009");
  });

  it("asks a new product for name, category, price and description", () => {
    const p = okPlan(csv("N-1;;;;;;;;;;"));
    expect(p.rows[0].view.messages).toEqual([
      "Yeni ürün için ad, kategori, fiyat, açıklama gerekli.",
    ]);
  });

  it("refuses a stock or weight that is not a whole number, and a bad Aktif", () => {
    const p = okPlan(csv("SIRE-00001;;;;;1,5;;belki;;;2.5"));
    expect(p.rows[0].view.messages).toEqual([
      "Stok: nokta, virgül ya da işaret olmadan tam sayı yaz (ör. 24).",
      "Ağırlık: nokta, virgül ya da işaret olmadan tam sayı yaz (ör. 24).",
      "Aktif: evet ya da hayır yaz.",
    ]);
  });

  it("refuses a too long cell before reading it", () => {
    const p = okPlan(csv(`SIRE-00001;${"x".repeat(201)};;;;;;;;;`));
    expect(p.rows[0].view.messages).toEqual([
      "Ad çok uzun (en fazla 200 karakter).",
    ]);
  });

  it("finds a category by its slug or its name, read the Turkish way", () => {
    const p = okPlan(
      csv(
        "N-1;A ürünü;gear;100;;;;;Açıklama;;",
        "N-2;B ürünü;KAHVE ÇEKİRDEĞİ;100;;;;;Açıklama;;",
        "N-3;C ürünü;ikram;100;;;;;Açıklama;;",
      ),
    );
    const cats = p.rows.map((r) =>
      r.action?.kind === "create" ? r.action.input.cat : null,
    );
    expect(cats).toEqual(["gear", "beans", "gift"]);
  });
});

describe("what a row will do", () => {
  it("reads a decimal comma and a dot the same", () => {
    const comma = okPlan(csv("SIRE-00001;;;129,90;;;;;;;"));
    const dot = okPlan(csv("SIRE-00001;;;129.90;;;;;;;"));
    for (const p of [comma, dot]) {
      const a = p.rows[0].action;
      expect(a?.kind === "update" && a.patch.priceMinor).toBe(12_990);
    }
    expect(comma.hash).toBe(dot.hash);
  });

  it("keeps the main fields when their cell is empty, clears the optional ones", () => {
    const p = okPlan(
      csv("SIRE-00001;;;;;;;;;;"),
      [product({ compareAtPriceMinor: 36_000, taxRatePct: 20 })],
    );
    const a = p.rows[0].action;
    expect(a?.kind).toBe("update");
    if (a?.kind !== "update") return;
    expect(a.patch).toEqual({
      compareAtPriceMinor: 0,
      taxRatePct: null,
      brand: "",
      weightGrams: 0,
    });
    expect(a.stockDelta).toBe(0);
    // Each cleared field says so, and the notice above the table counts them.
    expect(p.rows[0].view.messages).toEqual([
      "Eski fiyat temizlenecek (hücre boş): 360₺ → yok",
      "KDV temizlenecek (hücre boş): %20 → kategorinin oranı",
      "Marka temizlenecek (hücre boş): Sirena → yok",
      "Ağırlık temizlenecek (hücre boş): 250 g → gösterilmiyor",
    ]);
    expect(p.notices).toEqual([
      "Boş hücreler yüzünden temizlenecek: 1 üründe eski fiyat, 1 üründe ürünün kendi KDV oranı, 1 üründe marka, 1 üründe ağırlık. Bunlara dokunmak istemiyorsan o sütunu dosyadan çıkar; olmayan sütun hiçbir şeyi değiştirmez.",
    ]);
  });

  it("counts the clears of a stock-only file built from the template", () => {
    const p = okPlan(
      csv("SIRE-00001;;;;;14;;;;;", "SIRE-00002;;;;;3;;;;;"),
      [
        product({ compareAtPriceMinor: 36_000, taxRatePct: 1 }),
        product({ id: "prd-0002", sku: "SIRE-00002", compareAtPriceMinor: 9_900, brand: "" }),
      ],
    );
    expect(p.notices[0]).toContain(
      "2 üründe eski fiyat, 1 üründe ürünün kendi KDV oranı, 1 üründe marka, 2 üründe ağırlık",
    );
    // A refused row clears nothing, so it is not counted.
    const refused = okPlan(csv("SIRE-00001;;;0;;14;;;;;"), [
      product({ compareAtPriceMinor: 36_000 }),
    ]);
    expect(refused.rows[0].view.status).toBe("error");
    expect(refused.notices).toEqual([]);
  });

  it("does not call an explicit 0 or varsayilan an empty-cell clear", () => {
    const p = okPlan(csv("SIRE-00001;;;;0;;varsayilan;;;Sirena;0"), [
      product({ compareAtPriceMinor: 36_000, taxRatePct: 20 }),
    ]);
    expect(p.rows[0].view.messages).toEqual([
      "Eski fiyat: 360₺ → yok",
      "KDV: %20 → kategorinin oranı",
      "Ağırlık: 250 g → gösterilmiyor",
    ]);
    expect(p.notices).toEqual([]);
  });

  it("takes today's KDV rates, or the rate the product already has", () => {
    const row = (rate: string) => `N-1;Fincan;Ekipman;450;;;${rate};;Porselen fincan.;;`;
    for (const rate of ["0", "1", "10", "20", "%10", ""]) {
      expect(okPlan(csv(row(rate))).rows[0].view.status).toBe("create");
    }
    for (const rate of ["18", "8", "100"]) {
      const r = okPlan(csv(row(rate))).rows[0];
      expect(r.view.status).toBe("error");
      expect(r.view.messages).toEqual([
        "KDV: 0, 1, 10 ya da 20 yaz. Boş hücre kategorinin oranını geçirir.",
      ]);
    }
    // A product that already carries 18 keeps it, but cannot be moved to 8.
    const own = [product({ taxRatePct: 18 })];
    expect(okPlan("sku;taxRatePct\nSIRE-00001;18\n", own).rows[0].view.status).toBe(
      "unchanged",
    );
    expect(okPlan("sku;taxRatePct\nSIRE-00001;8\n", own).rows[0].view.status).toBe("error");
    expect(okPlan("sku;taxRatePct\nSIRE-00001;20\n", own).rows[0].view.messages).toEqual([
      "KDV: %18 → %20",
    ]);
  });

  it("does not touch a field whose column is not in the file", () => {
    const p = okPlan("sku;stock\nSIRE-00001;14\n", [
      product({ compareAtPriceMinor: 36_000, taxRatePct: 20 }),
    ]);
    const a = p.rows[0].action;
    expect(a?.kind === "update" && a.patch).toEqual({});
    expect(a?.kind === "update" && a.stockDelta).toBe(4);
    expect(p.rows[0].view.messages).toEqual([
      "Stok: 10 → 14 (+4, stok hareketi yazılır)",
    ]);
  });

  it("reads a row that stops early as if the missing cells were not there", () => {
    // An editor that drops trailing empty cells: brand and weight stay.
    const p = okPlan(csv("SIRE-00001;;;330"));
    const a = p.rows[0].action;
    expect(a?.kind === "update" && a.patch).toEqual({ priceMinor: 33_000 });
  });

  it("calls a row that matches the product unchanged", () => {
    const p = okPlan(
      csv("SIRE-00001;Sirena Espresso;beans;320,00;;10;;evet;Espresso harmanı.;Sirena;250"),
    );
    expect(p.rows[0]).toEqual({
      view: {
        line: 2,
        sku: "SIRE-00001",
        name: "Sirena Espresso",
        status: "unchanged",
        messages: [],
      },
      action: null,
    });
  });

  it("will not move the stock of a product with variants", () => {
    const withVariants = product({
      variants: [
        { id: "v1", name: "1 kg", priceDeltaMinor: 50_000, stock: 3, sku: "", isActive: true },
      ],
    });
    const p = okPlan("sku;stock\nSIRE-00001;20\n", [withVariants]);
    expect(p.rows[0].view.status).toBe("error");
    expect(p.rows[0].view.messages[0]).toContain("varyantları var");
    // The same stock is fine.
    expect(okPlan("sku;stock\nSIRE-00001;10\n", [withVariants]).rows[0].view.status).toBe(
      "unchanged",
    );
  });

  it("will not price a variant under 1 kuruş", () => {
    const withVariants = product({
      variants: [
        { id: "v1", name: "Mini", priceDeltaMinor: -10_000, stock: 3, sku: "", isActive: true },
      ],
    });
    const p = okPlan("sku;price\nSIRE-00001;100\n", [withVariants]);
    expect(p.rows[0].view.messages).toEqual([
      '"Mini" varyantının fiyatı (satış fiyatı + fark) en az 0,01 TL olmalı.',
    ]);
  });

  it("opens a new product as pasif unless the file says aktif, tag from the category", () => {
    const p = okPlan(
      csv(
        "N-1;Fincan;Ekipman;450;;6;20;;Porselen fincan.;;",
        "N-2;Tabak;Ekipman;300;;;;evet;Porselen tabak.;;",
      ),
    );
    const [a, b] = p.rows.map((r) => r.action);
    expect(a?.kind === "create" && a.input).toMatchObject({
      sku: "N-1",
      isActive: false,
      tag: "Ekipman",
      stock: 6,
      taxRatePct: 20,
      priceMinor: 45_000,
      images: [],
    });
    expect(b?.kind === "create" && b.input).toMatchObject({
      isActive: true,
      stock: 0,
    });
  });
});

describe("the template's example row", () => {
  it("opens passive, and a file that still holds it says so", () => {
    const p = okPlan(productImportTemplate("Kahve çekirdeği"), []);
    const a = p.rows[0].action;
    expect(a?.kind === "create" && a.input.isActive).toBe(false);
    expect(p.notices).toContain(
      "Şablondaki örnek satır (SIRE-00101) dosyada duruyor. O ürünü istemiyorsan satırı sil.",
    );
  });
});

describe("a header that is not a product table", () => {
  it("refuses more than 200 columns before reading them", () => {
    const p = plan(`sku${";".repeat(250)}\nA\n`);
    expect(p.ok).toBe(false);
    expect(!p.ok && p.error).toContain("en fazla 200 sütun");
  });

  it("names at most ten skipped columns", () => {
    const extra = Array.from({ length: 14 }, (_, i) => `x${i}`).join(";");
    const p = okPlan(`sku;stock;${extra}\nSIRE-00001;10\n`);
    expect(p.notices[0]).toBe(
      "Tanımadığım sütunlar atlandı: x0, x1, x2, x3, x4, x5, x6, x7, x8, x9 ve 4 sütun daha.",
    );
  });
});

describe("applyProductImport", () => {
  it("starts no row once the time budget is spent, and says which were not written", async () => {
    const p = okPlan(
      csv(
        "N-1;Fincan;Ekipman;450;;;;;Porselen fincan.;;",
        "N-2;Tabak;Ekipman;300;;;;;Porselen tabak.;;",
        "N-3;Kase;Ekipman;200;;;;;Porselen kase.;;",
      ),
    );
    const clock = [0, 40, 100, 130];
    const out = await applyProductImport(p, {
      actor: "owner@laffogato.net",
      startedAt: 0,
      budgetMs: 100,
      now: () => clock.shift() ?? 999,
    });
    expect(out.createdIds).toHaveLength(2);
    expect(out.notStarted).toBe(1);
    expect(out.rows.map((r) => r.status)).toEqual(["create", "create", "error"]);
    expect(out.rows[2].messages).toEqual([IMPORT_OUT_OF_TIME]);
    expect(h.store.createProduct).toHaveBeenCalledTimes(2);
  });

  it("calls a row whose stock failed after its fields were written an error, and still lists it", async () => {
    h.store.adjustStock.mockResolvedValueOnce({
      ok: false,
      error: "Stok eksiye düşemez (mevcut: 2).",
    });
    const p = okPlan("sku;price;stock\nSIRE-00001;350;0\n");
    const out = await applyProductImport(p, { actor: "owner@laffogato.net" });
    expect(out.updatedIds).toEqual(["prd-0001"]);
    expect(out.stockMoves).toBe(0);
    expect(out.rows[0].status).toBe("error");
    expect(out.rows[0].messages.at(-1)).toBe(
      "Diğer alanlar yazıldı ama stok yazılamadı: Stok eksiye düşemez (mevcut: 2).",
    );
  });
});

describe("readImportFile", () => {
  it("refuses no file, a big file and a file that is not .csv", async () => {
    expect(await readImportFile(null)).toEqual({
      ok: false,
      error: "Bir CSV dosyası seç.",
    });
    const big = new File(["x".repeat(1024 * 1024 + 1)], "a.csv");
    expect((await readImportFile(big)).ok).toBe(false);
    const xlsx = new File(["sku"], "urunler.xlsx");
    const r = await readImportFile(xlsx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("CSV UTF-8");
  });

  it("reads a Windows Turkish file and says so", async () => {
    // "sku;name\nA;Çay Şekeri" in code page 1254.
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("sku;name\nA;"),
      0xc7,
      ...new TextEncoder().encode("ay "),
      0xde,
      ...new TextEncoder().encode("ekeri\n"),
    ]);
    const r = await readImportFile(new File([bytes], "eski.csv"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain("Çay Şekeri");
    expect(r.notices[0]).toContain("UTF-8 değildi");
  });
});

describe("the actions", () => {
  const FILE = csv(
    "SIRE-00001;Sirena Espresso;Kahve çekirdeği;340,00;;14;;evet;Espresso harmanı.;Sirena;250",
    "KUP-01;Yenilebilir Kup;İkram;\"89,90\";;30;1;evet;Çikolatalı kup, 6 adet.;;120",
  );

  it("the dry run writes nothing", async () => {
    const res = await actions.previewProductImportAction(IDLE, upload(FILE));
    expect(res.phase).toBe("preview");
    expect(res.counts).toEqual({ create: 1, update: 1, unchanged: 0, error: 0 });
    expect(res.planHash).toMatch(/^[0-9a-f]{32}$/);
    expect(h.store.createProduct).not.toHaveBeenCalled();
    expect(h.store.patchProductFromImport).not.toHaveBeenCalled();
    expect(h.store.adjustStock).not.toHaveBeenCalled();
    expect(h.safeAudit).not.toHaveBeenCalled();
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the new rows, updates the matched ones and moves stock by a delta", async () => {
    const preview = await actions.previewProductImportAction(IDLE, upload(FILE));
    const res = await actions.applyProductImportAction(
      preview,
      upload(FILE, { planHash: preview.planHash!, intent: "apply" }),
    );
    expect(res.phase).toBe("done");
    expect(res.counts).toEqual({ create: 1, update: 1, unchanged: 0, error: 0 });

    expect(h.store.createProduct).toHaveBeenCalledTimes(1);
    const created = h.db.products.find((p) => p.sku === "KUP-01");
    expect(created).toMatchObject({
      name: "Yenilebilir Kup",
      cat: "gift",
      priceMinor: 8_990,
      stock: 30,
      taxRatePct: 1,
      isActive: true,
      weightGrams: 120,
    });

    // The price is a field patch; the stock never is.
    expect(h.store.patchProductFromImport).toHaveBeenCalledWith("prd-0001", {
      priceMinor: 34_000,
    });
    expect(h.store.adjustStock).toHaveBeenCalledWith({
      productId: "prd-0001",
      delta: 4,
      note: "CSV içe aktarma",
      actor: "owner@laffogato.net",
    });
    expect(h.db.products[0].stock).toBe(14);

    expect(h.safeAudit).toHaveBeenCalledTimes(1);
    expect(h.safeAudit).toHaveBeenCalledWith({
      action: "bulk_update",
      entity: "product",
      payload: {
        op: "csv_import",
        created: 1,
        updated: 1,
        skipped: 0,
        errors: 0,
        stockMoves: 1,
        notStarted: 0,
        createdIds: ["prd-0101"],
        updatedIds: ["prd-0001"],
      },
    });
    const audit = JSON.stringify(h.safeAudit.mock.calls[0][0]);
    expect(audit).not.toContain("Yenilebilir Kup");
    for (const path of ["/", "/admin/urunler", "/admin", "/admin/stok-hareketleri"]) {
      expect(h.revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("the same file twice creates nothing and changes nothing the second time", async () => {
    const first = await actions.previewProductImportAction(IDLE, upload(FILE));
    await actions.applyProductImportAction(
      first,
      upload(FILE, { planHash: first.planHash! }),
    );
    const writes = () =>
      h.store.createProduct.mock.calls.length +
      h.store.patchProductFromImport.mock.calls.length +
      h.store.adjustStock.mock.calls.length;
    const before = writes();
    const audits = h.safeAudit.mock.calls.length;

    const second = await actions.previewProductImportAction(IDLE, upload(FILE));
    expect(second.counts).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
    const again = await actions.applyProductImportAction(
      second,
      upload(FILE, { planHash: second.planHash! }),
    );
    expect(again.phase).toBe("preview");
    expect(again.notices).toContain("Yazılacak satır yok.");
    expect(writes()).toBe(before);
    expect(h.safeAudit.mock.calls.length).toBe(audits);
    expect(h.db.products).toHaveLength(2);
  });

  it("writes nothing when the catalogue changed since the preview", async () => {
    const preview = await actions.previewProductImportAction(IDLE, upload(FILE));
    // An order took one while the operator read the preview.
    h.db.products[0].stock = 9;
    const res = await actions.applyProductImportAction(
      preview,
      upload(FILE, { planHash: preview.planHash! }),
    );
    expect(res.phase).toBe("preview");
    expect(res.notices?.at(-1)).toContain("Önizlemeden bu yana");
    expect(res.planHash).not.toBe(preview.planHash);
    expect(h.store.createProduct).not.toHaveBeenCalled();
    expect(h.store.adjustStock).not.toHaveBeenCalled();
  });

  it("applies only the valid rows and reports the rest", async () => {
    const mixed = csv(
      "SIRE-00001;;;350;;;;;;;",
      "BAD-1;Kırık;Yok böyle;10;;;;;x;;",
    );
    const preview = await actions.previewProductImportAction(IDLE, upload(mixed));
    const res = await actions.applyProductImportAction(
      preview,
      upload(mixed, { planHash: preview.planHash! }),
    );
    expect(res.counts).toEqual({ create: 0, update: 1, unchanged: 0, error: 1 });
    expect(h.store.createProduct).not.toHaveBeenCalled();
    expect(h.safeAudit.mock.calls[0][0]).toMatchObject({
      payload: { updated: 1, errors: 1, created: 0 },
    });
  });

  it("answers a file it cannot read as a whole", async () => {
    const res = await actions.previewProductImportAction(
      IDLE,
      upload("sku;name\nA;\"açık\n"),
    );
    expect(res).toMatchObject({ phase: "idle", error: expect.stringContaining("tırnak") });
    const none = await actions.previewProductImportAction(IDLE, new FormData());
    expect(none).toEqual({ phase: "idle", error: "Bir CSV dosyası seç." });
  });

  it("both actions check the catalogue role before reading anything", async () => {
    await actions.previewProductImportAction(IDLE, upload(FILE));
    await actions.applyProductImportAction(IDLE, upload(FILE));
    expect(h.requireRole.mock.calls.map((c) => c[0])).toEqual([
      "products",
      "products",
    ]);

    h.requireRole.mockClear();
    h.store.listProductsForImport.mockClear();
    h.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      actions.previewProductImportAction(IDLE, upload(FILE)),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      actions.applyProductImportAction(IDLE, upload(FILE, { planHash: "x" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.listProductsForImport).not.toHaveBeenCalled();
    expect(h.store.createProduct).not.toHaveBeenCalled();
  });
});

describe("the template download", () => {
  it("needs a session and the catalogue role", async () => {
    h.getAdminSession.mockResolvedValue(null);
    expect((await route.GET()).status).toBe(401);
    h.getAdminSession.mockResolvedValue({ email: "s@x", role: "staff" });
    expect((await route.GET()).status).toBe(403);
  });

  it("serves the header and an example row with a BOM", async () => {
    h.getAdminSession.mockResolvedValue({ email: "o@x", role: "owner" });
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("urun-sablonu.csv");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("sku;name;category;price");
    expect(text).toContain("Kahve çekirdeği");
  });
});

describe("the import page form", () => {
  const render = () => renderToStaticMarkup(createElement(ProductImportForm));

  it("offers the template, the rules and one file field the actions read", () => {
    const html = render();
    expect(html).toContain('href="/admin/urunler/ice-aktar/sablon"');
    expect(html).toContain("Görseller içe aktarılmaz");
    expect(html).toMatch(/<input[^>]*type="file"[^>]*name="file"/);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(
      buttons.some((b) => b.includes('name="intent"') && b.includes('value="preview"')),
    ).toBe(true);
    // No preview yet: nothing to import.
    expect(html).not.toContain('value="apply"');
    // Posted by hand; the action is React's guard, so an Enter before
    // hydration sends nothing instead of a GET to the page.
    const tags = formOpenTags(html);
    expect(tags).toHaveLength(1);
    expectReactGuard(tags[0]);
    for (const key of ["sku", "compareAtPrice", "taxRatePct", "isActive", "weight"]) {
      expect(html).toContain(`>${key}</td>`);
    }
  });

  it("shows the preview with each row's fate and carries the plan's fingerprint", () => {
    h.formState = {
      phase: "preview",
      fileName: "urunler.csv",
      planHash: "abc123",
      counts: { create: 1, update: 1, unchanged: 0, error: 1 },
      rows: [
        { line: 2, sku: "N-1", name: "Fincan", status: "create", messages: ["Ekipman · 450₺ · stok 6 · pasif"] },
        { line: 3, sku: "SIRE-00001", name: "Sirena", status: "update", messages: ["Fiyat: 320₺ → 340₺"] },
        { line: 4, sku: "X", name: "", status: "error", messages: ["SKU boş."] },
      ],
    };
    const html = render();
    expect(html).toMatch(/<input type="hidden" name="planHash" value="abc123"\/>/);
    expect(html).toMatch(/value="apply"[^>]*>İçe aktar \(2 satır\)<\/button>/);
    for (const label of ["Yeni", "Güncellenecek", "Hata", "Fiyat: 320₺ → 340₺", "SKU boş."]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Yalnız hatalı satırları göster");
  });

  it("names the outcome after the import, with no second import button", () => {
    h.formState = {
      phase: "done",
      counts: { create: 1, update: 0, unchanged: 2, error: 0 },
      rows: [{ line: 2, sku: "N-1", name: "Fincan", status: "create", messages: [] }],
    };
    const html = render();
    expect(html).toContain("Eklendi");
    expect(html).toContain("3. Sonuç");
    expect(html).not.toContain('value="apply"');
    expect(html).toContain('href="/admin/stok-hareketleri"');
  });
});
