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
import { addIstanbulBusinessDays, iysDueAt } from "@/lib/iys/iys-core";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The İYS outbox and the send gate against a real Postgres
 * (db/migrations/20261022180000_iys_consent_sync.sql and
 * 20261022180100_iys_send_gate.sql), through the app's own store functions
 * with `getDb()` pointed at TEST_DATABASE_URL:
 *
 *   - the SQL day count agrees with iys-core's;
 *   - reconcile turns the consent stores into ONAY and RET events, never
 *     ONAY over ONAY or RET over RET, supersedes what need not be uploaded,
 *     flags consents older than the launch as legacy;
 *   - the campaign audience (count, enqueue, claim) and the birthday mail
 *     flag name only addresses İYS holds ONAY for, and drop one whose RET
 *     is in a downloaded file;
 *   - an import of İYS's list applies new refusals through the consent
 *     functions (ledger source `iys`) and records the check.
 *
 * Skipped without a database:
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

const P = "iysdeneme-";
const LAUNCH = "2026-10-01T00:00:00.000Z";

const q = async <T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> => (await pool!.query(text, params)).rows as T[];

interface EventRow {
  id: string;
  email: string;
  status: string;
  source: string;
  consentDate: string;
  dueAt: string;
  state: string;
  legacy: boolean;
  exportId: string;
}

async function events(email: string): Promise<EventRow[]> {
  return q<EventRow>(
    `select id::text, email, status, source, "consentDate", "dueAt", state,
            legacy, "exportId"
       from public.iys_events where email = $1 order by id`,
    [email],
  );
}

async function recipient(email: string) {
  return (
    await q<{
      desiredStatus: string;
      desiredAt: string;
      desiredSource: string;
      iysStatus: string;
    }>(
      `select "desiredStatus", "desiredAt", "desiredSource", "iysStatus"
         from public.iys_recipients where email = $1`,
      [email],
    )
  )[0];
}

async function member(
  email: string,
  over: {
    marketing?: boolean;
    newsletter?: boolean;
    consentAt?: string;
    verifiedAt?: string;
    verified?: boolean;
    token?: string;
    birthday?: string;
  } = {},
): Promise<void> {
  const marketing = over.marketing ?? true;
  await q(
    `insert into public.customers
       (id, email, name, "isActive", "emailVerified", "verifiedAt",
        "notificationPrefs", "marketingConsentAt", "unsubToken", birthday,
        "createdAt", "updatedAt")
     values ($1, $2, 'Üye', true, $3, $4, $5::jsonb, $6, $7, $8, $9, $9)`,
    [
      `cst-${email}`,
      email,
      over.verified ?? true,
      over.verifiedAt ?? "",
      JSON.stringify({
        orderUpdates: true,
        marketing,
        newsletter: over.newsletter ?? false,
      }),
      marketing ? (over.consentAt ?? "2026-10-20T07:00:00.000Z") : "",
      over.token ?? "",
      over.birthday ?? "",
      "2026-09-01T00:00:00.000Z",
    ],
  );
}

async function ledgerGrant(
  email: string,
  source: string,
  at: string,
  purpose = "marketing",
): Promise<void> {
  await q(
    `insert into public.customer_consents
       ("customerEmail", purpose, granted, source, ip, "userAgent",
        "textVersion", "createdAt")
     values ($1, $2, true, $3, '', '', 'v', $4)`,
    [email, purpose, source, at],
  );
}

async function subscriber(
  email: string,
  over: { source?: string; consentAt?: string; token?: string } = {},
): Promise<void> {
  await q(
    `insert into public.newsletter_subscribers
       (id, email, name, source, "isActive", "createdAt", "consentAt",
        "unsubToken")
     values ($1, $2, 'Abone', $3, true, $4, $4, $5)`,
    [
      `nws-${email}`,
      email,
      over.source ?? "footer",
      over.consentAt ?? "2026-10-20T08:00:00.000Z",
      over.token ?? `tok-${email}`,
    ],
  );
}

