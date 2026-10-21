import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualOrderActionState } from "@/app/admin/siparisler/actions";
import { createDb, type Executor } from "@/lib/db/client";

/**
 * The panel's manual order (admin audit package 2a, orders-money):
 *
 * - ORD-01: every manual order was a parcel. A counter sale could only be
 *   closed with an invented tracking number, and under the free-shipping
 *   threshold it paid the flat shipping fee (karar D4: Gel-al by default).
 * - ORD-19: a paid start wrote no payment row; cash, the card terminal and
 *   a transfer looked the same (karar D5).
 * - ORD-03 / ORD-M03 / ORD-18 / ORD-05 / ORD-26: the form posted through
 *   `<form action>` (React reset it after a refusal, the status back to
 *   "Ödendi"), showed three of its errors in grey, never showed stock, had
 *   a button inside a link and three identical "Satırı kaldır" buttons.
 *
 * The store runs over the real query builder with a fake executor, so what
 * is asserted is what would be written. No DOM library is installed: the
 * form is read as server markup and its wiring in the source.
 */

// ── The store, over a fake database ────────────────────────────────────

const db = vi.hoisted(() => ({
  products: [] as Record<string, unknown>[],
  settings: {} as Record<string, unknown>,
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  seq: 0,
  failPayments: false,
  /** A concurrent post of the same attempt, committed just before ours. */
  raced: null as Record<string, unknown> | null,
  claims: 0,
}));

