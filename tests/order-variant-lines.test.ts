import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * A product sold by its variants needs a variant on the order line.
 *
 * `resolveOrderLines` accepted a line without a `variantId` for a product
 * with active variants: it charged the base price and took the unit from the
 * product's total alone, which no variant gives back. The shop card's quick
 * add sent exactly such lines, and the panel's manual order offered a
 * "Varsayılan" line for them. The line is refused now, before any stock is
 * claimed, on every path that places an order: the web checkout
 * (`placeOrder`), the panel (`createManualOrder`) and the app
 * (`placeAppOrder`, `previewAppOrderLines`).
 *
 * The refusal stays `not_found` (every caller handles it) and carries
 * `variantRequired`; the app gets the existing 400 `invalid_line`.
 *
 * A product whose variants are all inactive is sold like one without
 * variants: nothing offers an inactive variant (the web, `/shop` and the
 * panel list the active ones), so the app and the web send no variant for it.
 *
 * The store runs over the real query builder with a fake executor, so what
 * is asserted is what would be written.
 */

const db = vi.hoisted(() => ({
  products: [] as Record<string, unknown>[],
  statements: [] as { text: string; params: readonly unknown[] }[],
  claims: [] as unknown[],
  seq: 0,
}));

function flat(params: readonly unknown[]): unknown[] {
  return params.flatMap((p) => (Array.isArray(p) ? p : [p]));
}

const exec: Executor = async ({ text, params }) => {
  db.statements.push({ text, params });
  if (/^SELECT count\(\*\)/.test(text)) {
    return { rows: [{ count: 1 }], rowCount: 1 };
  }
  if (/FROM "settings"/.test(text)) {
    return { rows: [{ id: "main", isShopOpen: true }], rowCount: 1 };
  }
  if (/^SELECT .* FROM "products"/.test(text)) {
    const wanted = flat(params);
    const key = /"name"/.test(text) ? "name" : "id";
    const rows = db.products.filter((p) => wanted.includes(p[key]));
    return { rows, rowCount: rows.length };
  }
  if (/"claim_order_stock"/.test(text)) {
    const raw = params.find(
      (p) => typeof p === "string" && p.startsWith("["),
    ) as string;
    const lines = JSON.parse(raw) as unknown[];
    db.claims.push(lines);
    return { rows: [{ result: lines.map(() => 3) }], rowCount: 1 };
  }
  if (/"next_seq"/.test(text)) {
    db.seq += 1;
    return { rows: [{ result: 10_000 + db.seq }], rowCount: 1 };
  }
  if (/^INSERT/.test(text)) return { rows: [], rowCount: 1 };
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const fake = createDb(exec);
  return { ...real, getDb: () => fake };
});

const store = await import("@/lib/admin/store");
const { failureFromResult } = await import("@/lib/mobile/orders");
const { apiError } = await import("@/lib/mobile/respond");

function variant(
  id: string,
  name: string,
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    name,
    priceDeltaMinor: 0,
    stock: 5,
    sku: "",
    isActive: true,
    ...over,
  };
}

function product(over: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "Ürün",
    priceMinor: 10_000,
    stock: 10,
    isActive: true,
    cat: "beans",
    taxRatePct: null,
    variants: [],
    ...over,
  };
}

/** No variants: sold from its own stock at its own price. */
const PLAIN = product({
  id: "prd-0001",
  name: "Moka Pot",
  cat: "gear",
  priceMinor: 120_000,
  stock: 5,
});
/** Sold by its variants: 250 g at the base price, 1 kg at +770 TL. */
const SIZED = product({
  id: "prd-0002",
  name: "Sirena Espresso",
  priceMinor: 32_000,
  stock: 8,
  variants: [
    variant("var-250", "250 g"),
    variant("var-1k", "1 kg", { priceDeltaMinor: 77_000, stock: 3 }),
  ],
});
/** Every variant switched off in the panel. */
const DORMANT = product({
  id: "prd-0003",
  name: "Tişört",
  cat: "merch",
  priceMinor: 45_000,
  stock: 4,
  variants: [
    variant("var-s", "S", { isActive: false, stock: 2 }),
    variant("var-m", "M", { isActive: false, stock: 2 }),
  ],
});
/** One variant on sale, one off. */
const MIXED = product({
  id: "prd-0004",
  name: "Kupa",
  cat: "merch",
  priceMinor: 30_000,
  stock: 3,
  variants: [
    variant("var-old", "Eski", { isActive: false, stock: 0 }),
    variant("var-new", "Yeni", { stock: 3 }),
  ],
});

