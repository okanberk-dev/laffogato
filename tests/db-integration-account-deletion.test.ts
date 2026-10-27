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
 * The web deletion request (migration 20261018090000) against a real
 * Postgres: two presses at once open one request, the withdrawal clears it,
 * an inactive account cannot open one, an open request keeps the member
 * out of commercial mail (migration 20261018090100), and the closure
 * (`deleteMe`, the app's DELETE /me too) blanks it with the rest of the
 * row - and what the closure does with the member's orders (27 Oct 2026,
 * docs/API-MOBILE.md §4). Skipped without TEST_DATABASE_URL.
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
  headers: async () => new Headers({ "x-forwarded-for": "10.20.30.40" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
/**
 * The POS the closure asks before it cancels an unpaid order: nothing is
 * paid and nothing is in flight unless a test says so.
 */
const pos = vi.hoisted(() => ({
  /** A sale at the bank's 3-D Secure step (`hasPaymentInFlight`). */
  inFlight: new Set<string>(),
  /** A payment the lookup finds (the return never arrived). */
  paid: new Set<string>(),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    hasPaymentInFlight: async (orderId: string) => pos.inFlight.has(orderId),
    lookupPayment: async (orderId: string) =>
      pos.paid.has(orderId)
        ? {
            status: "succeeded",
            orderId,
            providerRef: `REF-${orderId}`,
            amountMinor: 5000,
            currency: "TRY",
            raw: { source: "test" },
            trxDate: "2026-10-27",
          }
        : null,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  deleteSupabaseIdentity: async () => "skipped",
  updateSupabasePassword: async () => {},
}));
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendTemplate: async () => true,
}));

const PREFIX = "silmetalebi-";

async function insertMember(email: string, isActive = true): Promise<void> {
  await pool!.query(
    `insert into public.customers
       (id, email, name, "isActive", "emailVerified", "notificationPrefs",
        "createdAt", "updatedAt")
     values ($1, $2, 'Üye', $3, true, $4::jsonb, $5, $5)`,
    [
      `cst-${email}`,
      email,
      isActive,
      JSON.stringify({
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      }),
      "2026-01-01T00:00:00.000Z",
    ],
  );
}

async function row(id: string) {
  const { rows } = await pool!.query(
    `select email, "deletionRequestedAt", "deletionReason" from public.customers where id = $1`,
    [id],
  );
  return rows[0] as {
    email: string;
    deletionRequestedAt: string | null;
    deletionReason: string;
  };
}

