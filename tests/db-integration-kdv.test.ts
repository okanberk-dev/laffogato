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
 * range. Skipped without TEST_DATABASE_URL, like the other
 * tests/db-integration*.test.ts.
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
  return { ...real, checkoutConsentVersion: async () => "test" };
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
    `select items, "subtotalMinor", "totalMinor" from public.orders where id = $1`,
    [orderId],
  );
  return rows[0] as {
    items: Array<{ taxRatePct?: number; unitPriceMinor: number; qty: number }>;
    subtotalMinor: number;
    totalMinor: number;
  };
}

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
    await store.updateSettings({
      taxRates: {
        menu: 10,
        karaoke: 20,
        beans: 1,
        pantry: 1,
        gift: 20,
        gear: 20,
        merch: 20,
      },
    });
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
    expect(s.taxRates).toEqual({
      menu: 10,
      karaoke: 20,
      beans: 1,
      pantry: 1,
      gift: 20,
      gear: 20,
      merch: 20,
    });
    // A key the row lacks reads as the legal rate, never undefined.
    await pool!.query(
      `update public.settings set "taxRates" = '{"menu": 8}'::jsonb where id = 'main'`,
    );
    expect((await store.getSettings()).taxRates).toMatchObject({
      menu: 8,
      karaoke: 20,
      beans: 1,
    });
    await store.updateSettings({
      taxRates: {
        menu: 10,
        karaoke: 20,
        beans: 1,
        pantry: 1,
        gift: 20,
        gear: 20,
        merch: 20,
      },
    });
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
    expect(row.items.map((it) => it.taxRatePct)).toEqual([1, 20]);
    expect(row.subtotalMinor).toBe(182000);
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
    await store.updateSettings({ taxRates: { ...s.taxRates, beans: 10 } });
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
      expect(
        (await storedItems(after.order.id)).items.map((i) => i.taxRatePct),
      ).toEqual([10, 0]);
      // The earlier sale still says 1%.
      expect((await storedItems(before.order.id)).items[0].taxRatePct).toBe(1);
      expect((await store.getOrder(before.order.id))!.items[0].taxRatePct).toBe(
        1,
      );
    } finally {
      await store.updateSettings({ taxRates: { ...s.taxRates, beans: 1 } });
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
    const { rows } = await pool!.query(
      `select conname from pg_constraint
        where conname in ('products_tax_rate_pct_check',
                          'menu_items_tax_rate_pct_check',
                          'karaoke_reservations_tax_rate_pct_check')
        order by conname`,
    );
    expect(rows.map((r) => r.conname)).toEqual([
      "karaoke_reservations_tax_rate_pct_check",
      "menu_items_tax_rate_pct_check",
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
});