const CONSENT = {
  acceptedAt: "2026-10-18T09:00:00.000Z",
  documents: [],
  version: "v1",
  ip: "85.105.1.1",
  userAgent: "vitest",
};

/** Every write the store would have made: rows, stock, counters. */
function writes(): string[] {
  return db.statements
    .map((s) => s.text)
    .filter((t) => /^(INSERT|UPDATE|DELETE)/.test(t));
}

const REFUSED = {
  ok: false,
  reason: "not_found",
  productName: "Sirena Espresso",
  variantRequired: true,
};

function webOrder(items: Parameters<typeof store.placeOrder>[0]["items"]) {
  return store.placeOrder({
    items,
    customerName: "Eda Mancuso",
    shippingAddress: "Postane Mah. 28, Tuzla, İstanbul",
    legalConsent: CONSENT,
  });
}

function appOrder(lines: Parameters<typeof store.placeAppOrder>[0]["lines"]) {
  return store.placeAppOrder({
    lines,
    fulfillment: "shipping",
    customerName: "Eda Mancuso",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "Postane Mah. 28, Tuzla, İstanbul",
    deliveryNote: "",
    scheduledFor: null,
    promoCode: "",
    legalConsent: CONSENT,
  });
}

const RATES = {
  menu: 10,
  karaoke: 20,
  beans: 1,
  pantry: 1,
  gift: 20,
  gear: 20,
  merch: 20,
};

