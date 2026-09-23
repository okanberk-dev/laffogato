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
 * The consent ledger (`customer_consents`) against a real Postgres: every
 * writer of a member's commercial preferences appends one row per purpose it
 * changed, the table refuses updates, and the retention function only takes
 * rows whose consent ended more than three years ago. Runs the app's own
 * store functions with `getDb()` pointed at TEST_DATABASE_URL. Skipped
 * without one:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
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
  headers: async () =>
    new Headers({
      "x-forwarded-for": "10.20.30.40",
      "user-agent": "LAffogato/1.0 (iOS)",
    }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => null }));
vi.mock("@/lib/supabase/admin", () => ({
  deleteSupabaseIdentity: async () => ({ deleted: false, reason: "test" }),
  updateSupabasePassword: async () => {},
}));
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  sendTemplate: async () => true,
}));

const PREFIX = "rizadefteri-";

interface LedgerRow {
  purpose: string;
  granted: boolean;
  source: string;
  ip: string;
  userAgent: string;
  textVersion: string;
}

async function ledger(email: string): Promise<LedgerRow[]> {
  const { rows } = await pool!.query(
    `select purpose, granted, source, ip, "userAgent", "textVersion"
       from public.customer_consents
      where "customerEmail" = $1
      order by id`,
    [email],
  );
  return rows as LedgerRow[];
}

async function insertMember(
  email: string,
  prefs: { marketing: boolean; newsletter: boolean },
  extra: { unsubToken?: string } = {},
): Promise<void> {
  await pool!.query(
    `insert into public.customers
       (id, email, name, "isActive", "emailVerified", "notificationPrefs",
        "marketingConsentAt", "unsubToken", "createdAt", "updatedAt")
     values ($1, $2, 'Üye', true, true, $3::jsonb, $4, $5, $6, $6)`,
    [
      `cst-${email}`,
      email,
      JSON.stringify({ orderUpdates: true, ...prefs }),
      prefs.marketing ? "2026-01-01T00:00:00.000Z" : "",
      extra.unsubToken ?? "",
      "2026-01-01T00:00:00.000Z",
    ],
  );
}