const exec: Executor = async ({ text, params }) => {
  if (/^SELECT count\(\*\)/.test(text)) {
    return { rows: [{ count: 1 }], rowCount: 1 };
  }
  if (/FROM "settings"/.test(text)) {
    return { rows: [{ id: "main", ...db.settings }], rowCount: 1 };
  }
  if (/FROM "products"/.test(text)) {
    // resolveOrderLines asks by id and by name; the manual form sends no name.
    const rows = /"name"/.test(text) ? [] : db.products;
    return { rows, rowCount: rows.length };
  }
  if (/^SELECT .* FROM "orders" WHERE "clientOrderId"/.test(text)) {
    const rows = db.inserts
      .filter((i) => i.table === "orders")
      .map((i) => i.row)
      .filter((r) => r.clientOrderId === params[0]);
    return { rows, rowCount: rows.length };
  }
  if (/"claim_order_stock"/.test(text)) {
    db.claims += 1;
    return { rows: [{ result: [10] }], rowCount: 1 };
  }
  if (/"next_seq"/.test(text)) {
    db.seq += 1;
    return { rows: [{ result: 10_000 + db.seq }], rowCount: 1 };
  }
  const insert = /^INSERT INTO "(\w+)" \(([^)]*)\) VALUES/.exec(text);
  if (insert) {
    const columns = insert[2].split(", ").map((c) => c.replace(/"/g, ""));
    const row = Object.fromEntries(columns.map((c, i) => [c, params[i]]));
    if (insert[1] === "orders" && db.raced) {
      // The index (`orders_client_order_id_key`) refuses the second row.
      db.inserts.push({ table: "orders", row: db.raced });
      db.raced = null;
      throw Object.assign(new Error("duplicate key value"), { code: "23505" });
    }
    db.inserts.push({ table: insert[1], row });
    if (db.failPayments && insert[1] === "payment_transactions") {
      throw Object.assign(new Error("payment_transactions is read-only"), {
        code: "25006",
      });
    }
    return { rows: [], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const fake = createDb(exec);
  return { ...real, getDb: () => fake };
});

// ── The form, as server markup ─────────────────────────────────────────

const h = vi.hoisted(() => ({
  state: null as ManualOrderActionState | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: ((reducer: unknown, initial: unknown) =>
      h.state
        ? [h.state, () => {}, false]
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
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const store = await import("@/lib/admin/store");
const { orderActions } = await import("@/lib/admin/order-actions");
const { ManualOrderForm, manualLineVariant, manualProductSellable } =
  await import("@/components/admin/manual-order-form");

function product(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prd-0001",
    name: "Sirena Espresso",
    priceMinor: 32_000,
    stock: 10,
    isActive: true,
    cat: "beans",
    taxRatePct: null,
    variants: [],
    ...over,
  };
}

function insertsInto(table: string): Record<string, unknown>[] {
  return db.inserts.filter((i) => i.table === table).map((i) => i.row);
}

beforeEach(() => {
  db.products = [product()];
  db.settings = {
    courierFeeMinor: 5_500,
    shippingFlatMinor: 4_900,
    shippingFreeThresholdMinor: 50_000,
  };
  db.inserts = [];
  db.seq = 0;
  db.failPayments = false;
  db.raced = null;
  db.claims = 0;
  h.state = null;
});

const BASE = {
  items: [{ productId: "prd-0001", qty: 1 }],
  customerName: "Eda Mancuso",
  actor: "kasa@laffogato.net",
};

describe("ORD-01: Teslimat on a manual order", () => {
  it("a Gel-al order costs no delivery and can be closed without a tracking number", async () => {
    const res = await store.createManualOrder({
      ...BASE,
      status: "preparing",
      fulfillment: "pickup",
      paymentMethod: "nakit",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // ₺320 is under the ₺500 free-shipping threshold: the old order paid ₺49.
    expect(res.order.shippingMinor).toBe(0);
    expect(res.order.totalMinor).toBe(32_000);
    const [row] = insertsInto("orders");
    expect(row.fulfillment).toBe("pickup");
    expect(row.shippingMinor).toBe(0);
    expect(row.source).toBe("manual");
    // Not a parcel: "Hazır" and "Tamamlandı" from Hazırlanıyor, no "Kargoya ver".
    const actions = orderActions(res.order, "staff", true);
    expect(actions.ship).toBeUndefined();
    expect(actions.mark_shipped).toEqual({ enabled: true });
    expect(actions.complete).toEqual({ enabled: true });
  });

  it("is Gel-al when the caller names nothing", async () => {
    const res = await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
    });
    expect(res.ok && res.order.fulfillment).toBe("pickup");
    expect(res.ok && res.order.shippingMinor).toBe(0);
  });

  it("charges the courier fee from the settings for Kurye, whatever the threshold", async () => {
    db.products = [product({ priceMinor: 60_000 })];
    const res = await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      fulfillment: "delivery",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.shippingMinor).toBe(5_500);
    expect(res.order.totalMinor).toBe(65_500);
    expect(insertsInto("orders")[0].fulfillment).toBe("delivery");
  });

  it("keeps the shop's shipping rule for Kargo, and the parcel ships with a number", async () => {
    const res = await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      fulfillment: "shipping",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.shippingMinor).toBe(4_900);
    db.products = [product({ priceMinor: 60_000 })];
    const free = await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      fulfillment: "shipping",
    });
    expect(free.ok && free.order.shippingMinor).toBe(0);
    expect(
      orderActions({ ...res.order, status: "paid" }, "staff", true).ship,
    ).toEqual({ enabled: true });
  });
});

describe("ORD-19: a paid start records how it was paid", () => {
  it("writes the same manual payment row 'Ödendi olarak işaretle' writes", async () => {
    const res = await store.createManualOrder({
      ...BASE,
      status: "paid",
      fulfillment: "pickup",
      paymentMethod: "kart",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payment).toBe("recorded");
    const [payment] = insertsInto("payment_transactions");
    expect(payment).toMatchObject({
      orderId: res.order.id,
      provider: "manual:kart",
      providerRef: `manual-${res.order.id}`,
      status: "succeeded",
      amountMinor: res.order.totalMinor,
    });
    // Written after the order: no payment row for an order that never landed.
    const tables = db.inserts.map((i) => i.table);
    expect(tables.indexOf("orders")).toBeLessThan(
      tables.indexOf("payment_transactions"),
    );
  });

  it("writes none for an unpaid start, even with a method", async () => {
    const res = await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      paymentMethod: "nakit",
    });
    expect(res.ok && res.payment).toBe("none");
    expect(insertsInto("payment_transactions")).toEqual([]);
  });

  it("keeps the order when the payment row cannot be written, and says so", async () => {
    db.failPayments = true;
    const res = await store.createManualOrder({
      ...BASE,
      status: "paid",
      paymentMethod: "nakit",
    });
    expect(res.ok).toBe(true);
    expect(res.ok && res.payment).toBe("failed");
    expect(insertsInto("orders")).toHaveLength(1);
  });
});