beforeEach(() => {
  db.products = [PLAIN, SIZED, DORMANT, MIXED].map((p) => ({ ...p }));
  db.statements = [];
  db.claims = [];
  db.seq = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a product with active variants refuses a line without one", () => {
  it("on the web checkout, before any stock is claimed or a row written", async () => {
    const res = await webOrder([
      {
        productId: "prd-0002",
        name: "Sirena Espresso",
        qty: 1,
        priceMinor: 32_000,
      },
    ]);
    expect(res).toEqual(REFUSED);
    expect(db.claims).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("with an empty variant id, and for a legacy cart line matched by name", async () => {
    expect(
      await webOrder([
        {
          productId: "prd-0002",
          variantId: "",
          name: "Sirena Espresso",
          qty: 1,
        },
      ]),
    ).toEqual(REFUSED);
    expect(await webOrder([{ name: "Sirena Espresso", qty: 1 }])).toEqual(
      REFUSED,
    );
    expect(db.claims).toEqual([]);
  });

  it("when one variant is on sale and another is off", async () => {
    const res = await webOrder([
      { productId: "prd-0004", name: "Kupa", qty: 1 },
    ]);
    expect(res).toEqual({ ...REFUSED, productName: "Kupa" });
    expect(db.claims).toEqual([]);
  });

  it("takes nothing for the good lines of the same basket", async () => {
    const res = await webOrder([
      { productId: "prd-0001", name: "Moka Pot", qty: 1 },
      { productId: "prd-0002", name: "Sirena Espresso", qty: 2 },
    ]);
    expect(res).toEqual(REFUSED);
    expect(db.claims).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("on a manual order from the panel", async () => {
    const res = await store.createManualOrder({
      items: [{ productId: "prd-0002", qty: 1 }],
      customerName: "Eda Mancuso",
      status: "paid",
      fulfillment: "pickup",
      paymentMethod: "nakit",
      actor: "kasa@laffogato.net",
    });
    expect(res).toEqual(REFUSED);
    expect(db.claims).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("on an app order and on the app's basket preview", async () => {
    const res = await appOrder([{ productId: "prd-0002", qty: 1 }]);
    expect(res).toEqual(REFUSED);
    expect(db.claims).toEqual([]);
    expect(writes()).toEqual([]);

    const preview = await store.previewAppOrderLines(
      [{ productId: "prd-0002", qty: 1 }],
      RATES,
    );
    expect(preview).toEqual({ ok: false, result: REFUSED });
  });
});

describe("what still sells as before", () => {
  it("a product without variants: its price, its own stock", async () => {
    const res = await webOrder([
      { productId: "prd-0001", name: "Moka Pot", qty: 2 },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.items).toMatchObject([
      { productId: "prd-0001", qty: 2, unitPriceMinor: 120_000 },
    ]);
    expect(db.claims).toEqual([
      [{ productId: "prd-0001", variantId: null, qty: 2 }],
    ]);
  });

  it("a product with a variant chosen: base plus the variant's delta, from the variant", async () => {
    const res = await webOrder([
      {
        productId: "prd-0002",
        variantId: "var-1k",
        name: "Sirena Espresso",
        qty: 1,
      },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.items).toMatchObject([
      { productId: "prd-0002", variantId: "var-1k", unitPriceMinor: 109_000 },
    ]);
    expect(db.claims).toEqual([
      [{ productId: "prd-0002", variantId: "var-1k", qty: 1 }],
    ]);
  });

  it("a product whose variants are all inactive sells like one without variants", async () => {
    const res = await webOrder([
      { productId: "prd-0003", name: "Tişört", qty: 1 },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.items).toMatchObject([
      { productId: "prd-0003", unitPriceMinor: 45_000 },
    ]);
    expect(db.claims).toEqual([
      [{ productId: "prd-0003", variantId: null, qty: 1 }],
    ]);

    const manual = await store.createManualOrder({
      items: [{ productId: "prd-0003", qty: 1 }],
      customerName: "Eda Mancuso",
      status: "pending_payment",
      actor: "kasa@laffogato.net",
    });
    expect(manual.ok).toBe(true);
    const app = await store.previewAppOrderLines(
      [{ productId: "prd-0003", qty: 1 }],
      RATES,
    );
    expect(app).toMatchObject({
      ok: true,
      items: [{ productId: "prd-0003", unitPriceMinor: 45_000 }],
    });
  });

  it("a variant that is no longer on sale is refused as it was, without the flag", async () => {
    const res = await webOrder([
      { productId: "prd-0004", variantId: "var-old", name: "Kupa", qty: 1 },
    ]);
    expect(res).toEqual({
      ok: false,
      reason: "not_found",
      productName: "Kupa",
    });
  });
});

describe("the app's answer", () => {
  it("is the existing 400 invalid_line, in words that say what to do", async () => {
    const res = await appOrder([{ productId: "prd-0002", qty: 1 }]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(failureFromResult(res)).toEqual({
      status: 400,
      code: "invalid_line",
      message: "Sirena Espresso için bir seçenek seç. Sepeti güncelle.",
    });
  });

  it("is byte for byte the shape of the 400 invalid_line the app already handles", async () => {
    const res = await appOrder([{ productId: "prd-0002", qty: 1 }]);
    if (res.ok) throw new Error("expected a refusal");
    const send = (f: ReturnType<typeof failureFromResult>) =>
      apiError(f.status, f.code, f.message, f.headers, f.extra);
    const ours = send(failureFromResult(res));
    // An L size on a drink that has none: the invalid_line of v1.
    const known = send(
      failureFromResult({
        ok: false,
        reason: "bad_line",
        productName: "Espresso",
        message: "Espresso için L boyu yok.",
      }),
    );
    expect(ours.status).toBe(known.status);
    expect([...ours.headers.entries()]).toEqual([...known.headers.entries()]);
    const body = await ours.json();
    const knownBody = await known.json();
    expect(Object.keys(body)).toEqual(Object.keys(knownBody));
    expect(body.error).toBe(knownBody.error);
    expect(body).toEqual({
      error: "invalid_line",
      message: "Sirena Espresso için bir seçenek seç. Sepeti güncelle.",
    });
  });

  it("leaves a product gone from the shop on line_not_found", () => {
    expect(
      failureFromResult({
        ok: false,
        reason: "not_found",
        productName: "Kupa",
      }),
    ).toEqual({
      status: 400,
      code: "line_not_found",
      message: "Kupa artık satışta değil. Sepeti güncelle.",
    });
  });
});
