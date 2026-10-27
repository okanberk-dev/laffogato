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
  answers: new Map<string, "paid" | "unpaid" | "down" | "wrong-amount">(),
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
  sendOrderPaidEmail: async () => ({ ok: true as const }),
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
        // "wrong-amount": the bank collected something other than the order costs.
        amountMinor: answer === "wrong-amount" ? 4000 : 5000,
        currency: "TRY",
        raw: { source: "test" },
        trxDate: "2026-09-22",
      };
    },
  }),
}));

const HOUR = 60 * 60_000;

async function insertPending(
  id: string,
  orderNo: number,
  opts: { ageMs: number; channel?: string; email?: string; source?: string },
): Promise<void> {
  await pool!.query(
    `insert into public.orders (id, "orderNo", "customerEmail", status, channel,
       "totalMinor", "subtotalMinor", items, refunds, "createdAt", source)
     values ($1, $2, $3, 'pending_payment', $4, 5000, 5000, '[]'::jsonb,
       '[]'::jsonb, $5, $6)`,
    [
      id,
      orderNo,
      opts.email ?? "supurme@laffogato.net",
      opts.channel ?? "web",
      new Date(Date.now() - opts.ageMs).toISOString(),
      opts.source ?? "",
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
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 12 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
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
      `select "providerRef", status, "trxDate" from public.payment_transactions
        where "orderId" = 'ord-swp-paid'`,
    );
    // The POS's day lands on the row, so a refund need not search for it.
    expect(rows).toEqual([
      {
        providerRef: "REF-ord-swp-paid",
        status: "succeeded",
        trxDate: "2026-09-22",
      },
    ]);
    const { getOrderPaymentRef } = await import("@/lib/admin/store");
    expect(await getOrderPaymentRef("ord-swp-paid")).toEqual({
      provider: "fakepos",
      providerRef: "REF-ord-swp-paid",
      amountMinor: 5000,
      trxDate: "2026-09-22",
    });
  });

  it("stores '' for a payment row the provider gave no readable day", async () => {
    await pool!.query(
      `insert into public.payment_transactions
         ("orderId", provider, "providerRef", status, "amountMinor", "createdAt")
       values ('ord-swp-legacy', 'fakepos', 'REF-legacy', 'succeeded', 4200, $1)`,
      [new Date().toISOString()],
    );
    const { getOrderPaymentRef } = await import("@/lib/admin/store");
    expect(await getOrderPaymentRef("ord-swp-legacy")).toEqual({
      provider: "fakepos",
      providerRef: "REF-legacy",
      amountMinor: 4200,
      trxDate: "",
    });
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

  it("does not read an unreachable POS as 'unpaid' - until a day has passed", async () => {
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

  // The account closure (DELETE /me, 27 Oct 2026; docs/API-MOBILE.md §4):
  // the member's own unpaid checkouts go first, whatever their age, so a
  // member who stopped on the payment page can still delete the account.
  describe("cancelUnpaidOrdersOfClosingAccount (account closure)", () => {
    const member = "kapanis@laffogato.net";

    it("cancels the member's own unpaid orders of any age and gives back what they held", async () => {
      // audit_logs is append-only: rows from an earlier run of this suite stay.
      const startedAt = new Date().toISOString();
      await insertPending("ord-swp-cls1", 993101, {
        ageMs: 60_000,
        email: member,
        channel: "app",
      });
      await insertPending("ord-swp-cls2", 993102, {
        ageMs: 60_000,
        // Stored with whatever case the checkout captured.
        email: "Kapanis@Laffogato.net",
      });
      await insertPending("ord-swp-cls3", 993103, { ageMs: 60_000 });
      const {
        cancelUnpaidOrdersOfClosingAccount,
        ACCOUNT_CLOSED_CANCEL_REASON,
      } = await import("@/lib/admin/store");

      expect(await cancelUnpaidOrdersOfClosingAccount(member)).toBe(2);
      // Rule 29: the POS was asked about each before it was cancelled.
      expect(pos.asked).toEqual(
        expect.arrayContaining(["ord-swp-cls1", "ord-swp-cls2"]),
      );
      expect(await statusOf("ord-swp-cls1")).toBe("cancelled");
      expect(await statusOf("ord-swp-cls2")).toBe("cancelled");
      // Someone else's order is never touched.
      expect(await statusOf("ord-swp-cls3")).toBe("pending_payment");
      const { rows } = await pool!.query(
        `select "stockReleasedAt" from public.orders where id = 'ord-swp-cls1'`,
      );
      expect(rows[0].stockReleasedAt).not.toBe("");
      // The order page's timeline says why nobody pressed a button.
      const audit = await pool!.query(
        `select actor, action, payload from public.audit_logs
          where entity = 'order' and "entityId" = 'ord-swp-cls1'
            and "createdAt" >= $1`,
        [startedAt],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].actor).toBe("system");
      expect(audit.rows[0].action).toBe("transition");
      expect(audit.rows[0].payload).toMatchObject({
        from: "pending_payment",
        to: "cancelled",
        reason: ACCOUNT_CLOSED_CANCEL_REASON,
      });
    });

    it("books instead of cancelling when the POS says it was paid", async () => {
      await insertPending("ord-swp-cls4", 993104, {
        ageMs: 60_000,
        email: member,
      });
      pos.answers.set("ord-swp-cls4", "paid");
      const { cancelUnpaidOrdersOfClosingAccount } =
        await import("@/lib/admin/store");

      expect(await cancelUnpaidOrdersOfClosingAccount(member)).toBe(0);
      // Paid: the closure then waits for it like any paid order.
      expect(await statusOf("ord-swp-cls4")).toBe("paid");
    });

    it("leaves a fresh order pending while the POS cannot be asked, gives up after a day", async () => {
      await insertPending("ord-swp-cls5", 993105, {
        ageMs: 60_000,
        email: member,
      });
      await insertPending("ord-swp-cls6", 993106, {
        ageMs: 25 * HOUR,
        email: member,
      });
      pos.answers.set("ord-swp-cls5", "down");
      pos.answers.set("ord-swp-cls6", "down");
      const { cancelUnpaidOrdersOfClosingAccount } =
        await import("@/lib/admin/store");

      expect(await cancelUnpaidOrdersOfClosingAccount(member)).toBe(1);
      expect(await statusOf("ord-swp-cls5")).toBe("pending_payment");
      expect(await statusOf("ord-swp-cls6")).toBe("cancelled");
    });

    it("leaves a panel order paid on delivery alone", async () => {
      await insertPending("ord-swp-cls7", 993107, {
        ageMs: 60_000,
        email: member,
        source: "manual",
      });
      const { cancelUnpaidOrdersOfClosingAccount } =
        await import("@/lib/admin/store");

      expect(await cancelUnpaidOrdersOfClosingAccount(member)).toBe(0);
      expect(pos.asked).not.toContain("ord-swp-cls7");
      expect(await statusOf("ord-swp-cls7")).toBe("pending_payment");
    });

    it("a payment that lands afterwards does not revive the order: it waits for a refund", async () => {
      // The bank's 3-D Secure page was still open when the account closed.
      await insertPending("ord-swp-cls8", 993108, {
        ageMs: 60_000,
        email: member,
        channel: "app",
      });
      const { applyPaymentSucceeded, cancelUnpaidOrdersOfClosingAccount } =
        await import("@/lib/admin/store");
      expect(await cancelUnpaidOrdersOfClosingAccount(member)).toBe(1);
      // The closure rewrites the address on the member's orders.
      await pool!.query(
        `update public.orders set "customerEmail" = 'deleted-cst-cls@anon.local'
          where id = 'ord-swp-cls8'`,
      );

      expect(
        await applyPaymentSucceeded({
          orderId: "ord-swp-cls8",
          provider: "fakepos",
          providerRef: "REF-late-cls8",
          amountMinor: 5000,
          currency: "TRY",
          trxDate: "2026-10-27",
        }),
      ).toEqual({ ok: true, reconcile: "order_not_open" });
      const { rows } = await pool!.query(
        `select status, "paidAt", attention from public.orders
          where id = 'ord-swp-cls8'`,
      );
      expect(rows[0].status).toBe("cancelled");
      expect(rows[0].paidAt ?? "").toBe("");
      // In front of a person: "Kapalı siparişe ödeme geldi" → iade.
      expect(rows[0].attention).toBe("order_not_open");
      // The money is on record, so the refund path can find it.
      const paid = await pool!.query(
        `select status from public.payment_transactions
          where "orderId" = 'ord-swp-cls8'`,
      );
      expect(paid.rows).toEqual([{ status: "succeeded" }]);
    });
  });

  // The web checkout asks the POS before it hands an old order's payload
  // out again (startCheckoutAction, docs/PAYNKOLAY.md §15.5): a customer who
  // paid at the bank and lost the return must not be charged twice.
  describe("checkPendingOrderPaid (the reuse gate)", () => {
    it("books an order the POS shows as paid, and says so", async () => {
      await insertPending("ord-swp-reuse1", 993021, { ageMs: 60_000 });
      pos.answers.set("ord-swp-reuse1", "paid");
      const { checkPendingOrderPaid, getOrder } =
        await import("@/lib/admin/store");
      const order = (await getOrder("ord-swp-reuse1"))!;
      const provider = (await import("@/lib/payment")).getPaymentProvider();
      expect(await checkPendingOrderPaid(order, provider)).toBe("paid");
      expect(await statusOf("ord-swp-reuse1")).toBe("paid");
    });

    it("lets an order the POS knows nothing about be reused", async () => {
      await insertPending("ord-swp-reuse2", 993022, { ageMs: 60_000 });
      pos.answers.set("ord-swp-reuse2", "unpaid");
      const { checkPendingOrderPaid, getOrder } =
        await import("@/lib/admin/store");
      const order = (await getOrder("ord-swp-reuse2"))!;
      const provider = (await import("@/lib/payment")).getPaymentProvider();
      expect(await checkPendingOrderPaid(order, provider)).toBe("unpaid");
      expect(await statusOf("ord-swp-reuse2")).toBe("pending_payment");
    });

    it("answers unknown, not unpaid, when the POS collected a different amount", async () => {
      // The sweep may cancel such an order, but a retry that reused it would
      // charge the customer again on top of the wrong charge.
      await insertPending("ord-swp-reuse4", 993024, { ageMs: 60_000 });
      pos.answers.set("ord-swp-reuse4", "wrong-amount");
      const { checkPendingOrderPaid, getOrder } =
        await import("@/lib/admin/store");
      const order = (await getOrder("ord-swp-reuse4"))!;
      const provider = (await import("@/lib/payment")).getPaymentProvider();
      expect(await checkPendingOrderPaid(order, provider)).toBe("unknown");
      expect(await statusOf("ord-swp-reuse4")).toBe("pending_payment");
    });

    it("answers unknown, never unpaid, when the POS cannot be asked", async () => {
      await insertPending("ord-swp-reuse3", 993023, { ageMs: 60_000 });
      pos.answers.set("ord-swp-reuse3", "down");
      const { checkPendingOrderPaid, getOrder } =
        await import("@/lib/admin/store");
      const order = (await getOrder("ord-swp-reuse3"))!;
      const provider = (await import("@/lib/payment")).getPaymentProvider();
      expect(await checkPendingOrderPaid(order, provider)).toBe("unknown");
      expect(await statusOf("ord-swp-reuse3")).toBe("pending_payment");
    });
  });
});
