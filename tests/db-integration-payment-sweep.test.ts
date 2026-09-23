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

/**
 * Unpaid orders are cancelled only after the POS was asked
 * (docs/AUDIT.md §8, docs/PAYNKOLAY.md §14.6/2), against a real Postgres.
 * Skipped without TEST_DATABASE_URL, like tests/db-integration-audit.test.ts.
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

/** What the fake POS answers for each order id. */
const pos = vi.hoisted(() => ({
  answers: new Map<string, "paid" | "unpaid" | "down">(),
  asked: [] as string[],
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
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
vi.mock("@/lib/email/send", () => ({
  sendOrderPaidEmail: async () => {},
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    lookupPayment: async (orderId: string) => {
      pos.asked.push(orderId);
      const answer = pos.answers.get(orderId) ?? "unpaid";
      if (answer === "down") throw new Error("POS unreachable");
      if (answer === "unpaid") return null;
      return {
        status: "succeeded",
        orderId,
        providerRef: `REF-${orderId}`,
        amountMinor: 5000,
        currency: "TRY",
        raw: { source: "test" },
      };
    },
  }),
}));

const HOUR = 60 * 60_000;

async function insertPending(
  id: string,
  orderNo: number,
  opts: { ageMs: number; channel?: string; email?: string },
): Promise<void> {
  await pool!.query(
    `insert into public.orders (id, "orderNo", "customerEmail", status, channel,
       "totalMinor", "subtotalMinor", items, refunds, "createdAt")
     values ($1, $2, $3, 'pending_payment', $4, 5000, 5000, '[]'::jsonb,
       '[]'::jsonb, $5)`,
    [
      id,
      orderNo,
      opts.email ?? "supurme@laffogato.net",
      opts.channel ?? "web",
      new Date(Date.now() - opts.ageMs).toISOString(),
    ],
  );
}

async function statusOf(id: string): Promise<string> {
  const { rows } = await pool!.query(
    `select status from public.orders where id = $1`,
    [id],
  );
  return rows[0]?.status as string;
}

maybe("unpaid orders are cancelled only after asking the POS", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_, max: 12 });
    await applyBundledSchema(pool);
  });

  afterAll(async () => {
    await pool?.end();
    pool = null;
  });

  beforeEach(async () => {
    pos.answers.clear();
    pos.asked.length = 0;
    // The sweep takes the oldest pending orders of the whole table; leftovers
    // from other suites would crowd these out.
    await pool!.query(
      `delete from public.payment_transactions where provider = 'fakepos'`,
    );
    await pool!.query(
      `delete from public.orders where status = 'pending_payment'
          or id like 'ord-swp-%'`,
    );
  });

  it("books a payment the return never delivered, instead of cancelling", async () => {
    await insertPending("ord-swp-paid", 993001, { ageMs: 2 * HOUR });
    pos.answers.set("ord-swp-paid", "paid");
    const { expireStalePendingOrders } = await import("@/lib/admin/store");

    expect(await expireStalePendingOrders()).toBe(0);
    expect(await statusOf("ord-swp-paid")).toBe("paid");
    const { rows } = await pool!.query(
      `select "providerRef", status from public.payment_transactions
        where "orderId" = 'ord-swp-paid'`,
    );
    expect(rows).toEqual([
      { providerRef: "REF-ord-swp-paid", status: "succeeded" },
    ]);
  });

  it("cancels and releases what the POS says was never paid", async () => {
    await insertPending("ord-swp-none", 993002, { ageMs: 2 * HOUR });
    const { expireStalePendingOrders } = await import("@/lib/admin/store");

    expect(await expireStalePendingOrders()).toBe(1);
    expect(pos.asked).toContain("ord-swp-none");
    const { rows } = await pool!.query(
      `select status, "stockReleasedAt" from public.orders where id = 'ord-swp-none'`,
    );
    expect(rows[0].status).toBe("cancelled");
    expect(rows[0].stockReleasedAt).not.toBe("");
  });

  it("does not read an unreachable POS as 'unpaid' — until a day has passed", async () => {
    await insertPending("ord-swp-down", 993003, { ageMs: 2 * HOUR });
    await insertPending("ord-swp-old", 993004, { ageMs: 25 * HOUR });
    pos.answers.set("ord-swp-down", "down");
    pos.answers.set("ord-swp-old", "down");
    const { expireStalePendingOrders } = await import("@/lib/admin/store");

    expect(await expireStalePendingOrders()).toBe(1);
    expect(await statusOf("ord-swp-down")).toBe("pending_payment");
    expect(await statusOf("ord-swp-old")).toBe("cancelled");
  });

  it("leaves a fresh checkout alone", async () => {
    await insertPending("ord-swp-new", 993005, { ageMs: 5 * 60_000 });
    const { expireStalePendingOrders } = await import("@/lib/admin/store");

    expect(await expireStalePendingOrders()).toBe(0);
    expect(pos.asked).not.toContain("ord-swp-new");
    expect(await statusOf("ord-swp-new")).toBe("pending_payment");
  });

  it("a new web checkout releases the member's own unpaid web orders", async () => {
    const member = "yeniden@laffogato.net";
    await insertPending("ord-swp-web", 993006, {
      ageMs: 60_000,
      email: member,
    });
    await insertPending("ord-swp-app", 993007, {
      ageMs: 60_000,
      email: member,
      channel: "app",
    });
    await insertPending("ord-swp-other", 993008, { ageMs: 60_000 });
    const { supersedeUnpaidWebOrders } = await import("@/lib/admin/store");

    expect(await supersedeUnpaidWebOrders(member)).toBe(1);
    expect(await statusOf("ord-swp-web")).toBe("cancelled");
    // The app's checkout may be open in the in-app browser right now.
    expect(await statusOf("ord-swp-app")).toBe("pending_payment");
    // Someone else's order is never touched.
    expect(await statusOf("ord-swp-other")).toBe("pending_payment");
  });

  it("books instead of cancelling when that earlier order was paid after all", async () => {
    const member = "yeniden@laffogato.net";
    await insertPending("ord-swp-web2", 993009, {
      ageMs: 60_000,
      email: member,
    });
    pos.answers.set("ord-swp-web2", "paid");
    const { supersedeUnpaidWebOrders } = await import("@/lib/admin/store");

    expect(await supersedeUnpaidWebOrders(member)).toBe(0);
    expect(await statusOf("ord-swp-web2")).toBe("paid");
  });

  it("keeps an earlier order pending while the POS cannot be asked", async () => {
    const member = "yeniden@laffogato.net";
    await insertPending("ord-swp-web3", 993010, {
      ageMs: 60_000,
      email: member,
    });
    pos.answers.set("ord-swp-web3", "down");
    const { supersedeUnpaidWebOrders } = await import("@/lib/admin/store");

    expect(await supersedeUnpaidWebOrders(member)).toBe(0);
    expect(await statusOf("ord-swp-web3")).toBe("pending_payment");
  });
});