async function audience(aud = "both", pref = "marketing"): Promise<string[]> {
  return (
    await q<{ email: string }>(
      `select email from public.campaign_email_audience($1, $2)
        where email like $3 order by email`,
      [aud, pref, `${P}%`],
    )
  ).map((r) => r.email);
}

async function registerAll(): Promise<void> {
  const { exportIysEvents, settleIysExport } = await import("@/lib/iys/store");
  const { exportId } = await exportIysEvents();
  await settleIysExport(exportId, "patron@laffogato.net");
}

maybe("İYS outbox and send gate against a real Postgres", () => {
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
    // Other suites leave members and subscribers behind; their events are
    // not this suite's, and a file it downloads must hold only its own.
    await q(`delete from public.iys_events`);
    await q(`delete from public.iys_recipients`);
    await q(
      `delete from public.campaign_email_sends where "campaignId" like $1`,
      [`${P}%`],
    );
    await q(`delete from public.campaign_emails where id like $1`, [`${P}%`]);
    await q(
      `delete from public.customer_consents where "customerEmail" like $1`,
      [`${P}%`],
    );
    await q(`delete from public.customers where email like $1 or id like $2`, [
      `${P}%`,
      `cst-${P}%`,
    ]);
    await q(`delete from public.newsletter_subscribers where email like $1`, [
      `${P}%`,
    ]);
    await q(`delete from public.email_suppressions where email like $1`, [
      `${P}%`,
    ]);
    await q(
      `insert into public.iys_state (id, "launchedAt") values ('iys', $1)
       on conflict (id) do update
          set "launchedAt" = $1, "lastCheckAt" = '', "lastCheckBy" = '',
              "lastCheckKind" = '', "lastImport" = '{}'::jsonb`,
      [LAUNCH],
    );
    // Everyone else's consents (other suites' rows) are out of the way: a
    // reconcile here only needs to be right about this suite's addresses.
  });

  it("counts business days in SQL exactly as iys-core does", async () => {
    const instants = [
      "2026-10-19T11:00:00.000Z", // Monday 14:00
      "2026-10-23T17:00:00.000Z", // Friday 20:00
      "2026-10-23T22:30:00.000Z", // Saturday 01:30 in Tuzla, Friday in UTC
      "2026-10-24T07:00:00.000Z", // Saturday 10:00
      "2026-10-25T23:00:00.000Z", // Monday 02:00 in Tuzla, Sunday in UTC
      "2026-12-31T21:30:00.000Z", // New Year's Day 00:30, a Friday
    ];
    for (const at of instants) {
      for (const days of [1, 3]) {
        const [row] = await q<{ due: string }>(
          `select public.iys_add_business_days($1, $2) as due`,
          [at, days],
        );
        expect(row.due, `${at} + ${days}`).toBe(
          addIstanbulBusinessDays(at, days),
        );
      }
    }
    const [bad] = await q<{ due: string }>(
      `select public.iys_add_business_days('dün', 3) as due`,
    );
    expect(bad.due).toBe("");
  });

  it("an active consent becomes one pending ONAY, with the channel and the deadline", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const app = `${P}uygulama@laffogato.net`;
    const web = `${P}abone@laffogato.net`;
    await member(app, {
      consentAt: "2026-10-20T07:00:00.000Z",
      verifiedAt: "2026-10-20T09:00:00.000Z",
    });
    await ledgerGrant(app, "app-signup", "2026-10-20T07:00:00.000Z");
    await subscriber(web);

    await reconcileIys(new Date("2026-10-21T08:00:00.000Z"));
    // A second run adds nothing: never ONAY over an open ONAY.
    await reconcileIys(new Date("2026-10-21T09:00:00.000Z"));

    const [onApp] = await events(app);
    expect(await events(app)).toHaveLength(1);
    expect(onApp).toMatchObject({
      status: "ONAY",
      source: "HS_MOBIL",
      // The later of the consent and the e-mail verification.
      consentDate: "2026-10-20T09:00:00.000Z",
      dueAt: iysDueAt("2026-10-20T09:00:00.000Z"),
      state: "pending",
      legacy: false,
    });
    expect(await events(web)).toMatchObject([
      { status: "ONAY", source: "HS_WEB", state: "pending" },
    ]);
    expect(await recipient(app)).toMatchObject({
      desiredStatus: "ONAY",
      iysStatus: "",
    });
  });

  it("registers nothing for an unverified member, a placeholder or an open deletion request", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    await member(`${P}dogrulanmamis@laffogato.net`, { verified: false });
    await member(`${P}kapali@anon.local`);
    await member(`${P}silinecek@laffogato.net`);
    await q(
      `update public.customers set "deletionRequestedAt" = $1 where email = $2`,
      ["2026-10-20T10:00:00.000Z", `${P}silinecek@laffogato.net`],
    );
    await reconcileIys(new Date("2026-10-21T08:00:00.000Z"));
    const rows = await q(
      `select email from public.iys_events where email like $1`,
      [`${P}%`],
    );
    expect(rows).toEqual([]);
  });

  it("flags a consent older than the launch as legacy, overdue from the start", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const old = `${P}eski@laffogato.net`;
    await member(old, { consentAt: "2026-09-02T10:00:00.000Z" });
    await reconcileIys();
    const [e] = await events(old);
    expect(e).toMatchObject({ status: "ONAY", legacy: true, source: "HS_WEB" });
    expect(e.dueAt < new Date().toISOString()).toBe(true);
  });

  it("a consent withdrawn before the upload is superseded, and no RET is made", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const { unsubscribeCustomerByToken } =
      await import("@/lib/customer/unsubscribe");
    const email = `${P}vazgecen@laffogato.net`;
    await member(email, { token: "tok-vazgecen" });
    await reconcileIys();
    expect(await unsubscribeCustomerByToken("tok-vazgecen")).toBe(email);
    await reconcileIys();
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "superseded"],
    ]);
    expect(await recipient(email)).toMatchObject({ desiredStatus: "NONE" });
  });

  it("only İYS-registered addresses are in the audience, its count and the birthday mail flag", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const email = `${P}kayitli@laffogato.net`;
    await member(email, { token: "tok-kayitli", birthday: "1990-10-22" });
    await reconcileIys();

    const count = async () =>
      (
        await q<{ n: number }>(
          `select count(*)::int as n from public.campaign_email_audience('marketing', 'marketing') where email like $1`,
          [`${P}%`],
        )
      )[0].n;
    const greeting = async () =>
      (
        await q<{ marketing: boolean }>(
          `select marketing from public.birthday_greeting_audience('["10-22"]'::jsonb) where email = $1`,
          [email],
        )
      )[0]?.marketing;

    // Consent here, nothing in İYS yet: out.
    expect(await audience()).toEqual([]);
    expect(await count()).toBe(0);
    expect(await greeting()).toBe(false);

    // Downloaded but not confirmed: still out.
    const { exportIysEvents, settleIysExport } =
      await import("@/lib/iys/store");
    const { exportId } = await exportIysEvents();
    expect(await audience()).toEqual([]);

    // Confirmed: in. (The file also holds whatever other suites left
    // consenting in this database, so at least one.)
    expect(
      await settleIysExport(exportId, "patron@laffogato.net"),
    ).toBeGreaterThanOrEqual(1);
    expect(await settleIysExport(exportId, "patron@laffogato.net")).toBe(0);
    expect(await audience()).toEqual([email]);
    expect(await count()).toBe(1);
    expect(await greeting()).toBe(true);
    expect((await events(email))[0].state).toBe("registered");
  });

  it("a withdrawal after registration becomes one RET, dated and sourced from the ledger", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const { unsubscribeCustomerByToken } =
      await import("@/lib/customer/unsubscribe");
    const email = `${P}cikan@laffogato.net`;
    await member(email, { token: "tok-cikan" });
    await reconcileIys();
    await registerAll();
    expect(await audience()).toEqual([email]);

    await unsubscribeCustomerByToken("tok-cikan");
    // Out at once, on our own record, before İYS hears of it.
    expect(await audience()).toEqual([]);
    await reconcileIys();
    await reconcileIys();

    const withdrawal = (
      await q<{ createdAt: string }>(
        `select "createdAt" from public.customer_consents
          where "customerEmail" = $1 and not granted order by id desc limit 1`,
        [email],
      )
    )[0].createdAt;
    const rets = (await events(email)).filter((e) => e.status === "RET");
    // Never RET over an open RET.
    expect(rets).toHaveLength(1);
    expect(rets[0]).toMatchObject({
      source: "HS_EPOSTA",
      consentDate: withdrawal,
      dueAt: iysDueAt(withdrawal),
      state: "pending",
    });

    await registerAll();
    expect(await recipient(email)).toMatchObject({ iysStatus: "RET" });
    // And never RET over a registered RET.
    await reconcileIys();
    expect(
      (await events(email)).filter((e) => e.status === "RET"),
    ).toHaveLength(1);
  });

  it("consent given again: the pending RET is superseded; after a registered RET a new, later ONAY", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const { updateNotificationPrefs } = await import("@/lib/customer/store");
    const email = `${P}geri-donen@laffogato.net`;
    await member(email);
    await reconcileIys();
    await registerAll();

    const off = { orderUpdates: true, marketing: false, newsletter: false };
    const on = { orderUpdates: true, marketing: true, newsletter: false };
    await updateNotificationPrefs(email, off);
    await reconcileIys();
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "registered"],
      ["RET", "pending"],
    ]);

    await updateNotificationPrefs(email, on);
    await reconcileIys();
    // İYS still holds the first ONAY: nothing to upload, and mailable.
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "registered"],
      ["RET", "superseded"],
    ]);
    expect(await audience()).toEqual([email]);

    await updateNotificationPrefs(email, off);
    await reconcileIys();
    // A RET in a downloaded file: whatever happens next, no mail until İYS
    // confirms.
    const { exportIysEvents, settleIysExport } =
      await import("@/lib/iys/store");
    const { exportId } = await exportIysEvents();
    await updateNotificationPrefs(email, on);
    await reconcileIys();
    expect(await audience()).toEqual([]);
    // No ONAY while that RET may be on its way to İYS.
    expect(
      (await events(email)).filter(
        (e) => e.status === "ONAY" && e.state === "pending",
      ),
    ).toEqual([]);

    await settleIysExport(exportId, "patron@laffogato.net");
    await reconcileIys();
    const all = await events(email);
    const ret = all.find(
      (e) => e.status === "RET" && e.state === "registered",
    )!;
    const fresh = all.find(
      (e) => e.status === "ONAY" && e.state === "pending",
    )!;
    expect(fresh).toBeDefined();
    expect(fresh.consentDate > ret.consentDate).toBe(true);
    expect(fresh.source).toBe("HS_WEB");
  });

  it("an ONAY İYS refused keeps the address out until the person consents again", async () => {
    const { reconcileIys, rejectIysEvent } = await import("@/lib/iys/store");
    const email = `${P}reddedilen@laffogato.net`;
    await member(email, { consentAt: "2026-09-02T10:00:00.000Z" });
    await reconcileIys();
    const [e] = await events(email);
    expect(
      (await rejectIysEvent(e.id, "H467", "patron@laffogato.net"))?.state,
    ).toBe("rejected");
    await reconcileIys();
    expect(await events(email)).toHaveLength(1);
    expect(await audience()).toEqual([]);

    await q(
      `update public.customers set "marketingConsentAt" = $1 where email = $2`,
      ["2026-10-21T10:00:00.000Z", email],
    );
    await reconcileIys();
    expect(
      (await events(email)).map((x) => [x.status, x.state, x.legacy]),
    ).toEqual([
      ["ONAY", "rejected", true],
      ["ONAY", "pending", false],
    ]);
  });

  it("the claim re-checks İYS before every batch: a row whose address İYS no longer holds is skipped", async () => {
    const { reconcileIys } = await import("@/lib/iys/store");
    const a = `${P}a@laffogato.net`;
    const b = `${P}b@laffogato.net`;
    await member(a);
    await member(b);
    await reconcileIys();
    await registerAll();
    const id = `${P}kampanya`;
    await q(
      `insert into public.campaign_emails (id, template, status, audience, "createdAt")
       values ($1, 'kampanya-duyuru', 'draft', 'marketing', $2)`,
      [id, "2026-10-22T08:00:00.000Z"],
    );
    await q(
      `select public.campaign_email_enqueue($1, 'marketing', 'marketing', $2, 'https://laffogato.net/api/bulten/cikis?token=')`,
      [id, "2026-10-22T08:00:00.000Z"],
    );
    // Other suites' leftovers may be in the audience too; only ours stay.
    await q(
      `delete from public.campaign_email_sends where "campaignId" = $1 and email not like $2`,
      [id, `${P}%`],
    );
    const queued = await q<{ email: string }>(
      `select email from public.campaign_email_sends where "campaignId" = $1 and email like $2 order by email`,
      [id, `${P}%`],
    );
    expect(queued.map((r) => r.email)).toEqual([a, b]);

    // b's consent is still on here, but a RET for b now sits in a
    // downloaded file: İYS may hold it by the time the batch goes.
    await q(
      `insert into public.iys_events
         (email, status, source, "consentDate", "dueAt", state, "exportId",
          "createdAt")
       values ($1, 'RET', 'HS_WEB', $2, $2, 'exported',
               'iys-20261022-1100-0000', $2)`,
      [b, "2026-10-22T08:00:30.000Z"],
    );
    await q(`select public.campaign_email_claim($1, $2, $3, $4)`, [
      id,
      "2026-10-22T07:45:00.000Z",
      "2026-10-21T10:00:00.000Z",
      "2026-10-22T08:01:00.000Z",
    ]);
    const rows = await q<{ email: string; status: string; error: string }>(
      `select email, status, error from public.campaign_email_sends
        where "campaignId" = $1 and email like $2 order by email`,
      [id, `${P}%`],
    );
    expect(rows).toEqual([
      { email: a, status: "sending", error: "" },
      {
        email: b,
        status: "skipped",
        error: "onay geri çekildi ya da kitle dışına çıktı",
      },
    ]);
  });

  it("an import applies a new İYS refusal through the consent functions and records the check", async () => {
    const { reconcileIys, importIysConsentList, getIysState } =
      await import("@/lib/iys/store");
    const { iysSendGate } = await import("@/lib/iys/gate");
    const refused = `${P}iysten-ret@laffogato.net`;
    const pending = `${P}bekleyen@laffogato.net`;
    const stranger = `${P}tanimadik@laffogato.net`;
    await member(refused, { newsletter: true });
    await subscriber(refused, { source: "account" });
    await reconcileIys();
    await registerAll();
    // pending's ONAY is in a file nobody confirmed yet.
    await subscriber(pending, { consentAt: "2026-10-21T08:00:00.000Z" });
    await reconcileIys();
    const { exportIysEvents } = await import("@/lib/iys/store");
    await exportIysEvents();
    expect((await events(pending)).map((e) => e.state)).toEqual(["exported"]);

    expect((await iysSendGate()).fresh).toBe(false);
    const result = await importIysConsentList(
      [
        { line: 2, email: refused, status: "RET" },
        { line: 3, email: pending, status: "ONAY" },
        { line: 4, email: stranger, status: "ONAY" },
      ],
      { by: "patron@laffogato.net", skipped: 1, fileName: "iys.csv" },
    );
    expect(result).toMatchObject({
      onayListed: 2,
      onayIgnored: 1,
      retListed: 1,
      refusalsApplied: 1,
      registered: 1,
    });

    // The refusal, applied here like an unsubscribe: preferences off, a
    // ledger row with no IP of the operator's, the bulletin row off.
    const [c] = await q<{
      notificationPrefs: Record<string, boolean>;
      marketingConsentAt: string;
    }>(
      `select "notificationPrefs", "marketingConsentAt" from public.customers where email = $1`,
      [refused],
    );
    expect(c.notificationPrefs).toMatchObject({
      marketing: false,
      newsletter: false,
    });
    expect(c.marketingConsentAt).toBe("");
    expect(
      await q(
        `select purpose, granted, source, ip, "userAgent" from public.customer_consents
          where "customerEmail" = $1 and source = 'iys' order by purpose`,
        [refused],
      ),
    ).toEqual([
      {
        purpose: "marketing",
        granted: false,
        source: "iys",
        ip: "",
        userAgent: "",
      },
      {
        purpose: "newsletter",
        granted: false,
        source: "iys",
        ip: "",
        userAgent: "",
      },
    ]);
    expect(
      await q(
        `select "isActive" from public.newsletter_subscribers where email = $1`,
        [refused],
      ),
    ).toEqual([{ isActive: false }]);
    expect(await recipient(refused)).toMatchObject({ iysStatus: "RET" });
    // İYS already has it: no RET to upload.
    await reconcileIys();
    expect((await events(refused)).filter((e) => e.status === "RET")).toEqual(
      [],
    );

    // The downloaded ONAY İYS lists is registered; a stranger gets no row.
    expect(await recipient(pending)).toMatchObject({ iysStatus: "ONAY" });
    expect(await recipient(stranger)).toBeUndefined();

    // And the check is recorded: commercial mail may go.
    const state = await getIysState();
    expect(state).toMatchObject({
      lastCheckBy: "patron@laffogato.net",
      lastCheckKind: "import",
    });
    expect(state.lastImport).toMatchObject({ refusalsApplied: 1, skipped: 1 });
    expect((await iysSendGate()).fresh).toBe(true);
    expect(await audience()).toEqual([pending]);
  });

  it("a RET we already knew of does not wipe a consent given after it", async () => {
    const { reconcileIys, importIysConsentList } =
      await import("@/lib/iys/store");
    const email = `${P}yeniden@laffogato.net`;
    await member(email);
    await q(
      `insert into public.iys_recipients
         (email, "desiredStatus", "iysStatus", "iysConsentDate", "createdAt", "updatedAt")
       values ($1, 'NONE', 'RET', '2026-10-01T10:00:00.000Z', $2, $2)`,
      [email, "2026-10-01T10:00:00.000Z"],
    );
    await reconcileIys();
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "pending"],
    ]);
    const result = await importIysConsentList(
      [{ line: 1, email, status: "RET" }],
      { by: "patron@laffogato.net", skipped: 0, fileName: "iys.csv" },
    );
    expect(result.refusalsApplied).toBe(0);
    const [c] = await q<{ marketingConsentAt: string }>(
      `select "marketingConsentAt" from public.customers where email = $1`,
      [email],
    );
    expect(c.marketingConsentAt).not.toBe("");
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "pending"],
    ]);
  });

  // Post-merge review (22 Ekim 2026, 20261022200000): an old İYS list that
  // still shows ONAY must not undo a RET we registered, or a later consent
  // is mailed while İYS holds RET without ever being uploaded.
  it("an old list showing ONAY does not undo a RET we registered", async () => {
    const { reconcileIys, importIysConsentList } =
      await import("@/lib/iys/store");
    const { updateNotificationPrefs } = await import("@/lib/customer/store");
    const email = `${P}eski-liste@laffogato.net`;
    const off = { orderUpdates: true, marketing: false, newsletter: false };
    const on = { orderUpdates: true, marketing: true, newsletter: false };
    await member(email);
    await reconcileIys();
    await registerAll();
    await updateNotificationPrefs(email, off);
    await reconcileIys();
    await registerAll();
    expect(await recipient(email)).toMatchObject({ iysStatus: "RET" });

    await importIysConsentList([{ line: 1, email, status: "ONAY" }], {
      by: "patron@laffogato.net",
      skipped: 0,
      fileName: "eski.csv",
    });
    expect(await recipient(email)).toMatchObject({ iysStatus: "RET" });

    await updateNotificationPrefs(email, on);
    await reconcileIys();
    // The new consent is uploaded, and nothing goes out before İYS has it.
    expect(
      (await events(email)).filter(
        (e) => e.status === "ONAY" && e.state === "pending",
      ),
    ).toHaveLength(1);
    expect(await audience()).toEqual([]);
  });

  // İYS refuses a list with the same address twice (H194): a download holds
  // the oldest open event of each address, the next waits for the next file.
  it("a download holds one event per address; the later one waits for the next file", async () => {
    const { reconcileIys, exportIysEvents, settleIysExport } =
      await import("@/lib/iys/store");
    const { updateNotificationPrefs } = await import("@/lib/customer/store");
    const email = `${P}tek-satir@laffogato.net`;
    // Other suites leave consenting members in the shared database; a file
    // may carry their rows too, so only this address is read.
    const mine = (file: { events: { email: string; status: string }[] }) =>
      file.events
        .filter((e) => e.email === email)
        .map((e) => [e.email, e.status]);
    await member(email);
    await reconcileIys();
    const first = await exportIysEvents();
    expect(mine(first)).toEqual([[email, "ONAY"]]);

    // Withdrawn before the first file was confirmed: a RET is due as well.
    await updateNotificationPrefs(email, {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    });
    await reconcileIys();
    const second = await exportIysEvents();
    expect(mine(second)).toEqual([[email, "ONAY"]]);
    expect((await events(email)).map((e) => [e.status, e.state])).toEqual([
      ["ONAY", "exported"],
      ["RET", "pending"],
    ]);

    await settleIysExport(second.exportId, "patron@laffogato.net");
    const third = await exportIysEvents();
    expect(mine(third)).toEqual([[email, "RET"]]);
  });

  it("a RET İYS refused is made again while İYS holds the ONAY", async () => {
    const { reconcileIys, exportIysEvents, rejectIysEvent } =
      await import("@/lib/iys/store");
    const { updateNotificationPrefs } = await import("@/lib/customer/store");
    const email = `${P}ret-reddi@laffogato.net`;
    await member(email);
    await reconcileIys();
    await registerAll();
    await updateNotificationPrefs(email, {
      orderUpdates: true,
      marketing: false,
      newsletter: false,
    });
    await reconcileIys();
    const { events: sent } = await exportIysEvents();
    const ret = sent.find((e) => e.email === email && e.status === "RET")!;
    await rejectIysEvent(ret.id, "H194", "patron@laffogato.net");
    expect(await recipient(email)).toMatchObject({ iysStatus: "ONAY" });

    await reconcileIys();
    expect(
      (await events(email))
        .filter((e) => e.status === "RET")
        .map((e) => e.state),
    ).toEqual(["rejected", "pending"]);
  });

  it("retention removes an address three years after its consent ended, and nothing that may still matter", async () => {
    const cutoff = "2025-01-01T00:00:00.000Z";
    const recip = (
      email: string,
      desired: string,
      desiredAt: string,
      iys: string,
    ) =>
      q(
        `insert into public.iys_recipients
           (email, "desiredStatus", "desiredAt", "iysStatus", "createdAt",
            "updatedAt")
         values ($1, $2, $3, $4, $3, $3)`,
        [email, desired, desiredAt, iys],
      );
    const event = (
      email: string,
      status: string,
      state: string,
      createdAt: string,
      settledAt = "",
    ) =>
      q(
        `insert into public.iys_events
           (email, status, source, "consentDate", state, "createdAt",
            "settledAt")
         values ($1, $2, 'HS_WEB', $3, $4, $3, $5)`,
        [email, status, createdAt, state, settledAt],
      );
    const old = `${P}eski@laffogato.net`;
    await recip(old, "NONE", "2022-01-01T00:00:00.000Z", "RET");
    await event(
      old,
      "ONAY",
      "registered",
      "2021-01-01T00:00:00.000Z",
      "2021-01-02T00:00:00.000Z",
    );
    await event(
      old,
      "RET",
      "registered",
      "2022-01-01T00:00:00.000Z",
      "2022-01-03T00:00:00.000Z",
    );
    // İYS still holds the ONAY: the refusal is not reported yet.
    const unreported = `${P}onayda@laffogato.net`;
    await recip(unreported, "NONE", "2022-01-01T00:00:00.000Z", "ONAY");
    await event(
      unreported,
      "RET",
      "rejected",
      "2022-01-01T00:00:00.000Z",
      "2022-01-03T00:00:00.000Z",
    );
    // Something about it is newer than the cutoff.
    const settledLate = `${P}gec@laffogato.net`;
    await recip(settledLate, "NONE", "2022-01-01T00:00:00.000Z", "RET");
    await event(
      settledLate,
      "RET",
      "registered",
      "2022-01-01T00:00:00.000Z",
      "2025-06-01T00:00:00.000Z",
    );
    // Still consents, however old.
    const consents = `${P}rizali@laffogato.net`;
    await recip(consents, "ONAY", "2020-01-01T00:00:00.000Z", "ONAY");
    await event(
      consents,
      "ONAY",
      "registered",
      "2020-01-01T00:00:00.000Z",
      "2020-01-02T00:00:00.000Z",
    );
    // A refusal still on its way to İYS.
    const open = `${P}acik@laffogato.net`;
    await recip(open, "NONE", "2022-01-01T00:00:00.000Z", "");
    await event(open, "RET", "pending", "2022-01-01T00:00:00.000Z");
    // Ended recently.
    const recent = `${P}yeni@laffogato.net`;
    await recip(recent, "NONE", "2026-01-01T00:00:00.000Z", "RET");

    const run = async (apply: boolean) =>
      Number(
        (
          await q<{ n: number }>(`select public.iys_retention($1, $2) as n`, [
            cutoff,
            apply,
          ])
        )[0]!.n,
      );
    // The two events and the address.
    expect(await run(false)).toBe(3);
    expect(await recipient(old)).toBeDefined();
    expect(await run(true)).toBe(3);
    expect(await recipient(old)).toBeUndefined();
    expect(await events(old)).toEqual([]);
    for (const kept of [unreported, settledLate, consents, open, recent]) {
      expect(await recipient(kept), kept).toBeDefined();
    }
    expect(await events(unreported)).toHaveLength(1);
    expect(await run(true)).toBe(0);
  });

  it("the attestation makes the check fresh for three business days", async () => {
    const { attestIysCheck } = await import("@/lib/iys/store");
    const { iysSendGate } = await import("@/lib/iys/gate");
    const friday = new Date("2026-10-23T15:00:00.000Z");
    await attestIysCheck("mudur@laffogato.net", friday);
    expect(
      (await iysSendGate(new Date("2026-10-28T14:59:00.000Z"))).fresh,
    ).toBe(true);
    const stale = await iysSendGate(new Date("2026-10-28T15:00:00.000Z"));
    expect(stale.fresh).toBe(false);
    expect(stale.message).toMatch(/İYS ret kontrolü güncel değil/);
  });
});