// Verifier C3: an answer lost on the way back left the form filled and
// "Siparişi oluştur" enabled, and the second press made a second paid
// order: stock claimed twice, a second payment row, the revenue counted
// twice. The form now sends one attempt id per page load.
describe("C3: the same attempt sent twice is one order", () => {
  it("returns the order the attempt already made, claiming and writing nothing", async () => {
    const attempt = {
      ...BASE,
      status: "paid" as const,
      paymentMethod: "nakit" as const,
      clientOrderId: "8d3c2f4e-0b1a-4c5d-9e6f-7a8b9c0d1e2f",
    };
    const first = await store.createManualOrder(attempt);
    expect(first.ok).toBe(true);
    const again = await store.createManualOrder(attempt);
    expect(again).toMatchObject({ ok: true, replay: true });
    if (!first.ok || !again.ok) return;
    expect(again.order.id).toBe(first.order.id);
    expect(insertsInto("orders")).toHaveLength(1);
    expect(insertsInto("payment_transactions")).toHaveLength(1);
    expect(db.claims).toBe(1);
  });

  it("answers a post racing the first with the first, its stock given back", async () => {
    db.raced = {
      id: "ord-0900",
      orderNo: 10900,
      clientOrderId: "k-raced-0001",
      source: "manual",
      status: "paid",
    };
    const res = await store.createManualOrder({
      ...BASE,
      status: "paid",
      paymentMethod: "nakit",
      clientOrderId: "k-raced-0001",
    });
    expect(res).toMatchObject({
      ok: true,
      replay: true,
      order: { id: "ord-0900" },
    });
    expect(insertsInto("payment_transactions")).toEqual([]);
  });

  it("still makes a new order for a new attempt, and without an id", async () => {
    await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      clientOrderId: "k-a-000001",
    });
    await store.createManualOrder({
      ...BASE,
      status: "pending_payment",
      clientOrderId: "k-b-000002",
    });
    await store.createManualOrder({ ...BASE, status: "pending_payment" });
    expect(insertsInto("orders")).toHaveLength(3);
  });
});

// ── The form ───────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: "prd-1",
    name: "Sirena Espresso",
    priceMinor: 32_000,
    stock: 4,
    variants: [],
  },
  {
    id: "prd-2",
    name: "Moka Pot",
    priceMinor: 120_000,
    stock: 0,
    variants: [],
  },
  {
    id: "prd-3",
    name: "Tişört",
    priceMinor: 45_000,
    stock: 0,
    variants: [
      { id: "var-s", name: "S", priceDeltaMinor: 0, stock: 0 },
      { id: "var-m", name: "M", priceDeltaMinor: 0, stock: 3 },
    ],
  },
];

const SHIPPING = {
  courierFeeMinor: 5_500,
  shippingFlatMinor: 4_900,
  shippingFreeThresholdMinor: 50_000,
};

function markup(): string {
  return renderToStaticMarkup(
    createElement(ManualOrderForm, {
      products: PRODUCTS,
      shipping: SHIPPING,
      action: async () => ({}),
      clientOrderId: "attempt-0001",
    }),
  );
}

const formSource = readFileSync(
  "src/components/admin/manual-order-form.tsx",
  "utf8",
);

