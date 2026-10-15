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
 * Paying an app order from the wallet (docs/API-MOBILE.md §18), against a
 * real Postgres: `wallet_place_order`
 * (db/migrations/20261014224120_wallet_ledger.sql) writes the order and its
 * spend in one transaction, under a per-member lock, or writes neither.
 * The race test is the one a fake database cannot show: two checkouts that
 * each fit the balance but not together must not both be paid. Skipped
 * without TEST_DATABASE_URL, like the other tests/db-integration*.test.ts.
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

const pos = vi.hoisted(() => ({ sessions: 0 }));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.7" }),
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
    sendOrderPlacedEmail: async () => {},
    sendOrderPaidEmail: async () => {},
  };
});
vi.mock("@/lib/legal/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/legal/store")>();
  return { ...real, checkoutConsentVersion: async () => "test" };
});
// The köşk's posted hours are not what these tests are about.
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
    createCheckoutSession: async () => {
      pos.sessions += 1;
      return {
        redirectUrl: "https://pos.example/pay",
        providerRef: `REF-${pos.sessions}`,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    },
  }),
}));

const ITEM = "mnu-wallet-it";
const PRICE = 10_000;
const RUN = Date.now().toString(36);
let seq = 0;

function member(): PublicCustomer {
  seq += 1;
  return {
    id: `cus-wallet-${RUN}-${seq}`,
    email: `wallet-${RUN}-${seq}@laffogato.net`,
    name: "Cüzdan Üye",
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
    fulfillment: "pickup",
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
    note: "",
    clientOrderId: "",
    payWithWallet: true,
    legalConsent: true,
    ...over,
  };
}

async function topUp(email: string, amountMinor: number): Promise<void> {
  await pool!.query(
    `insert into public.wallet_transactions ("customerEmail", kind, "amountMinor", title, "createdAt")
     values ($1, 'topup', $2, 'test', $3)`,
    [email, amountMinor, new Date().toISOString()],
  );
}

async function balance(email: string): Promise<number> {
  const { rows } = await pool!.query(
    `select coalesce(sum("amountMinor"), 0)::int as b
       from public.wallet_transactions where "customerEmail" = $1`,
    [email],
  );
  return rows[0].b as number;
}

async function ordersOf(email: string) {
  const { rows } = await pool!.query(
    `select id, status, "totalMinor" from public.orders
      where "customerEmail" = $1 order by id`,
    [email],
  );
  return rows as { id: string; status: string; totalMinor: number }[];
}

