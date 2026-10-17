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

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * A barista stamping from the app, against a real Postgres: the grant and the
 * revoke on /admin/kullanicilar (`staff_members`,
 * db/migrations/20261015050817_staff_members.sql), `POST /staff/stamp`
 * running the panel till's own `redeemCounterToken` over real
 * `counter_tokens` and `loyalty_stamps` rows, and `/me.staff.till`.
 * docs/API-MOBILE.md §21. Skipped without TEST_DATABASE_URL, like the other
 * tests/db-integration*.test.ts suites.
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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// The panel session: the gate's own behaviour is tests/admin-staff-actions.
const ADMIN = "patron@laffogato.net";
vi.mock("@/lib/admin/auth", () => ({
  requireRole: async () => ({ email: ADMIN }),
  getAdminSession: async () => ({ email: ADMIN }),
}));

// The bearer resolves to a real `customers` row, read the way
// requireMobileCustomer reads it; Supabase itself is not what is under test.
vi.mock("@/lib/mobile/auth", () => ({
  requireMobileCustomer: async (request: Request) => {
    const { getCustomerByEmail } = await import("@/lib/customer/store");
    const email = request.headers.get("x-test-member") ?? "";
    const customer = await getCustomerByEmail(email);
    if (!customer) throw new Error(`no test member ${email}`);
    return { ok: true, customer, user: {}, supabaseUserId: "sb-test" };
  },
}));

const RUN = Date.now().toString(36);
const BARISTA = `barista-${RUN}@laffogato.net`;
const MEMBER = `uye-${RUN}@laffogato.net`;
const CLOSED = `kapali-${RUN}@laffogato.net`;
const STRANGER = `yok-${RUN}@laffogato.net`;

async function addCustomer(
  email: string,
  over: { isActive?: boolean; emailVerified?: boolean; name?: string } = {},
): Promise<void> {
  await pool!.query(
    `insert into public.customers (id, email, name, "passwordHash",
       "emailVerified", "isActive", "createdAt", "updatedAt")
     values ($1, $2, $3, '', $4, $5, $6, $6)
     on conflict do nothing`,
    [
      `cst-${email}`,
      email,
      over.name ?? "Üye",
      over.emailVerified ?? true,
      over.isActive ?? true,
      new Date().toISOString(),
    ],
  );
}

function form(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}

function stampRequest(as: string, body: unknown): Request {
  return new Request("https://laffogato.net/api/mobile/v1/staff/stamp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-member": as,
      "x-forwarded-for": "10.1.2.3",
    },
    body: JSON.stringify(body),
  });
}

async function stampsOf(email: string) {
  const { rows } = await pool!.query(
    `select actor, note, source from public.loyalty_stamps
      where "customerEmail" = $1 order by id`,
    [email],
  );
  return rows as { actor: string; note: string; source: string }[];
}

