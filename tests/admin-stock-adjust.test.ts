import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /admin/stok-hareketleri's manual correction. The field rejected its own
 * example: `pattern="-?\d+"` refused the placeholder's "+12", `parseInt`
 * refused the hint's "−3" (Unicode minus), `inputMode="numeric"` left iOS
 * without a minus key, and "1.5" was cut to 1 without a word.
 */

const h = vi.hoisted(() => ({
  adjustStock: vi.fn(),
  adjustVariantStock: vi.fn(),
  logAudit: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "stok@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/admin/store", () => ({
  adjustStock: h.adjustStock,
  adjustVariantStock: h.adjustVariantStock,
}));

const { parseStockDelta, STOCK_DELTA_MAX } =
  await import("@/lib/admin/stock-delta");
const { adjustStockAction } =
  await import("@/app/admin/stok-hareketleri/actions");
const { StockAdjustForm } =
  await import("@/components/admin/stock-adjust-form");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.adjustStock.mockReset();
  h.adjustStock.mockImplementation(async ({ delta }: { delta: number }) => ({
    ok: true,
    product: { name: "Sirena Espresso", stock: 20 + delta },
  }));
  h.adjustVariantStock.mockReset();
  h.logAudit.mockClear();
});

describe("parseStockDelta", () => {
  it.each([
    ["+12", 12],
    ["12", 12],
    ["-3", -3],
    ["\u22123", -3],
    ["\u2013 3", -3],
    [" + 4 ", 4],
  ])("reads %j as %d", (raw, delta) => {
    expect(parseStockDelta(raw)).toEqual({ ok: true, delta });
  });

  it("refuses a decimal instead of cutting it", () => {
    for (const raw of ["1.5", "1,5", "-2.0", "1.000"]) {
      const r = parseStockDelta(raw);
      expect(r.ok, raw).toBe(false);
      expect(r.ok ? "" : r.error).toMatch(/tam sayı/);
    }
  });

  it("refuses empty, zero, words and a typo-sized number", () => {
    expect(parseStockDelta("").ok).toBe(false);
    expect(parseStockDelta("+").ok).toBe(false);
    expect(parseStockDelta("0").ok).toBe(false);
    expect(parseStockDelta("-0").ok).toBe(false);
    expect(parseStockDelta("on iki").ok).toBe(false);
    expect(parseStockDelta("--3").ok).toBe(false);
    expect(parseStockDelta(String(STOCK_DELTA_MAX)).ok).toBe(true);
    expect(parseStockDelta(String(STOCK_DELTA_MAX + 1)).ok).toBe(false);
  });
});

describe("adjustStockAction", () => {
  it("takes the form's own examples, signed", async () => {
    const plus = await adjustStockAction(
      null,
      form({ productId: "prd-0001", delta: "+12", note: "Sayım fazlası" }),
    );
    expect(h.adjustStock).toHaveBeenLastCalledWith(
      expect.objectContaining({ productId: "prd-0001", delta: 12 }),
    );
    expect(plus).toMatchObject({
      ok: true,
      message: "Sirena Espresso: +12 adet. Yeni stok: 32.",
    });

    const minus = await adjustStockAction(
      null,
      form({ productId: "prd-0001", delta: "\u22123", note: "Hasar" }),
    );
    expect(h.adjustStock).toHaveBeenLastCalledWith(
      expect.objectContaining({ delta: -3 }),
    );
    expect(minus.ok && minus.message).toContain("-3 adet");
  });

  it("answers under each field and writes nothing", async () => {
    const res = await adjustStockAction(
      null,
      form({ productId: "", delta: "1.5", note: "x" }),
    );
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: {
        productId: "Ürün seç.",
        delta: expect.stringMatching(/tam sayı/),
        note: expect.stringMatching(/en az 3/),
      },
    });
    expect(h.adjustStock).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("passes the store's refusal on (no negative stock)", async () => {
    h.adjustStock.mockResolvedValue({
      ok: false,
      error: "Stok eksiye düşemez (mevcut: 2).",
    });
    const res = await adjustStockAction(
      null,
      form({ productId: "prd-0001", delta: "-5", note: "Hasar" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Stok eksiye düşemez (mevcut: 2).",
    });
    expect(h.logAudit).not.toHaveBeenCalled();
  });
});

describe("a variant (admin audit CAT-14)", () => {
  it("moves the variant the select names, and says its new stock", async () => {
    h.adjustVariantStock.mockResolvedValue({
      ok: true,
      label: "Sirena Espresso · 250 g",
      variantStock: 9,
      stock: 15,
    });
    const res = await adjustStockAction(
      null,
      form({ productId: "prd-0001#var-2", delta: "+3", note: "Sayım fazlası" }),
    );
    expect(h.adjustVariantStock).toHaveBeenCalledWith({
      productId: "prd-0001",
      variantId: "var-2",
      delta: 3,
      note: "Sayım fazlası",
      actor: "stok@laffogato.net",
    });
    expect(h.adjustStock).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      ok: true,
      message: "Sirena Espresso · 250 g: +3 adet. Yeni stok: 9.",
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "stock",
        entityId: "prd-0001",
        payload: expect.objectContaining({
          variantId: "var-2",
          delta: 3,
          stockAfter: 9,
          totalAfter: 15,
        }),
      }),
    );
  });

  it("passes the refusal on and audits nothing", async () => {
    h.adjustVariantStock.mockResolvedValue({
      ok: false,
      error: "Stok eksiye düşemez (mevcut: 1).",
    });
    const res = await adjustStockAction(
      null,
      form({ productId: "prd-0001#var-2", delta: "-4", note: "Hasar" }),
    );
    expect(res).toEqual({ ok: false, error: "Stok eksiye düşemez (mevcut: 1)." });
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("lists a product with variants as a group of its variants", () => {
    const html = renderToStaticMarkup(
      createElement(StockAdjustForm, {
        products: [
          {
            id: "prd-0001",
            name: "Sirena",
            stock: 10,
            variants: [
              { id: "var-1", name: "250 g", stock: 6, isActive: true },
              { id: "var-2", name: "1 kg", stock: 4, isActive: false },
            ],
          },
          { id: "prd-0002", name: "Moka", stock: 3, variants: [] },
        ] as never,
      }),
    );
    expect(html).toContain('<optgroup label="Sirena · toplam 10">');
    expect(html).toContain('value="prd-0001#var-1"');
    expect(html).toContain("Sirena · 1 kg · stok 4 · pasif");
    // The product itself is not offered: its total follows the variants.
    expect(html).not.toContain('value="prd-0001"');
    expect(html).toContain('value="prd-0002"');
  });
});

describe("the form", () => {
  it("is a plain text field a phone can type a minus into", () => {
    const html = renderToStaticMarkup(
      createElement(StockAdjustForm, { products: [] }),
    );
    const input = /<input[^>]*name="delta"[^>]*>/.exec(html)?.[0] ?? "";
    expect(input).toContain('type="text"');
    expect(input).not.toContain("inputMode");
    expect(input).not.toContain("inputmode");
    expect(input).not.toContain("pattern");
    expect(input).toContain('placeholder="+12"');
  });
});