describe("ORD-03: a refusal keeps what was typed and says where", () => {
  it("posts by hand, never as a form action (which reset the status to Ödendi)", () => {
    expect(formSource).toContain("useHandPost(formAction, pending)");
    // The dispatcher is the action only as React's guard against the
    // browser's own GET before hydration; onSubmit prevents the post and
    // React skips the action of a prevented submit (no reset).
    expect(formSource).toMatch(
      /<form\s+ref=\{formRef\}\s+action=\{post\.action\}\s+onSubmit=\{post\.onSubmit\}/,
    );
    // A thrown action answers in place instead of the panel's error page.
    expect(formSource).toContain(
      "withPanelCatch<ManualOrderActionState>(action",
    );
    // The two choices that decide money are state, not a select React resets.
    expect(formSource).toContain("value={status}");
    expect(formSource).toContain("value={fulfillment}");
  });

  it("puts every refusal under its own field in danger ink, announced", () => {
    h.state = {
      error: "Formdaki uyarıları gider.",
      fieldErrors: {
        items: "Yetersiz stok: Sirena Espresso (mevcut: 4).",
        customerPhone: "Telefon en fazla 40 karakter olabilir.",
        shippingAddress: "Kargo için teslimat adresini yaz.",
        promoCode: "Promosyon kodu en fazla 40 karakter olabilir.",
        internalNote: "İç not en fazla 2000 karakter olabilir.",
        paymentMethod: "Ödemenin nasıl alındığını seç.",
      },
    };
    const html = markup();
    for (const [key, message] of Object.entries(h.state.fieldErrors!)) {
      expect(html).toMatch(
        new RegExp(
          `<p id="[^"]*-err-${key}" role="alert" tabindex="-1" class="[^"]*admin-danger-ink[^"]*">${message.replace(/[().]/g, "\\$&")}</p>`,
        ),
      );
    }
    expect(html).toMatch(
      /<div role="alert"[^>]*>Formdaki uyarıları gider\.<\/div>/,
    );
    // No grey hint carries an error any more.
    expect(html).not.toContain("text-red-600");
    expect(html).not.toContain("text-neutral-400");
  });

  it("caps every field where the schema does", () => {
    const html = markup();
    const tag = (name: string) =>
      html.match(
        new RegExp(`<(input|textarea)[^>]*\\sname="${name}"[^>]*>`),
      )?.[0] ?? "";
    expect(tag("customerName")).toContain('maxLength="120"');
    expect(tag("customerEmail")).toContain('maxLength="160"');
    expect(tag("customerPhone")).toContain('maxLength="40"');
    expect(tag("shippingAddress")).toContain('maxLength="600"');
    expect(tag("promoCode")).toContain('maxLength="40"');
    expect(tag("internalNote")).toContain('maxLength="2000"');
  });

  it("starts as a paid Gel-al order and asks how it was paid", () => {
    const html = markup();
    expect(html).toMatch(/<select[^>]*name="fulfillment"/);
    expect(html).toMatch(/<option value="pickup" selected="">Gel-al<\/option>/);
    expect(html).toMatch(/<select[^>]*name="paymentMethod"[^>]*required=""/);
    expect(html).toContain("Kasadaki kart cihazı");
    // The address is only needed for a courier or a parcel.
    expect(html).toContain("Teslimat adresi (isteğe bağlı)");
    expect(html).toContain("teslimat ücreti yok");
  });
});

describe("ORD-M03: stock in the options", () => {
  it("shows the stock, and a sold-out product cannot be picked", () => {
    const html = markup();
    expect(html).toMatch(
      /<option value="prd-1">Sirena Espresso · ₺320,00 \(stok: 4\)<\/option>/,
    );
    expect(html).toMatch(
      /<option value="prd-2" disabled="">Moka Pot · ₺1\.200,00 \(tükendi\)<\/option>/,
    );
    // A product whose base is out but a variant is not stays selectable.
    expect(html).toMatch(/<option value="prd-3">Tişört · ₺450,00<\/option>/);
  });

  it("caps the quantity at the stock of the chosen product or variant", () => {
    expect(formSource).toContain("max={cap}");
    expect(formSource).toContain("Math.min(cap, Number(e.target.value) || 1)");
    // UI-16: the options are data for the combobox; an out-of-stock variant
    // is still offered disabled.
    expect(formSource).toContain("disabled: v.stock <= 0");
  });
});