maybe("paying an app order from the wallet in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let createAppOrder: typeof import("@/lib/mobile/orders").createAppOrder;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 12 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    await pool.query(
      `insert into public.menu_items (id, "categoryKey", name, "priceMinor", "isActive")
       values ($1, 'hot', 'Cüzdan Latte', $2, true)
       on conflict (id) do update set "priceMinor" = excluded."priceMinor",
         "isActive" = true, "categoryKey" = 'hot'`,
      [ITEM, PRICE],
    );
    ({ createAppOrder } = await import("@/lib/mobile/orders"));
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query(
      `delete from public.wallet_transactions where "customerEmail" like $1`,
      [`wallet-${RUN}-%`],
    );
    await pool?.end();
    pool = null;
    holder.pool = null;
    await release?.();
  });

  beforeEach(() => {
    vi.stubEnv("WALLET_ENABLED", "true");
    pos.sessions = 0;
  });

  it("pays the whole order, marks it paid and opens no checkout", async () => {
    const who = member();
    await topUp(who.email, 15_000);

    const res = await createAppOrder(who, body());

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payment).toBeNull();
    expect(res.order.status).toBe("paid");
    expect(pos.sessions).toBe(0);
    expect(await balance(who.email)).toBe(5_000);

    const [order] = await ordersOf(who.email);
    expect(order.status).toBe("paid");
    const { rows: txns } = await pool!.query(
      `select provider, "providerRef", "amountMinor", status
         from public.payment_transactions where "orderId" = $1`,
      [order.id],
    );
    expect(txns).toEqual([
      {
        provider: "wallet",
        providerRef: `wallet_${order.id}`,
        amountMinor: PRICE,
        status: "succeeded",
      },
    ]);
    // The paid path's side effects ran: a ₺100 order is under the ₺140
    // stamp minimum (STAMP_MIN_ORDER_MINOR), so it earns no stamp.
    const { rows: stamps } = await pool!.query(
      `select 1 from public.loyalty_stamps where "orderId" = $1`,
      [order.id],
    );
    expect(stamps).toHaveLength(0);
  });

  it("refuses a short balance with 409 and writes no order and no spend", async () => {
    const who = member();
    await topUp(who.email, PRICE - 1);

    const res = await createAppOrder(who, body());

    expect(res).toEqual({
      ok: false,
      failure: expect.objectContaining({
        status: 409,
        code: "insufficient_balance",
      }),
    });
    expect(await ordersOf(who.email)).toEqual([]);
    expect(await balance(who.email)).toBe(PRICE - 1);
  });

  it("lets only one of two concurrent orders spend a balance that covers one", async () => {
    const who = member();
    await topUp(who.email, PRICE + PRICE / 2);

    const results = await Promise.all([
      createAppOrder(who, body({ clientOrderId: `a-${RUN}` })),
      createAppOrder(who, body({ clientOrderId: `b-${RUN}` })),
    ]);

    const won = results.filter((r) => r.ok);
    const lost = results.filter((r) => !r.ok);
    expect(won).toHaveLength(1);
    expect(lost).toEqual([
      {
        ok: false,
        failure: expect.objectContaining({ code: "insufficient_balance" }),
      },
    ]);
    expect(await balance(who.email)).toBe(PRICE / 2);
    const orders = await ordersOf(who.email);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("paid");
  });

  it("refuses with 409 total_changed when the price moved since the member saw it", async () => {
    const who = member();
    await topUp(who.email, 50_000);

    const res = await createAppOrder(
      who,
      body({ expectedTotalMinor: PRICE - 500 }),
    );

    expect(res).toEqual({
      ok: false,
      failure: expect.objectContaining({
        status: 409,
        code: "total_changed",
        extra: { totalMinor: PRICE },
      }),
    });
    expect(await ordersOf(who.email)).toEqual([]);
    expect(await balance(who.email)).toBe(50_000);
  });

  it("refuses with 409 total_changed when the promo the member saw was dropped", async () => {
    const who = member();
    await topUp(who.email, 50_000);

    // The member saw a discounted total; the code does not hold at checkout,
    // so the server's total is the full price - a wallet must not take it.
    const res = await createAppOrder(
      who,
      body({ promoCode: `YOK-${RUN}`, expectedTotalMinor: PRICE - 2_000 }),
    );

    expect(res).toEqual({
      ok: false,
      failure: expect.objectContaining({
        code: "total_changed",
        extra: { totalMinor: PRICE },
      }),
    });
    expect(await ordersOf(who.email)).toEqual([]);
    expect(await balance(who.email)).toBe(50_000);
  });

  it("pays when the expected total is the server's, and ignores it on a card order", async () => {
    const who = member();
    await topUp(who.email, PRICE);
    const paid = await createAppOrder(who, body({ expectedTotalMinor: PRICE }));
    expect(paid.ok && paid.order.status).toBe("paid");
    expect(await balance(who.email)).toBe(0);

    // Without payWithWallet the field changes nothing: the card checkout
    // opens and its own "Tutar değişti" card is the member's chance.
    const card = await createAppOrder(
      member(),
      body({ payWithWallet: false, expectedTotalMinor: 1 }),
    );
    expect(card.ok && card.payment).not.toBeNull();
  });

  it("refuses payWithWallet while the wallet is switched off", async () => {
    vi.stubEnv("WALLET_ENABLED", "");
    const who = member();
    await topUp(who.email, 50_000);

    const res = await createAppOrder(who, body());

    expect(res).toEqual({
      ok: false,
      failure: expect.objectContaining({
        status: 409,
        code: "insufficient_balance",
      }),
    });
    expect(await ordersOf(who.email)).toEqual([]);
    expect(await balance(who.email)).toBe(50_000);
  });

  it("books a wallet order the process never marked paid, instead of cancelling it", async () => {
    const who = member();
    await topUp(who.email, PRICE);
    const id = `ord-wallet-${RUN}`;
    // What a crash between the SQL function and the booking leaves behind:
    // the order (pending, older than the sweep's window) and its spend.
    const { rows } = await pool!.query(
      `select public.wallet_place_order($1::jsonb, 'test', $2) as placed`,
      [
        JSON.stringify({
          id,
          orderNo: 900_000 + Math.floor(Math.random() * 90_000),
          customerEmail: who.email,
          status: "pending_payment",
          channel: "app",
          kind: "cafe",
          fulfillment: "pickup",
          items: [],
          subtotalMinor: PRICE,
          totalMinor: PRICE,
          createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        }),
        new Date().toISOString(),
      ],
    );
    expect(rows[0].placed).toBe(true);

    const { expireStalePendingOrders } = await import("@/lib/admin/store");
    await expireStalePendingOrders();

    const [order] = await ordersOf(who.email);
    expect(order.status).toBe("paid");
    expect(await balance(who.email)).toBe(0);
  });

  it("credits a refund of a wallet order back to the wallet, once per entry", async () => {
    const who = member();
    await topUp(who.email, PRICE);
    const res = await createAppOrder(who, body());
    expect(res.ok).toBe(true);
    const [order] = await ordersOf(who.email);

    const { creditWalletRefund } = await import("@/lib/mobile/wallet");
    const refund = {
      orderId: order.id,
      refundId: "rfn-1-test",
      amountMinor: 4_000,
      title: "İade",
    };
    await creditWalletRefund(refund);
    await creditWalletRefund(refund); // a retried action credits once

    expect(await balance(who.email)).toBe(4_000);
  });
});