maybe("deletion request against a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(
      `delete from public.customers where email like $1 or id like $2`,
      [`${PREFIX}%`, `cst-${PREFIX}%`],
    );
  });

  it("a new row has no request, and the column is nullable", async () => {
    const email = `${PREFIX}yeni@laffogato.net`;
    await insertMember(email);
    expect(await row(`cst-${email}`)).toMatchObject({
      deletionRequestedAt: null,
      deletionReason: "",
    });
  });

  it("two presses at once open one request with one date", async () => {
    const { openDeletionRequest } =
      await import("@/lib/customer/deletion-request");
    const email = `${PREFIX}cift@laffogato.net`;
    await insertMember(email);
    const [a, b] = await Promise.all([
      openDeletionRequest(email, "birinci", new Date("2026-10-18T09:00:00Z")),
      openDeletionRequest(email, "ikinci", new Date("2026-10-18T09:00:01Z")),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["created", "exists"]);
    const stored = await row(`cst-${email}`);
    const created = [a, b].find((r) => r.status === "created")!;
    expect(stored.deletionRequestedAt).toBe(
      "requestedAt" in created ? created.requestedAt : "",
    );
    // The later press neither moved the date nor replaced the reason.
    const third = await openDeletionRequest(
      email,
      "üçüncü",
      new Date("2026-10-19T09:00:00Z"),
    );
    expect(third).toEqual({
      status: "exists",
      requestedAt: stored.deletionRequestedAt,
    });
    expect((await row(`cst-${email}`)).deletionReason).toBe(
      stored.deletionReason,
    );
  });

  it("an inactive account cannot open one", async () => {
    const { openDeletionRequest } =
      await import("@/lib/customer/deletion-request");
    const email = `${PREFIX}pasif@laffogato.net`;
    await insertMember(email, false);
    await expect(openDeletionRequest(email, "")).resolves.toEqual({
      status: "not_found",
    });
    expect((await row(`cst-${email}`)).deletionRequestedAt).toBeNull();
  });

  it("the withdrawal clears it, once", async () => {
    const { openDeletionRequest, withdrawDeletionRequest } =
      await import("@/lib/customer/deletion-request");
    const email = `${PREFIX}geri@laffogato.net`;
    await insertMember(email);
    await openDeletionRequest(email, "neden", new Date("2026-10-18T09:00:00Z"));
    await expect(withdrawDeletionRequest(email)).resolves.toEqual({
      status: "withdrawn",
      requestedAt: "2026-10-18T09:00:00.000Z",
    });
    expect(await row(`cst-${email}`)).toMatchObject({
      deletionRequestedAt: null,
      deletionReason: "",
    });
    await expect(withdrawDeletionRequest(email)).resolves.toEqual({
      status: "none",
    });
  });

  it("an open request takes the member out of commercial mail, a withdrawal puts them back", async () => {
    // 20261018090100: 6563 m.8/3, the request is the refusal. The birthday
    // coupon row stays (an account right), only its mail flag turns false.
    const { openDeletionRequest, withdrawDeletionRequest } =
      await import("@/lib/customer/deletion-request");
    const email = `${PREFIX}ileti@laffogato.net`;
    await pool!.query(
      `delete from public.newsletter_subscribers where email like $1`,
      [`${PREFIX}%`],
    );
    await pool!.query(
      `insert into public.customers
         (id, email, name, "isActive", "emailVerified", "notificationPrefs",
          "marketingConsentAt", "unsubToken", birthday, "createdAt", "updatedAt")
       values ($1, $2, 'Üye', true, true,
               '{"orderUpdates":true,"marketing":true,"newsletter":true}'::jsonb,
               '2026-09-01T10:00:00.000Z', 'tok-silme', '1990-10-18',
               '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      [`cst-${email}`, email],
    );
    // The same address on the bulletin list, as its own subscriber row.
    await pool!.query(
      `insert into public.newsletter_subscribers
         (id, email, name, "isActive", "consentAt", "unsubToken")
       values ($1, $2, 'Üye', true, '2026-09-01T10:00:00.000Z', 'tok-silme-abone')`,
      [`nws-${email}`, email],
    );
    // Registered in İYS (20261022180100_iys_send_gate.sql): without it the
    // address is in no commercial audience at all.
    await pool!.query(
      `insert into public.iys_recipients
         (email, "desiredStatus", "iysStatus", "createdAt", "updatedAt")
       values ($1, 'ONAY', 'ONAY', '2026-09-02T10:00:00.000Z',
               '2026-09-02T10:00:00.000Z')
       on conflict (email) do update set "iysStatus" = 'ONAY'`,
      [email],
    );
    const named = async () => {
      const out: string[] = [];
      for (const [audience, pref] of [
        ["marketing", "marketing"],
        ["newsletter", "newsletter"],
        ["both", "marketing"],
      ]) {
        const r = await pool!.query<{ email: string }>(
          `select email from public.campaign_email_audience($1, $2) where email = $3`,
          [audience, pref, email],
        );
        if (r.rows.length > 0) out.push(audience);
      }
      return out;
    };
    const greeting = async () =>
      (
        await pool!.query<{ marketing: boolean }>(
          `select marketing from public.birthday_greeting_audience('["10-18"]'::jsonb)
            where email = $1`,
          [email],
        )
      ).rows;

    expect(await named()).toEqual(["marketing", "newsletter", "both"]);
    expect(await greeting()).toEqual([{ marketing: true }]);

    await openDeletionRequest(email, "", new Date("2026-10-18T09:00:00Z"));
    expect(await named()).toEqual([]);
    expect(await greeting()).toEqual([{ marketing: false }]);

    await withdrawDeletionRequest(email);
    expect(await named()).toEqual(["marketing", "newsletter", "both"]);
    expect(await greeting()).toEqual([{ marketing: true }]);

    await pool!.query(
      `delete from public.newsletter_subscribers where email like $1`,
      [`${PREFIX}%`],
    );
  });

  it("the closure blanks the request and its reason with the row", async () => {
    const { openDeletionRequest } =
      await import("@/lib/customer/deletion-request");
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}kapat@laffogato.net`;
    await insertMember(email);
    await openDeletionRequest(email, "Taşınıyorum");
    const customer = await getCustomerByEmail(email);
    expect((await deleteMe(customer!, { by: "admin" })).ok).toBe(true);
    const closed = await row(`cst-${email}`);
    expect(closed.email).toMatch(/@anon\.local$/);
    expect(closed.deletionRequestedAt).toBeNull();
    expect(closed.deletionReason).toBe("");
  });

  // DELETE /me and an order nobody paid for (27 Oct 2026, App Review
  // 5.1.1(v); docs/API-MOBILE.md §4): the tester stops on the payment page,
  // comes back and deletes the account.
  async function insertOrder(
    id: string,
    orderNo: number,
    email: string,
    status: string,
    source = "",
  ): Promise<void> {
    await pool!.query(
      `insert into public.orders (id, "orderNo", "customerEmail", status,
         channel, "totalMinor", "subtotalMinor", items, refunds, "createdAt",
         source)
       values ($1, $2, $3, $4, 'app', 5000, 5000, '[]'::jsonb, '[]'::jsonb, $5,
         $6)`,
      [
        id,
        orderNo,
        email,
        status,
        new Date(Date.now() - 60_000).toISOString(),
        source,
      ],
    );
  }

  async function statuses(): Promise<Array<{ id: string; status: string }>> {
    const { rows } = await pool!.query(
      `select id, status from public.orders where id like 'ord-silme-%'
        order by id`,
    );
    return rows as Array<{ id: string; status: string }>;
  }

  /** The order's timeline rows written since `since`. */
  async function timeline(id: string, since: string) {
    const { rows } = await pool!.query(
      `select actor, payload from public.audit_logs
        where entity = 'order' and "entityId" = $1 and "createdAt" >= $2`,
      [id, since],
    );
    return rows as Array<{ actor: string; payload: Record<string, unknown> }>;
  }

  beforeEach(async () => {
    pos.inFlight.clear();
    pos.paid.clear();
    await pool!.query(
      `delete from public.payment_transactions where "orderId" like 'ord-silme-%'`,
    );
    await pool!.query(`delete from public.orders where id like 'ord-silme-%'`);
  });

  it("closes an account whose only order was never paid, and cancels that order", async () => {
    // audit_logs is append-only: rows from an earlier run stay.
    const startedAt = new Date().toISOString();
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}odenmemis@laffogato.net`;
    await insertMember(email);
    // A minute old: the 45-minute sweep would not have reached it, and the
    // POS has no record of it (App Review's tester).
    await insertOrder("ord-silme-1", 995701, email, "pending_payment");
    const customer = await getCustomerByEmail(email);

    expect((await deleteMe(customer!)).ok).toBe(true);
    const { rows } = await pool!.query(
      `select status, "customerEmail", "stockReleasedAt" from public.orders
        where id = 'ord-silme-1'`,
    );
    expect(rows[0].status).toBe("cancelled");
    expect(rows[0].customerEmail).toMatch(/@anon\.local$/);
    expect(rows[0].stockReleasedAt).not.toBe("");
    expect((await row(`cst-${email}`)).email).toMatch(/@anon\.local$/);
    // The timeline says the deletion request cancelled it, not that the
    // account was closed.
    const lines = await timeline("ord-silme-1", startedAt);
    expect(lines).toHaveLength(1);
    expect(lines[0].actor).toBe("system");
    expect(lines[0].payload).toMatchObject({
      from: "pending_payment",
      to: "cancelled",
      reason: "Hesap silme isteğiyle ödenmemiş sipariş iptal edildi",
    });
  });

  it("refuses at once while a paid order runs: nothing is cancelled, the account stays open", async () => {
    const startedAt = new Date().toISOString();
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}odenmis@laffogato.net`;
    await insertMember(email);
    await insertOrder("ord-silme-2", 995702, email, "paid");
    await insertOrder("ord-silme-3", 995703, email, "pending_payment");
    const customer = await getCustomerByEmail(email);

    expect(await deleteMe(customer!)).toEqual({
      ok: false,
      error: "orders_in_progress",
      // Every order in progress, the unpaid one included.
      count: 2,
    });
    expect((await row(`cst-${email}`)).email).toBe(email);
    expect(await statuses()).toEqual([
      { id: "ord-silme-2", status: "paid" },
      // A closure that is refused anyway cancels nothing on the way.
      { id: "ord-silme-3", status: "pending_payment" },
    ]);
    expect(await timeline("ord-silme-3", startedAt)).toEqual([]);
  });

  it("refuses at once on a panel order paid on delivery", async () => {
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}kapida@laffogato.net`;
    await insertMember(email);
    await insertOrder(
      "ord-silme-4",
      995704,
      email,
      "pending_payment",
      "manual",
    );
    await insertOrder("ord-silme-5", 995705, email, "pending_payment");
    const customer = await getCustomerByEmail(email);

    expect(await deleteMe(customer!)).toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 2,
    });
    expect((await row(`cst-${email}`)).email).toBe(email);
    expect(await statuses()).toEqual([
      { id: "ord-silme-4", status: "pending_payment" },
      { id: "ord-silme-5", status: "pending_payment" },
    ]);
  });

  it("waits while a young order's sale is at the bank's 3-D Secure step", async () => {
    const startedAt = new Date().toISOString();
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}3d@laffogato.net`;
    await insertMember(email);
    await insertOrder("ord-silme-6", 995706, email, "pending_payment");
    pos.inFlight.add("ord-silme-6");
    const customer = await getCustomerByEmail(email);

    expect(await deleteMe(customer!)).toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect((await row(`cst-${email}`)).email).toBe(email);
    expect(await statuses()).toEqual([
      { id: "ord-silme-6", status: "pending_payment" },
    ]);
    expect(await timeline("ord-silme-6", startedAt)).toEqual([]);
  });

  it("waits for an unpaid order the POS reports paid: it is booked, and then it runs", async () => {
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}geldi@laffogato.net`;
    await insertMember(email);
    await insertOrder("ord-silme-7", 995707, email, "pending_payment");
    pos.paid.add("ord-silme-7");
    const customer = await getCustomerByEmail(email);

    expect(await deleteMe(customer!)).toEqual({
      ok: false,
      error: "orders_in_progress",
      count: 1,
    });
    expect((await row(`cst-${email}`)).email).toBe(email);
    expect(await statuses()).toEqual([{ id: "ord-silme-7", status: "paid" }]);
  });
});