// A product with variants is sold by them: the server refuses its line
// without one (tests/order-variant-lines.test.ts). The form offered a
// "Varsayılan" line that charged the base price and took the unit from the
// product's total alone.
describe("a product with variants is ordered by a variant", () => {
  const sized = {
    id: "prd-4",
    name: "Sirena Espresso",
    priceMinor: 32_000,
    stock: 8,
    variants: [
      { id: "var-250", name: "250 g", priceDeltaMinor: 0, stock: 0 },
      { id: "var-1k", name: "1 kg", priceDeltaMinor: 77_000, stock: 3 },
    ],
  };

  it("a picked product starts on its first variant in stock, never on none", () => {
    expect(manualLineVariant(sized)).toBe("var-1k");
    const soldOut = {
      ...sized,
      variants: sized.variants.map((v) => ({ ...v, stock: 0 })),
    };
    expect(manualLineVariant(soldOut)).toBe("var-250");
    expect(manualLineVariant(PRODUCTS[0])).toBe("");
    expect(manualLineVariant(undefined)).toBe("");
    expect(formSource).toContain(
      "variantId: manualLineVariant(byId.get(productId))",
    );
  });

  it("its own total does not make it sellable, only a variant's stock", () => {
    const soldOut = {
      ...sized,
      variants: sized.variants.map((v) => ({ ...v, stock: 0 })),
    };
    expect(manualProductSellable(sized)).toBe(true);
    expect(manualProductSellable(soldOut)).toBe(false);
    expect(manualProductSellable(PRODUCTS[0])).toBe(true);
    expect(manualProductSellable(PRODUCTS[1])).toBe(false);
    const html = renderToStaticMarkup(
      createElement(ManualOrderForm, {
        products: [soldOut],
        shipping: SHIPPING,
        action: async () => ({}),
        clientOrderId: "attempt-0002",
      }),
    );
    expect(html).toMatch(
      /<option value="prd-4" disabled="">Sirena Espresso · ₺320,00 \(tükendi\)<\/option>/,
    );
  });

  it("offers no base line beside the variants", () => {
    expect(formSource).not.toContain("`Varsayılan");
    expect(markup()).not.toContain("Varsayılan");
    // Before a product is picked the variant select is off, with a dash.
    expect(markup()).toMatch(
      /<select[^>]*disabled=""[^>]*><option value=""(?: selected="")?>-<\/option><\/select>/,
    );
  });
});

describe("ORD-18 / ORD-26: links, names and words", () => {
  it("Vazgeç is one link, not a button inside a link", () => {
    const html = markup();
    expect(html).toMatch(
      /<a href="\/admin\/siparisler" class="[^"]*">Vazgeç<\/a>/,
    );
    expect(html).not.toMatch(/<a[^>]*>\s*<button/);
  });

  it("numbers each remove button and says why the last one is off", () => {
    const html = markup();
    expect(html).toContain('aria-label="1. satırı kaldır"');
    expect(html).not.toContain('aria-label="Satırı kaldır"');
    expect(html).toContain('title="Siparişte en az bir satır kalır."');
  });

  it("says İç not and isteğe bağlı, with a Turkish example code", () => {
    const html = markup();
    expect(html).toContain("İç not (isteğe bağlı)");
    expect(html).not.toContain("İçsel");
    expect(html).not.toContain("opsiyonel");
    expect(html).toContain('placeholder="YAZ25"');
    expect(html).not.toContain("SUMMER25");
  });

  it("adds no long dash", () => {
    expect(formSource).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("C3: one attempt id per page load", () => {
  it("sends the page's attempt id with every post of this form", () => {
    expect(markup()).toMatch(
      /<input type="hidden"[^>]* name="clientOrderId" value="attempt-0001"/,
    );
    // Pinned for the life of the form: a later render cannot swap it.
    expect(formSource).toContain("useState(clientOrderId)");
  });

  it("gets a fresh id from the server for each new form", () => {
    const page = readFileSync("src/app/admin/siparisler/yeni/page.tsx", "utf8");
    expect(page).toContain("clientOrderId={randomUUID()}");
  });
});
