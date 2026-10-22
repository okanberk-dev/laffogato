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
 * Table orders (docs/API-MOBILE.md §3, §22) against a real Postgres: what
 * the unit tests mock away. The order row's `tableCode`/`tableName` snapshot
 * through the card path (`insertOrderRow`) and the wallet path
 * (`wallet_place_order`'s `jsonb_populate_record`), no address and no
 * delivery fee on either, the store's own refusals (a table order without a
 * code, a scheduled one), a rotated and an inactive table refused before
 * anything is written, and the staff "yeni sipariş" mail claimed exactly once
 * under concurrent confirmations. Skipped without TEST_DATABASE_URL, like the
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

const hooks = vi.hoisted(() => ({
  afters: [] as Array<() => unknown>,
  batches: [] as Array<{ key: string; to: string[] }>,
  sessions: 0,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    hooks.afters.push(cb);
  },
}));
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.6" }),
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
    deliverBatch: async (messages: Array<{ to: string }>, key: string) => {
      // A provider round trip, so concurrent claims really overlap.
      await new Promise((r) => setTimeout(r, 20));
      hooks.batches.push({ key, to: messages.map((m) => m.to) });
      return { ok: true, ids: [] };
    },
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
// The köşk's posted hours are not what these tests are about.
vi.mock("@/lib/mobile/venue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/mobile/venue")>();
  return {
    ...real,
    getVenueStatus: async () => ({ manualOverride: "open" }),
    isCafeOpenNow: () => true,
    isCafeOpenForOrder: () => true,
  };
});
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    createCheckoutSession: async () => {
      hooks.sessions += 1;
      return {
        redirectUrl: "https://pos.example/pay",
        providerRef: `TREF-${hooks.sessions}`,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    },
  }),
}));

const ITEM = "mnu-table-it";
const PRICE = 20_000;
const RUN = Date.now().toString(36);
let seq = 0;

