import { describe, it, expect } from "vitest";

import { productFormSchema } from "@/lib/admin/product-schema";

function form(overrides: Record<string, string> = {}) {
  return {
    name: "Test Ürün",
    tag: "Whole Bean · 250g",
    desc: "Açıklama metni.",
    cat: "beans",
    price: "320",
    ...overrides,
  };
}

describe("productFormSchema", () => {
  it("parses a valid product and converts price to minor units", () => {
    const r = productFormSchema.safeParse(form());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.priceMinor).toBe(32000);
      expect(r.data.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("supports comma decimals in prices", () => {
    const r = productFormSchema.safeParse(form({ price: "12,50" }));
    expect(r.success && r.data.priceMinor).toBe(1250);
  });

  it("rejects a too-short product name", () => {
    expect(productFormSchema.safeParse(form({ name: "A" })).success).toBe(false);
  });

  it("keeps a small data-url image and drops an oversized one (2MB cap)", () => {
    const small = "data:image/png;base64,AAAABBBBCCCC";
    const big = "data:image/png;base64," + "A".repeat(3 * 1024 * 1024);
    const r = productFormSchema.safeParse(
      form({ images: JSON.stringify([small, big]) }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.images).toContain(small);
      expect(r.data.images).not.toContain(big);
    }
  });

  it("accepts http(s) image urls and drops junk", () => {
    const r = productFormSchema.safeParse(
      form({ images: JSON.stringify(["https://cdn.x.com/a.jpg", "notaurl"]) }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.images).toEqual(["https://cdn.x.com/a.jpg"]);
    }
  });
});