maybe("consent ledger against a real Postgres", () => {
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
      `delete from public.customer_consents where "customerEmail" like $1`,
      [`${PREFIX}%`],
    );
    // By id as well: a closed account's row keeps its id but not its address.
    await pool!.query(
      `delete from public.customers where email like $1 or id like $2`,
      [`${PREFIX}%`, `cst-${PREFIX}%`],
    );
    await pool!.query(
      `delete from public.newsletter_subscribers where email like $1`,
      [`${PREFIX}%`],
    );
  });

  it("site sign-up: one grant per box ticked, with the IP and text version", async () => {
    const { registerCustomer } = await import("@/lib/customer/store");
    const { COMMERCIAL_CONSENT_TEXT_VERSION } =
      await import("@/lib/customer/consent-ledger");
    const email = `${PREFIX}kayit@laffogato.net`;
    const res = await registerCustomer({
      email,
      name: "Kayıt",
      phone: "",
      password: "parola-uzun-1",
      acceptedTerms: true,
      marketing: true,
      newsletter: false,
    });
    expect(res.ok).toBe(true);
    expect(await ledger(email)).toEqual([
      {
        purpose: "marketing",
        granted: true,
        source: "site-signup",
        ip: "10.20.30.40",
        userAgent: "LAffogato/1.0 (iOS)",
        textVersion: COMMERCIAL_CONSENT_TEXT_VERSION,
      },
    ]);
  });

  it("account page and PATCH /me: only the purposes that changed", async () => {
    const { updateNotificationPrefs } = await import("@/lib/customer/store");
    const email = `${PREFIX}tercih@laffogato.net`;
    await insertMember(email, { marketing: true, newsletter: false });

    await updateNotificationPrefs(email, {
      orderUpdates: false,
      marketing: false,
      newsletter: true,
    });
    await updateNotificationPrefs(
      email,
      { orderUpdates: false, marketing: false, newsletter: true },
      { source: "app-account", ip: "10.1.1.1" },
    );
    await updateNotificationPrefs(
      email,
      { orderUpdates: true, marketing: false, newsletter: false },
      { source: "app-account", ip: "10.1.1.1" },
    );

    const rows = await ledger(email);
    // orderUpdates is not consent; an unchanged save writes nothing.
    expect(rows.map((r) => [r.purpose, r.granted, r.source])).toEqual([
      ["marketing", false, "site-account"],
      ["newsletter", true, "site-account"],
      ["newsletter", false, "app-account"],
    ]);
    expect(rows[0].textVersion).toBe("");
    expect(rows[2].ip).toBe("10.1.1.1");
  });

  it("admin edit: recorded as the panel's act, without an IP", async () => {
    const { adminUpdateCustomer } = await import("@/lib/customer/store");
    const email = `${PREFIX}panel@laffogato.net`;
    await insertMember(email, { marketing: true, newsletter: true });
    await adminUpdateCustomer(email, {
      name: "Üye",
      phone: "",
      birthday: "",
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: true,
      },
    });
    expect(await ledger(email)).toEqual([
      {
        purpose: "marketing",
        granted: false,
        source: "admin",
        ip: "",
        userAgent: "",
        textVersion: "",
      },
    ]);
  });

  it("member unsubscribe link: both purposes that were on are withdrawn", async () => {
    const { unsubscribeCustomerByToken } =
      await import("@/lib/customer/unsubscribe");
    const email = `${PREFIX}cikis@laffogato.net`;
    await insertMember(
      email,
      { marketing: true, newsletter: true },
      { unsubToken: "rizadefteri-token-1" },
    );
    expect(await unsubscribeCustomerByToken("rizadefteri-token-1")).toBe(
      email,
    );
    // A second click on a spent link changes nothing and records nothing.
    expect(await unsubscribeCustomerByToken("rizadefteri-token-1")).toBeNull();
    expect(
      (await ledger(email)).map((r) => [r.purpose, r.granted, r.source]),
    ).toEqual([
      ["marketing", false, "unsubscribe-link"],
      ["newsletter", false, "unsubscribe-link"],
    ]);
  });

  it("bulletin unsubscribe that also switches the member off", async () => {
    const { disableCustomerMarketingByEmail } =
      await import("@/lib/customer/unsubscribe");
    const email = `${PREFIX}bulten@laffogato.net`;
    await insertMember(email, { marketing: false, newsletter: true });
    expect(await disableCustomerMarketingByEmail(email)).toBe(true);
    expect(
      (await ledger(email)).map((r) => [r.purpose, r.granted, r.source]),
    ).toEqual([["newsletter", false, "newsletter-unsubscribe"]]);
  });

  it("first sign-in from the app: the consent from the sign-up metadata", async () => {
    const { ensureCustomerForSupabaseUser } =
      await import("@/lib/customer/supabase-bridge");
    const email = `${PREFIX}uygulama@laffogato.net`;
    const res = await ensureCustomerForSupabaseUser({
      id: "00000000-0000-4000-8000-00000000abcd",
      email,
      email_confirmed_at: "2026-09-23T09:00:00.000Z",
      user_metadata: {
        full_name: "Uygulama Üyesi",
        terms_accepted_at: "2026-09-23T08:59:00.000Z",
        marketing_consent_at: "2026-09-23T08:59:00.000Z",
      },
    });
    expect(res.ok).toBe(true);
    expect(await ledger(email)).toMatchObject([
      { purpose: "marketing", granted: true, source: "app-signup", ip: "" },
    ]);
  });

  it("account closure: every purpose that was on is withdrawn, under the real address", async () => {
    const { deleteMe } = await import("@/lib/mobile/me");
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = `${PREFIX}silme@laffogato.net`;
    await insertMember(email, { marketing: true, newsletter: false });
    const customer = await getCustomerByEmail(email);
    const res = await deleteMe(customer!);
    expect(res.ok).toBe(true);
    expect(await ledger(email)).toMatchObject([
      { purpose: "marketing", granted: false, source: "account-deletion" },
    ]);
  });

  it("refuses an update: the ledger is append-only", async () => {
    await pool!.query(
      `insert into public.customer_consents
         ("customerEmail", purpose, granted, source, "createdAt")
       values ($1, 'marketing', true, 'site-account', '2026-09-23T10:00:00.000Z')`,
      [`${PREFIX}sabit@laffogato.net`],
    );
    await expect(
      pool!.query(
        `update public.customer_consents set granted = false
          where "customerEmail" = $1`,
        [`${PREFIX}sabit@laffogato.net`],
      ),
    ).rejects.toThrow(/append-only/);
  });

  describe("retention: three years after the consent stopped being valid", () => {
    const OLD = `${PREFIX}eski@laffogato.net`;
    const STANDING = `${PREFIX}suruyor@laffogato.net`;
    // runRetention passes now minus three 366-day years; for 23 Sep 2026
    // that is late September 2023.
    const CUTOFF = "2023-09-22T00:00:00.000Z";

    async function append(
      email: string,
      granted: boolean,
      at: string,
    ): Promise<void> {
      await pool!.query(
        `insert into public.customer_consents
           ("customerEmail", purpose, granted, source, "createdAt")
         values ($1, 'marketing', $2, 'site-account', $3)`,
        [email, granted, at],
      );
    }

    async function remaining(email: string): Promise<boolean[]> {
      const { rows } = await pool!.query(
        `select granted from public.customer_consents
          where "customerEmail" = $1 order by id`,
        [email],
      );
      return rows.map((r) => r.granted as boolean);
    }

    it("takes a grant and its withdrawal once the withdrawal is past the cutoff, keeps a later grant", async () => {
      await append(OLD, true, "2019-01-01T00:00:00.000Z");
      await append(OLD, false, "2020-01-01T00:00:00.000Z");
      await append(OLD, true, "2025-01-01T00:00:00.000Z");
      // A consent that still stands is never in scope, however old.
      await append(STANDING, true, "2015-01-01T00:00:00.000Z");

      const counted = await pool!.query(
        `select public.customer_consents_retention($1, false) as n`,
        [CUTOFF],
      );
      expect(counted.rows[0].n).toBeGreaterThanOrEqual(2);
      expect(await remaining(OLD)).toEqual([true, false, true]);

      await pool!.query(
        `select public.customer_consents_retention($1, true) as n`,
        [CUTOFF],
      );
      expect(await remaining(OLD)).toEqual([true]);
      expect(await remaining(STANDING)).toEqual([true]);
    });

    it("keeps a withdrawal younger than the cutoff, and what it ended", async () => {
      const RECENT = `${PREFIX}yeni@laffogato.net`;
      await append(RECENT, true, "2019-01-01T00:00:00.000Z");
      await append(RECENT, false, "2026-01-01T00:00:00.000Z");
      await pool!.query(
        `select public.customer_consents_retention($1, true)`,
        [CUTOFF],
      );
      expect(await remaining(RECENT)).toEqual([true, false]);
    });
  });
});
