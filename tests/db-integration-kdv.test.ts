import { readFileSync } from "node:fs";

import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PublicCustomer } from "@/lib/customer/store";
import type { Executor } from "@/lib/db/client";
import type { PlaceOrderBody } from "@/lib/mobile/order-schema";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * KDV per item (20261017150000_kdv_rates.sql) against a real Postgres: the
 * migration replays cleanly, the panel's defaults round-trip through the
 * jsonb column, every order path writes the rate each line was sold at into
 * `items` (the card insert, the wallet's `wallet_place_order`, the panel's
 * manual order), a later change in the panel leaves those lines alone, the
 * totals are the same as without rates, and the checks refuse a rate out of
 * range.
 *
 * 18 Eki 2026: every order also carries the shipping or courier fee's own
 * rate (`"shippingTaxRatePct"`, 20261019150100), and
 * 20261019150000_cafe_food_rate_10.sql moves what the code had written at
 * 1% to the köşk's 10% once. Skipped without TEST_DATABASE_URL, like the
 * other tests/db-integration*.test.ts.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;

const holder = vi.hoisted(() => ({ pool: null as pg.Pool | null }));
const execute: Executor = async (q) => {
  if (!holder.pool) throw new Error("pool not ready");
  const r = await holder.pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.9" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/lib/email/send", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/email/send")>();
  return {
    ...real,
    sendOrderPaidEmail: async () => ({ ok: true as const }),
    deliverBatch: async () => ({ ok: true, ids: [] }),
  };
});
vi.mock("@/lib/legal/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/legal/store")>();
  return {
    ...real,
    checkoutConsentVersion: async () => "test",
    checkoutConsentShown: async () => ({ version: "test", textHashes: {} }),
  };
});
vi.mock("@/lib/mobile/venue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/venue")>();
  return {
    ...real,
    getVenueStatus: async () => ({ manualOverride: "open" }),
    isCafeOpenNow: () => true,
  };
});
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    createCheckoutSession: async () => ({
      redirectUrl: "https://pos.example/pay",
      providerRef: `KDV-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    }),
  }),
}));

const RUN = Date.now().toString(36);
const LATTE = `mnu-kdv-latte-${RUN}`;
const SODA = `mnu-kdv-soda-${RUN}`;
const BEANS = `prd-kdv-beans-${RUN}`;
const GRINDER = `prd-kdv-grinder-${RUN}`;
let seq = 0;

function member(): PublicCustomer {
  seq += 1;
  return {
    id: `cus-kdv-${RUN}-${seq}`,
    email: `kdv-${RUN}-${seq}@laffogato.net`,
    name: "Eda Yılmaz",
    phone: "+905321234567",
    birthday: "",
    addresses: [],
    wishlist: [],
    notificationPrefs: {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    },
    emailVerified: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    inviteCode: "",
    usual: null,
  };
}

const PLAIN = {
  milk: "normal",
  roast: "intense",
  sugar: 0,
  syrup: "none",
  extraShot: false,
  note: "",
} as const;

function pickup(over: Partial<PlaceOrderBody> = {}): PlaceOrderBody {
  return {
    kind: "cafe",
    fulfillment: "pickup",
    tableCode: "",
    lines: [
      { menuItemId: LATTE, qty: 2, size: "single", options: { ...PLAIN } },
      { menuItemId: SODA, qty: 1, size: "single", options: { ...PLAIN } },
    ],
    address: null,
    scheduledFor: null,
    promoCode: "",
    note: "",
    clientOrderId: "",
    payWithWallet: false,
    legalConsent: true,
    ...over,
  };
}

async function storedItems(orderId: string) {
  const { rows } = await pool!.query(
    `select items, "subtotalMinor", "totalMinor", "shippingTaxRatePct"
       from public.orders where id = $1`,
    [orderId],
  );
  return rows[0] as {
    items: Array<{ taxRatePct?: number; unitPriceMinor: number; qty: number }>;
    subtotalMinor: number;
    totalMinor: number;
    shippingTaxRatePct: number | null;
  };
}

/** The legal defaults of 18 Eki 2026, as the panel saves them. */
const RATES = {
  menu: 10,
  karaoke: 20,
  beans: 10,
  pantry: 10,
  gift: 20,
  gear: 20,
  merch: 20,
  shipping: 20,
};

maybe("KDV per item in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let orders: typeof import("@/lib/mobile/orders");
  let store: typeof import("@/lib/admin/store");
  let savedRates: unknown = null;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 8 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    // The bundle replays every migration when a deploy adds one: twice must
    // be as good as once.
    await applyBundledSchema(pool);
    await pool.query(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "isActive", "taxRatePct")
       values ($1, 'hot', 'KDV Latte', 19500, true, null),
              ($2, 'cold', 'KDV Soda', 8000, true, 20)
       on conflict (id) do nothing`,
      [LATTE, SODA],
    );
    await pool.query(
      `insert into public.products (id, name, slug, "priceMinor", cat, stock, "isActive", "taxRatePct")
       values ($1, 'KDV Çekirdek', $3, 32000, 'beans', 50, true, null),
              ($2, 'KDV Değirmen', $4, 150000, 'gear', 50, true, null)
       on conflict (id) do nothing`,
      [BEANS, GRINDER, `kdv-cekirdek-${RUN}`, `kdv-degirmen-${RUN}`],
    );
    orders = await import("@/lib/mobile/orders");
    store = await import("@/lib/admin/store");
    const { rows } = await pool.query(
      `select "taxRates" from public.settings where id = 'main'`,
    );
    savedRates = rows[0]?.taxRates ?? {};
    await store.updateSettings({ taxRates: { ...RATES } });
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await pool?.query(
        `update public.settings set "taxRates" = $1::jsonb where id = 'main'`,
        [JSON.stringify(savedRates ?? {})],
      );
      await pool?.query(
        `delete from public.wallet_transactions where "customerEmail" like $1`,
        [`kdv-${RUN}-%`],
      );
      await pool?.query(`delete from public.menu_items where id = any($1)`, [
        [LATTE, SODA],
      ]);
      await pool?.query(
        `update public.products set "isActive" = false where id = any($1)`,
        [[BEANS, GRINDER]],
      );
    } finally {
      await pool?.end();
      pool = null;
      holder.pool = null;
      await release?.();
    }
  });

  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("ADMIN_USERS", "");
  });

  it('the defaults round-trip through settings."taxRates"', async () => {
    const s = await store.getSettings();
    expect(s.taxRates).toEqual(RATES);
    // A key the row lacks reads as the legal rate, never undefined: the
    // live row of 17 Eki 2026 has no `shipping` and needs no write.
    await pool!.query(
      `update public.settings set "taxRates" = '{"menu": 8, "beans": 1}'::jsonb where id = 'main'`,
    );
    expect((await store.getSettings()).taxRates).toEqual({
      ...RATES,
      menu: 8,
      // A value the operator saved stays what they saved.
      beans: 1,
    });
    await store.updateSettings({ taxRates: { ...RATES } });
  });

  it("an app cafe order writes each line's rate and the same total as before", async () => {
    const res = await orders.createAppOrder(member(), pickup());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await storedItems(res.order.id);
    // The latte has no rate of its own (menu default), the soda its own 20.
    expect(row.items.map((it) => it.taxRatePct)).toEqual([10, 20]);
    expect(row.subtotalMinor).toBe(2 * 19500 + 8000);
    expect(row.totalMinor).toBe(2 * 19500 + 8000);
    expect(res.order.items.map((it) => it.taxRatePct)).toEqual([10, 20]);
    expect(res.order.taxBreakdown!.reduce((s, r) => s + r.grossMinor, 0)).toBe(
      res.order.totalMinor,
    );
    // The fee's rate is stamped on the row too, a gel-al order without a
    // fee included: it says what the rate was, not that a fee was charged.
    expect(row.shippingTaxRatePct).toBe(20);
  });

  it("a courier order puts the fee on its own 20% row of the split", async () => {
    // A manual courier order (karar D4): the fee is the settings' courier fee.
    const res = await store.createManualOrder({
      items: [
        { productId: BEANS, qty: 1 },
        { productId: GRINDER, qty: 1 },
      ],
      customerName: "Kasa",
      status: "paid",
      fulfillment: "delivery",
      shippingAddress: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
      actor: "test",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const read = (await store.getOrder(res.order.id))!;
    const fee = read.shippingMinor;
    expect(fee).toBeGreaterThan(0);
    expect(read.shippingTaxRatePct).toBe(20);
    const { orderKdvBreakdown } = await import("@/lib/utils/kdv");
    const split = orderKdvBreakdown(read)!;
    // The grinder (20%) plus the whole fee; the beans keep 10%, no share.
    expect(split.rows.map((r) => [r.ratePct, r.grossMinor])).toEqual([
      [20, 150000 + fee],
      [10, 32000],
    ]);
    expect(split.grossMinor).toBe(read.totalMinor);
  });

  it("the wallet path (wallet_place_order) keeps the rates in items too", async () => {
    vi.stubEnv("WALLET_ENABLED", "true");
    try {
      const who = member();
      await pool!.query(
        `insert into public.wallet_transactions ("customerEmail", kind, "amountMinor", title, "createdAt")
         values ($1, 'topup', 100000, 'test', $2)`,
        [who.email, new Date().toISOString()],
      );
      const res = await orders.createAppOrder(
        who,
        pickup({ payWithWallet: true }),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.order.status).toBe("paid");
      const row = await storedItems(res.order.id);
      expect(row.items.map((it) => it.taxRatePct)).toEqual([10, 20]);
      // wallet_place_order inserts every key of the row it is handed.
      expect(row.shippingTaxRatePct).toBe(20);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("a manual shop order takes each product's category rate", async () => {
    const res = await store.createManualOrder({
      items: [
        { productId: BEANS, qty: 1 },
        { productId: GRINDER, qty: 1 },
      ],
      customerName: "Kasa",
      status: "paid",
      actor: "test",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await storedItems(res.order.id);
    // Coffee beans: the köşk's food is 10% (KDV GUT III/B-2.4.1).
    expect(row.items.map((it) => it.taxRatePct)).toEqual([10, 20]);
    expect(row.subtotalMinor).toBe(182000);
    expect(row.shippingTaxRatePct).toBe(20);
  });

  it("a rate changed in the panel leaves placed orders as they were", async () => {
    const before = await store.createManualOrder({
      items: [{ productId: BEANS, qty: 1 }],
      customerName: "Kasa",
      status: "paid",
      actor: "test",
    });
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const s = await store.getSettings();
    await store.updateSettings({
      taxRates: { ...s.taxRates, beans: 8, shipping: 10 },
    });
    await pool!.query(
      `update public.products set "taxRatePct" = 0 where id = $1`,
      [GRINDER],
    );
    try {
      const after = await store.createManualOrder({
        items: [
          { productId: BEANS, qty: 1 },
          { productId: GRINDER, qty: 1 },
        ],
        customerName: "Kasa",
        status: "paid",
        actor: "test",
      });
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      const later = await storedItems(after.order.id);
      expect(later.items.map((i) => i.taxRatePct)).toEqual([8, 0]);
      expect(later.shippingTaxRatePct).toBe(10);
      // The earlier sale still says 10%, its fee 20%.
      const earlier = await storedItems(before.order.id);
      expect(earlier.items[0].taxRatePct).toBe(10);
      expect(earlier.shippingTaxRatePct).toBe(20);
      const read = (await store.getOrder(before.order.id))!;
      expect(read.items[0].taxRatePct).toBe(10);
      expect(read.shippingTaxRatePct).toBe(20);
    } finally {
      await store.updateSettings({ taxRates: { ...s.taxRates } });
      await pool!.query(
        `update public.products set "taxRatePct" = null where id = $1`,
        [GRINDER],
      );
    }
  });

  it("the checks refuse a rate outside 0-100", async () => {
    for (const [table, id] of [
      ["products", BEANS],
      ["menu_items", LATTE],
    ] as const) {
      await expect(
        pool!.query(
          `update public.${table} set "taxRatePct" = 150 where id = $1`,
          [id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
    const placed = await store.createManualOrder({
      items: [{ productId: GRINDER, qty: 1 }],
      customerName: "Kasa",
      status: "paid",
      actor: "test",
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    await expect(
      pool!.query(
        `update public.orders set "shippingTaxRatePct" = 150 where id = $1`,
        [placed.order.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const { rows } = await pool!.query(
      `select conname from pg_constraint
        where conname in ('products_tax_rate_pct_check',
                          'menu_items_tax_rate_pct_check',
                          'karaoke_reservations_tax_rate_pct_check',
                          'orders_shipping_tax_rate_pct_check')
        order by conname`,
    );
    expect(rows.map((r) => r.conname)).toEqual([
      "karaoke_reservations_tax_rate_pct_check",
      "menu_items_tax_rate_pct_check",
      "orders_shipping_tax_rate_pct_check",
      "products_tax_rate_pct_check",
    ]);
  });

  it("gives the seeded edible cup box its own 1%, once, and never again", async () => {
    // One transaction, rolled back: the shared database keeps its prd-0003.
    const MIGRATION = "20261017150000_kdv_rates.sql";
    const sql = readFileSync(`db/migrations/${MIGRATION}`, "utf8");
    const client = await pool!.connect();
    const rate = async () =>
      (
        await client.query(
          `select "taxRatePct" from public.products where id = 'prd-0003'`,
        )
      ).rows[0]?.taxRatePct;
    try {
      await client.query("begin");
      await client.query(`delete from public.products where id = 'prd-0003'`);
      await client.query(
        `insert into public.products (id, name, slug, tag, "priceMinor", cat, stock, "isActive", "taxRatePct")
         values ('prd-0003', 'Yenilebilir Kup - 6''lı Kutu', $1, 'Waffle kupları', 24000, 'gift', 25, true, null)`,
        [`yenilebilir-kup-${RUN}`],
      );
      // The first run, as db-migrate.mjs does it: the file, then its record.
      await client.query(`delete from public._migrations where name = $1`, [
        MIGRATION,
      ]);
      await client.query(sql);
      expect(await rate()).toBe(1);
      await client.query(`insert into public._migrations (name) values ($1)`, [
        MIGRATION,
      ]);
      // The operator clears it in the panel; a later replay leaves it cleared.
      await client.query(
        `update public.products set "taxRatePct" = null where id = 'prd-0003'`,
      );
      await client.query(sql);
      expect(await rate()).toBeNull();
      // A prd-0003 that is no longer the cup box is never touched.
      await client.query(`delete from public._migrations where name = $1`, [
        MIGRATION,
      ]);
      await client.query(
        `update public.products set name = 'Porselen Kupa', tag = 'Kupa' where id = 'prd-0003'`,
      );
      await client.query(sql);
      expect(await rate()).toBeNull();
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("moves what the code wrote at 1% to the köşk's 10%, once (20261019150000)", async () => {
    // One transaction, rolled back: the shared database keeps its rows.
    const MIGRATION = "20261019150000_cafe_food_rate_10.sql";
    const sql = readFileSync(`db/migrations/${MIGRATION}`, "utf8");
    // A sale the old code stamped at 1%: a panel that still said 1.
    const s = await store.getSettings();
    await store.updateSettings({ taxRates: { ...s.taxRates, beans: 1 } });
    let orderId = "";
    try {
      const sold = await store.createManualOrder({
        items: [
          { productId: BEANS, qty: 2 },
          { productId: GRINDER, qty: 1 },
          { productId: BEANS, qty: 1 },
        ],
        customerName: "Kasa",
        status: "paid",
        actor: "test",
      });
      expect(sold.ok).toBe(true);
      if (!sold.ok) return;
      orderId = sold.order.id;
    } finally {
      await store.updateSettings({ taxRates: { ...s.taxRates } });
    }
    const client = await pool!.connect();
    const product = async (id: string) =>
      (
        await client.query(
          `select "taxRatePct" from public.products where id = $1`,
          [id],
        )
      ).rows[0]?.taxRatePct;
    const savedTaxRates = async () =>
      (
        await client.query(
          `select "taxRates" from public.settings where id = 'main'`,
        )
      ).rows[0]?.taxRates as Record<string, number>;
    const order = async () =>
      (
        await client.query(
          `select items, "subtotalMinor", "totalMinor" from public.orders where id = $1`,
          [orderId],
        )
      ).rows[0] as {
        items: Array<Record<string, unknown>>;
        subtotalMinor: number;
        totalMinor: number;
      };
    try {
      await client.query("begin");
      const before = await order();
      expect(before.items.map((it) => it.taxRatePct)).toEqual([1, 20, 1]);
      await client.query(
        `delete from public.products where id in ('prd-0003', 'prd-0009')`,
      );
      await client.query(
        `insert into public.products (id, name, slug, tag, "priceMinor", cat, stock, "isActive", "taxRatePct")
         values ('prd-0003', 'Yenilebilir Kup - 6''lı Kutu', $1, 'Waffle kupları', 24000, 'gift', 25, true, 1),
                ('prd-0009', 'Pamuk Önlük', $2, 'Önlük', 90000, 'merch', 10, true, null)`,
        [`yenilebilir-kup-${RUN}`, `pamuk-onluk-${RUN}`],
      );
      // The old Vergi tab saved every key from its prefill: beans 1 and
      // pantry 1 sit in the row though the operator only moved the menu.
      await client.query(
        `update public.settings set "taxRates" = $1::jsonb where id = 'main'`,
        [JSON.stringify({ ...RATES, menu: 8, beans: 1, pantry: 1 })],
      );
      // The first run, as db-migrate.mjs does it: the file, then its record.
      await client.query(`delete from public._migrations where name = $1`, [
        MIGRATION,
      ]);
      await client.query(sql);
      expect(await product("prd-0003")).toBe(10);
      expect(await product("prd-0009")).toBe(10);
      expect(await savedTaxRates()).toEqual({
        ...RATES,
        menu: 8,
        beans: 10,
        pantry: 10,
      });
      const after = await order();
      // Every 1 is 10, every other line and key as it was, in its place.
      expect(after.items.map((it) => it.taxRatePct)).toEqual([10, 20, 10]);
      expect(after.items).toEqual(
        before.items.map((it) =>
          it.taxRatePct === 1 ? { ...it, taxRatePct: 10 } : it,
        ),
      );
      expect(after.subtotalMinor).toBe(before.subtotalMinor);
      expect(after.totalMinor).toBe(before.totalMinor);
      // The rate the line was sold at is not lost: one audit row per order
      // keeps which lines were stamped 1, so an invoice already cut at 1%
      // can still be found (Olay kaydı, the order's Zaman çizelgesi).
      const corrections = async () =>
        (
          await client.query(
            `select id, actor, action, payload, "createdAt"
               from public.audit_logs
              where entity = 'order' and "entityId" = $1
                and payload->>'event' = 'kdv_rate_corrected'`,
            [orderId],
          )
        ).rows as Array<{
          id: string;
          actor: string;
          action: string;
          payload: Record<string, unknown>;
          createdAt: string;
        }>;
      const kept = await corrections();
      expect(kept).toHaveLength(1);
      expect(kept[0].id).toMatch(/^aud-\d{7,}$/);
      expect(kept[0].actor).toBe("system");
      expect(kept[0].action).toBe("update");
      expect(kept[0].createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      const soldNo = (
        await client.query(
          `select "orderNo" from public.orders where id = $1`,
          [orderId],
        )
      ).rows[0]?.orderNo;
      expect(kept[0].payload).toEqual({
        event: "kdv_rate_corrected",
        migration: MIGRATION,
        orderNo: soldNo,
        from: 1,
        to: 10,
        count: 2,
        lines: [
          {
            index: 0,
            productName: before.items[0].productName,
            qty: 2,
          },
          {
            index: 2,
            productName: before.items[2].productName,
            qty: 1,
          },
        ],
      });

      // Recorded: a 1 the operator saves later in the panel stays.
      await client.query(`insert into public._migrations (name) values ($1)`, [
        MIGRATION,
      ]);
      await client.query(
        `update public.products set "taxRatePct" = 1 where id = 'prd-0003'`,
      );
      await client.query(
        `update public.settings set "taxRates" = "taxRates" || '{"beans": 1}'::jsonb where id = 'main'`,
      );
      await client.query(sql);
      expect(await product("prd-0003")).toBe(1);
      expect((await savedTaxRates()).beans).toBe(1);
      expect(await corrections()).toHaveLength(1);

      // Unrecorded again: an operator's own rate is never touched.
      await client.query(`delete from public._migrations where name = $1`, [
        MIGRATION,
      ]);
      await client.query(
        `update public.products set "taxRatePct" = 20 where id = 'prd-0003'`,
      );
      // An apron with a rate of its own, or no longer under merch.
      await client.query(
        `update public.products set "taxRatePct" = 20 where id = 'prd-0009'`,
      );
      await client.query(sql);
      expect(await product("prd-0003")).toBe(20);
      expect(await product("prd-0009")).toBe(20);
      await client.query(
        `update public.products set "taxRatePct" = null, cat = 'gift' where id = 'prd-0009'`,
      );
      await client.query(sql);
      expect(await product("prd-0009")).toBeNull();
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("adds the fee's rate column without touching an older order (20261019150100)", async () => {
    const { rows } = await pool!.query(
      `select data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public' and table_name = 'orders'
          and column_name = 'shippingTaxRatePct'`,
    );
    expect(rows).toEqual([
      { data_type: "integer", is_nullable: "YES", column_default: null },
    ]);
    // An order written before the column existed reads as 20% in the split.
    const placed = await store.createManualOrder({
      items: [{ productId: BEANS, qty: 1 }],
      customerName: "Kasa",
      status: "paid",
      actor: "test",
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    await pool!.query(
      `update public.orders set "shippingTaxRatePct" = null where id = $1`,
      [placed.order.id],
    );
    const read = (await store.getOrder(placed.order.id))!;
    expect(read.shippingTaxRatePct ?? null).toBeNull();
    const { orderShippingTaxRate } = await import("@/lib/utils/kdv");
    expect(orderShippingTaxRate(read)).toBe(20);
  });
});
