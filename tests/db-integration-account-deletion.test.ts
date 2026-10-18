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
 * row. Skipped without TEST_DATABASE_URL.
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
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => null }));
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
});