maybe("barista stamping from the app, in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let actions: typeof import("@/app/admin/kullanicilar/actions");
  let POST: typeof import("@/app/api/mobile/v1/staff/stamp/route").POST;
  let GET_ME: typeof import("@/app/api/mobile/v1/me/route").GET;
  let issueCounterToken: typeof import("@/lib/mobile/counter").issueCounterToken;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    await addCustomer(BARISTA, { name: "Barista Bora" });
    await addCustomer(MEMBER, { name: "Eda" });
    await addCustomer(CLOSED, { isActive: false });
    actions = await import("@/app/admin/kullanicilar/actions");
    ({ POST } = await import("@/app/api/mobile/v1/staff/stamp/route"));
    ({ GET: GET_ME } = await import("@/app/api/mobile/v1/me/route"));
    ({ issueCounterToken } = await import("@/lib/mobile/counter"));
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    const like = `%-${RUN}@laffogato.net`;
    await pool?.query(`delete from public.staff_members where email like $1`, [
      like,
    ]);
    await pool?.query(
      `delete from public.counter_tokens where "customerEmail" like $1`,
      [like],
    );
    await pool?.query(
      `delete from public.loyalty_stamps where "customerEmail" like $1`,
      [like],
    );
    await pool?.query(`delete from public.auth_attempts where key like $1`, [
      `%${RUN}%`,
    ]);
    await pool?.query(`delete from public.customers where email like $1`, [
      like,
    ]);
    await pool?.end();
    pool = null;
    holder.pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query(`delete from public.staff_members where email = $1`, [
      BARISTA,
    ]);
  });

  describe("granting and revoking on /admin/kullanicilar", () => {
    it("refuses an address that has no member account", async () => {
      const state = await actions.grantBaristaAction({}, form(STRANGER));
      expect(state.error).toMatch(/üye hesabı yok/);
      const { rows } = await pool!.query(
        `select 1 from public.staff_members where email = $1`,
        [STRANGER],
      );
      expect(rows).toHaveLength(0);
    });

    it("refuses a closed member account", async () => {
      const state = await actions.grantBaristaAction({}, form(CLOSED));
      expect(state.error).toMatch(/kapalı/);
    });

    it("grants an open member, recording who granted it", async () => {
      const state = await actions.grantBaristaAction(
        {},
        form(`  ${BARISTA.toUpperCase()} `),
      );
      expect(state.error).toBeUndefined();
      const { rows } = await pool!.query(
        `select role, "isActive", "grantedBy" from public.staff_members where email = $1`,
        [BARISTA],
      );
      expect(rows).toEqual([
        { role: "barista", isActive: true, grantedBy: ADMIN },
      ]);
      const again = await actions.grantBaristaAction({}, form(BARISTA));
      expect(again.error).toMatch(/zaten/);
    });

    it("revokes, keeps the row, and re-grants it later", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      const revoked = await actions.revokeBaristaAction(null, form(BARISTA));
      expect(revoked.ok).toBe(true);
      const { rows } = await pool!.query(
        `select "isActive" from public.staff_members where email = $1`,
        [BARISTA],
      );
      expect(rows).toEqual([{ isActive: false }]);

      const twice = await actions.revokeBaristaAction(null, form(BARISTA));
      expect(twice).toMatchObject({
        ok: false,
        error: expect.stringMatching(/açık bir barista yetkisi yok/),
      });

      const back = await actions.grantBaristaAction({}, form(BARISTA));
      expect(back.error).toBeUndefined();
    });
  });

  describe("POST /staff/stamp", () => {
    it("answers 403 not_staff without a grant, and burns nothing", async () => {
      const issued = await issueCounterToken(MEMBER);
      if (!issued.ok) throw new Error("rate limited");
      const res = await POST(
        stampRequest(BARISTA, { kind: "token", value: issued.issue.token }),
      );
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe("not_staff");
      const { rows } = await pool!.query(
        `select "usedAt" from public.counter_tokens where code = $1 and "customerEmail" = $2`,
        [issued.issue.code, MEMBER],
      );
      expect(rows).toEqual([{ usedAt: "" }]);
    });

    it("refuses the barista's own QR and leaves it usable", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      const own = await issueCounterToken(BARISTA);
      if (!own.ok) throw new Error("rate limited");
      const res = await POST(
        stampRequest(BARISTA, { kind: "token", value: own.issue.token }),
      );
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe(
        "self_stamp",
      );
      const byCode = await POST(
        stampRequest(BARISTA, { kind: "code", value: own.issue.code }),
      );
      expect(byCode.status).toBe(403);
      expect(await stampsOf(BARISTA)).toEqual([]);
      const { rows } = await pool!.query(
        `select "usedAt" from public.counter_tokens where code = $1 and "customerEmail" = $2`,
        [own.issue.code, BARISTA],
      );
      expect(rows).toEqual([{ usedAt: "" }]);
    });

    it("stamps a member through the till's own rules, once per token", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      const before = (await stampsOf(MEMBER)).length;
      const issued = await issueCounterToken(MEMBER);
      if (!issued.ok) throw new Error("rate limited");

      const res = await POST(
        stampRequest(BARISTA, {
          kind: "token",
          value: issued.issue.token,
          stamps: 2,
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("no-store");
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        name: "Eda",
        memberLabel: `u***@laffogato.net`,
        code: issued.issue.code,
        stampsGiven: 2,
      });
      expect(typeof body.stamps).toBe("number");
      expect(typeof body.stampTarget).toBe("number");
      expect(typeof body.rewardsReady).toBe("number");

      const rows = await stampsOf(MEMBER);
      expect(rows).toHaveLength(before + 2);
      expect(rows.slice(-2)).toEqual([
        { actor: BARISTA, note: "Kasa · QR · Uygulama", source: "counter" },
        { actor: BARISTA, note: "Kasa · QR · Uygulama", source: "counter" },
      ]);
      const { rows: burned } = await pool!.query(
        `select "usedBy" from public.counter_tokens where code = $1 and "customerEmail" = $2`,
        [issued.issue.code, MEMBER],
      );
      expect(burned).toEqual([{ usedBy: BARISTA }]);
      const { rows: audit } = await pool!.query(
        `select actor, payload from public.audit_logs
          where entity = 'counter_token' and "entityId" = $1 and actor = $2`,
        [issued.issue.code, BARISTA],
      );
      expect(audit).toEqual([
        { actor: BARISTA, payload: { kind: "token", stamps: 2, via: "app" } },
      ]);

      // The same QR again - a second barista, or the camera seeing it twice.
      const reused = await POST(
        stampRequest(BARISTA, { kind: "token", value: issued.issue.token }),
      );
      expect(reused.status).toBe(409);
      expect(((await reused.json()) as { error: string }).error).toBe(
        "already_used",
      );
      expect(await stampsOf(MEMBER)).toHaveLength(before + 2);
    });

    it("refuses a stamp count the till would refuse", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      const issued = await issueCounterToken(MEMBER);
      if (!issued.ok) throw new Error("rate limited");
      const res = await POST(
        stampRequest(BARISTA, {
          kind: "code",
          value: issued.issue.code,
          stamps: 6,
        }),
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe(
        "invalid_stamps",
      );
    });

    it("stops stamping the moment the grant is revoked", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      await actions.revokeBaristaAction(null, form(BARISTA));
      const issued = await issueCounterToken(MEMBER);
      if (!issued.ok) throw new Error("rate limited");
      const res = await POST(
        stampRequest(BARISTA, { kind: "code", value: issued.issue.code }),
      );
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe("not_staff");
    });
  });

  describe("GET /me staff.till", () => {
    function meRequest(as: string): Request {
      return new Request("https://laffogato.net/api/mobile/v1/me", {
        headers: { "x-test-member": as },
      });
    }

    it("is true for an active barista and false once revoked", async () => {
      await actions.grantBaristaAction({}, form(BARISTA));
      const granted = await GET_ME(meRequest(BARISTA));
      expect(granted.status).toBe(200);
      expect(((await granted.json()) as { staff: unknown }).staff).toEqual({
        till: true,
      });

      await actions.revokeBaristaAction(null, form(BARISTA));
      const revoked = await GET_ME(meRequest(BARISTA));
      expect(((await revoked.json()) as { staff: unknown }).staff).toEqual({
        till: false,
      });
    });

    it("is false for an ordinary member", async () => {
      const res = await GET_ME(meRequest(MEMBER));
      expect(((await res.json()) as { staff: unknown }).staff).toEqual({
        till: false,
      });
    });
  });
});
