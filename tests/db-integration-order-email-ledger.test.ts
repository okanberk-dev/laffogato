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

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * An order's e-mail is the key its loyalty stamps and its member coupon are
 * filed under: `onOrderReversed` and the cancel's coupon release both read
 * the order's CURRENT e-mail. Moving a paid app order to another address
 * after it earned stamps (or spent a coupon) used to strand both under the
 * old one, so a later cancel or refund took nothing back (admin audit
 * ORD-16, verifier C1). Real loyalty code, real Postgres; skipped without
 * TEST_DATABASE_URL, like the other db-integration suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.5" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/lib/email/send", () => ({
  sendOrderPaidEmail: async () => ({ ok: true as const }),
  sendOrderCancelledEmail: async () => ({ ok: true as const }),
  sendOrderShippedEmail: async () => ({ ok: true as const }),
  sendOrderRefundedEmail: async () => ({ ok: true as const }),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    lookupPayment: async () => null,
    refund: async () => ({ status: "succeeded" }),
  }),
}));

const PREFIX = "ord-eml-";
const RUN = Date.now().toString(36);
const A = `eml-a-${RUN}@laffogato.net`;
const B = `eml-b-${RUN}@laffogato.net`;

async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool!.query(text, params)).rows as T[];
}

/** A paid ₺700 app cafe order of member A: 3 stamps' worth. */
async function appCafeOrder(
  id: string,
  orderNo: number,
  fields: { status?: string; promoCode?: string; paidAt?: string } = {},
) {
  await q(
    `insert into public.orders (id, "orderNo", status, items, refunds,
       "totalMinor", "subtotalMinor", "shippingMinor", channel, kind,
       fulfillment, "createdAt", "paidAt", "customerEmail", "customerName",
       "promoCode")
     values ($1, $2, $3, '[]'::jsonb, '[]'::jsonb, 70000, 70000, 0, 'app',
       'cafe', 'pickup', $4, $5, $6, 'Eda Yılmaz', $7)`,
    [
      id,
      orderNo,
      fields.status ?? "paid",
      new Date().toISOString(),
      fields.paidAt ?? new Date().toISOString(),
      A,
      fields.promoCode ?? "",
    ],
  );
}

async function balance(email: string, orderId: string) {
  return q<{ kind: string; delta: number }>(
    `select kind, delta from public.loyalty_stamps
      where lower("customerEmail") = lower($1) and "orderId" = $2
      order by kind`,
    [email, orderId],
  );
}

maybe("an order's e-mail and the ledger filed under it", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 8 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await q(
      `delete from public.loyalty_stamps where "orderId" like '${PREFIX}%'`,
    );
    await q(`delete from public.customer_coupons where id like '${PREFIX}%'`);
    await q(
      `delete from public.order_notice_emails where "orderId" like '${PREFIX}%'`,
    );
    await q(`delete from public.orders where id like '${PREFIX}%'`);
  });

  async function moveEmail(id: string, to: string) {
    const store = await import("@/lib/admin/store");
    const { orderDetailsRefusal } = await import("@/lib/admin/order-details");
    const input = {
      customerName: "Eda Yılmaz",
      customerEmail: to,
      customerPhone: "",
      shippingAddress: "",
    };
    // What saveOrderDetailsAction asks for the owner, confirmed.
    return store.updateOrderDetails(id, input, (existing) =>
      orderDetailsRefusal(existing, input, "owner", true),
    );
  }

  it("refuses to move an order that earned stamps, so a cancel takes them back", async () => {
    const id = `${PREFIX}1`;
    await appCafeOrder(id, 995001);
    const store = await import("@/lib/admin/store");
    const { onOrderPaid } = await import("@/lib/mobile/loyalty");
    await onOrderPaid((await store.getOrder(id))!);
    expect(await balance(A, id)).toEqual([{ kind: "earn", delta: 3 }]);

    const moved = await moveEmail(id, B);
    expect(moved.ok).toBe(false);

    const cancelled = await store.transitionOrder(id, "cancel", {
      actor: "owner@laffogato.net",
    });
    expect(cancelled.ok).toBe(true);
    const rows = await balance(A, id);
    expect(rows.filter((r) => r.kind === "reversal")).toHaveLength(3);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBe(0);
  });

  it("refuses to move an order holding a member coupon, so a cancel gives it back", async () => {
    const id = `${PREFIX}2`;
    const code = `EML${RUN}`.toUpperCase();
    // Claimed at checkout, before payment: an unpaid order holds it too.
    await appCafeOrder(id, 995002, {
      status: "pending_payment",
      promoCode: code,
      paidAt: "",
    });
    await q(
      `insert into public.customer_coupons (id, "customerEmail", code, kind,
         value, source, "redeemedAt", "redeemedOrderNo", "isActive",
         "createdAt", "updatedAt")
       values ($1, $2, $3, 'pct', 10, 'welcome', $4, 995002, true, $4, $4)`,
      [`${PREFIX}c2`, A, code, new Date().toISOString()],
    );

    const moved = await moveEmail(id, B);
    expect(moved.ok).toBe(false);

    const store = await import("@/lib/admin/store");
    const cancelled = await store.transitionOrder(id, "cancel", {
      actor: "owner@laffogato.net",
    });
    expect(cancelled.ok).toBe(true);
    const [c] = await q<{ redeemedOrderNo: number; redeemedAt: string }>(
      `select "redeemedOrderNo", "redeemedAt" from public.customer_coupons
        where id = $1`,
      [`${PREFIX}c2`],
    );
    expect(c).toEqual({ redeemedOrderNo: 0, redeemedAt: "" });
  });

  it("still moves an order nothing is filed under yet", async () => {
    const id = `${PREFIX}3`;
    await appCafeOrder(id, 995003, { status: "pending_payment", paidAt: "" });
    const moved = await moveEmail(id, B);
    expect(moved).toMatchObject({ ok: true, order: { customerEmail: B } });
  });
});