function member(): PublicCustomer {
  seq += 1;
  return {
    id: `cus-table-${RUN}-${seq}`,
    email: `table-${RUN}-${seq}@laffogato.net`,
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

function body(over: Partial<PlaceOrderBody> = {}): PlaceOrderBody {
  return {
    kind: "cafe",
    fulfillment: "table",
    tableCode: "",
    lines: [
      {
        menuItemId: ITEM,
        qty: 1,
        size: "single",
        options: {
          milk: "normal",
          roast: "intense",
          sugar: 0,
          syrup: "none",
          extraShot: false,
          note: "",
        },
      },
    ],
    address: null,
    scheduledFor: null,
    promoCode: "",
    note: "pencere yanı",
    clientOrderId: "",
    payWithWallet: false,
    legalConsent: true,
    ...over,
  };
}

async function row(orderId: string) {
  const { rows } = await pool!.query(
    `select "tableCode", "tableName", "shippingAddress", "shippingMinor",
            fulfillment, status, "scheduledFor"
       from public.orders where id = $1`,
    [orderId],
  );
  return rows[0] as Record<string, unknown>;
}

async function orderCount(email: string): Promise<number> {
  const { rows } = await pool!.query(
    `select count(*)::int as n from public.orders where "customerEmail" = $1`,
    [email],
  );
  return rows[0].n as number;
}

maybe("table orders in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let orders: typeof import("@/lib/mobile/orders");
  let tables: typeof import("@/lib/admin/cafe-tables");
  let store: typeof import("@/lib/admin/store");
  let savedNotify: Record<string, unknown> = {};
  const tableIds: string[] = [];

  async function newTable(name: string) {
    const t = await tables.createCafeTable(name);
    if (!t.ok) throw new Error(`createCafeTable: ${t.error}`);
    tableIds.push(t.value.id);
    return t.value;
  }

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 12 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    await pool.query(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "isActive")
       values ($1, 'hot', 'Masa Latte', $2, true)
       on conflict (id) do update set "priceMinor" = excluded."priceMinor",
         "isActive" = true, "categoryKey" = 'hot'`,
      [ITEM, PRICE],
    );
    orders = await import("@/lib/mobile/orders");
    tables = await import("@/lib/admin/cafe-tables");
    store = await import("@/lib/admin/store");
    const s = await store.getSettings();
    savedNotify = {
      notificationEmail: s.notificationEmail,
      orderNotifyEnabled: s.orderNotifyEnabled,
      orderNotifyRoles: s.orderNotifyRoles,
      orderNotifyEmails: s.orderNotifyEmails,
    };
    await store.updateSettings({
      notificationEmail: "ops@laffogato.net",
      orderNotifyEnabled: true,
      orderNotifyRoles: ["owner"],
      orderNotifyEmails: "mutfak@laffogato.net\nbar@laffogato.net",
    });
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      if (store) await store.updateSettings(savedNotify as never);
      await pool?.query(
        `delete from public.wallet_transactions where "customerEmail" like $1`,
        [`table-${RUN}-%`],
      );
      await pool?.query(
        `delete from public.order_notice_emails where "orderId" in
           (select id from public.orders where "customerEmail" like $1)`,
        [`table-${RUN}-%`],
      );
      if (tableIds.length > 0) {
        await pool?.query(`delete from public.cafe_tables where id = any($1)`, [
          tableIds,
        ]);
      }
    } finally {
      await pool?.end();
      pool = null;
      holder.pool = null;
      await release?.();
    }
  });

  beforeEach(() => {
    // CI sets a break-glass admin (ADMIN_EMAIL); it is a valid recipient
    // in production but not part of this test's team.
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("ADMIN_USERS", "");
    hooks.afters.length = 0;
    hooks.batches.length = 0;
    hooks.sessions = 0;
  });

  it("snapshots the table on a card order, with no address and no delivery fee", async () => {
    const t = await newTable("Bahçe 3");
    const who = member();
    // The member's lenient spelling: lower case, a hyphen.
    const lenient = `${t.code.slice(0, 5)}-${t.code.slice(5)}`.toLowerCase();
    const res = await orders.createAppOrder(who, body({ tableCode: lenient }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.table).toEqual({ code: t.code, name: "Bahçe 3" });
    expect(res.payment?.redirectUrl).toBe("https://pos.example/pay");
    expect(await row(res.order.id)).toMatchObject({
      tableCode: t.code,
      tableName: "Bahçe 3",
      shippingAddress: "",
      shippingMinor: 0,
      fulfillment: "table",
      status: "pending_payment",
    });
  });

  it("snapshots the table on a wallet order too (wallet_place_order)", async () => {
    vi.stubEnv("WALLET_ENABLED", "true");
    try {
      const t = await newTable("Pencere");
      const who = member();
      await pool!.query(
        `insert into public.wallet_transactions ("customerEmail", kind, "amountMinor", title, "createdAt")
         values ($1, 'topup', 50000, 'test', $2)`,
        [who.email, new Date().toISOString()],
      );
      const res = await orders.createAppOrder(
        who,
        body({ tableCode: t.code, payWithWallet: true }),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.payment).toBeNull();
      expect(await row(res.order.id)).toMatchObject({
        tableCode: t.code,
        tableName: "Pencere",
        shippingAddress: "",
        shippingMinor: 0,
        status: "paid",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses a rotated code and an inactive table before writing anything", async () => {
    const t = await newTable("Bahçe 9");
    const who = member();
    const rotated = await tables.rotateCafeTableCode(t.id);
    expect(rotated.ok).toBe(true);
    const stale = await orders.createAppOrder(who, body({ tableCode: t.code }));
    expect(stale).toMatchObject({
      ok: false,
      failure: { status: 400, code: "invalid_table" },
    });
    await tables.setCafeTableActive(t.id, false);
    const fresh = await tables.getCafeTable(t.id);
    const closed = await orders.createAppOrder(
      who,
      body({ tableCode: fresh!.code }),
    );
    expect(closed).toMatchObject({
      ok: false,
      failure: { status: 409, code: "table_inactive" },
    });
    expect(await orderCount(who.email)).toBe(0);
    expect(hooks.sessions).toBe(0);
  });

  it("holds the store's own line: no code, no schedule, never an address", async () => {
    const who = member();
    const base = {
      lines: body().lines,
      fulfillment: "table" as const,
      customerName: "Eda",
      customerEmail: who.email,
      customerPhone: "",
      shippingAddress: "Kapı kodu 1234",
      deliveryNote: "",
      scheduledFor: null,
      promoCode: "",
      legalConsent: {
        termsVersion: "test",
        acceptedAt: new Date().toISOString(),
        ip: "",
      },
      clientOrderId: "",
    } as unknown as Parameters<typeof store.placeAppOrder>[0];

    expect(await store.placeAppOrder({ ...base, tableCode: "" })).toEqual({
      ok: false,
      reason: "bad_request",
      message: "Masa kodu gerekli.",
    });
    expect(
      await store.placeAppOrder({
        ...base,
        tableCode: "ABCDEFGHJK",
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ).toEqual({
      ok: false,
      reason: "bad_request",
      message: "Masaya sipariş planlanamaz; hemen hazırlanır.",
    });
    const placed = await store.placeAppOrder({
      ...base,
      tableCode: "ABCDEFGHJK",
      tableName: "Çok uzun bir masa adı ".repeat(4),
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const stored = await row(placed.order.id);
    expect(stored.shippingAddress).toBe("");
    expect(stored.shippingMinor).toBe(0);
    expect(String(stored.tableName).length).toBeLessThanOrEqual(40);
  });

  it("mails the team exactly once however many confirmations arrive at once", async () => {
    const t = await newTable("Bahçe 5");
    const res = await orders.createAppOrder(
      member(),
      body({ tableCode: t.code }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const confirm = () =>
      store.applyPaymentSucceeded({
        orderId: res.order.id,
        provider: "paynkolay",
        providerRef: `TCONF-${RUN}`,
        amountMinor: res.order.totalMinor,
        currency: "TRY",
      });
    const results = await Promise.all([confirm(), confirm(), confirm()]);
    for (const r of results) expect(r.ok).toBe(true);
    expect((await row(res.order.id)).status).toBe("paid");
    // The confirmation that paid it, plus the repeats that re-offer it.
    expect(hooks.afters.length).toBeGreaterThanOrEqual(1);
    await Promise.all(hooks.afters.splice(0).map((cb) => cb()));
    expect(hooks.batches).toHaveLength(1);
    expect(hooks.batches[0].to.sort()).toEqual([
      "bar@laffogato.net",
      "mutfak@laffogato.net",
      "ops@laffogato.net",
    ]);
    const { rows } = await pool!.query(
      `select status from public.order_notice_emails
        where "orderId" = $1 and kind = 'staff-new'`,
      [res.order.id],
    );
    expect(rows).toEqual([{ status: "sent" }]);

    // A later repeat finds the claim taken.
    await confirm();
    await Promise.all(hooks.afters.splice(0).map((cb) => cb()));
    expect(hooks.batches).toHaveLength(1);
  });
});
