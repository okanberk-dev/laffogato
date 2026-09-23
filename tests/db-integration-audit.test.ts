import { readFileSync } from "node:fs";

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

/**
 * The audit fixes that only a real Postgres can prove: atomicity under
 * concurrent requests, and SQL functions returning what the TypeScript reads.
 * Runs the app's own modules with `getDb()` pointed at TEST_DATABASE_URL,
 * after applying the bundled schema (idempotent) to it. Skipped without one:
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
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.7" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

maybe("audit fixes against a real Postgres", () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_, max: 12 });
    await pool.query(readFileSync("db/schema.sql", "utf8"));
  });

  afterAll(async () => {
    await pool?.end();
    pool = null;
  });

  describe("login attempts are counted before the credential is checked", () => {
    beforeEach(async () => {
      await pool!.query(
        `delete from public.auth_attempts where key like 'admin-login::%'`,
      );
    });

    it("lets at most the cap through when a burst arrives at once", async () => {
      const { reserveLoginAttempt } = await import("@/lib/admin/rate-limit");
      const results = await Promise.all(
        Array.from({ length: 25 }, () =>
          reserveLoginAttempt("admin-login", "10.0.0.1", "hedef@laffogato.net"),
        ),
      );
      const allowed = results.filter((r) => !r.blocked).length;
      // Five failures per window (MAX_FAILS); the old check→verify→record
      // sequence let all 25 through.
      expect(allowed).toBe(5);
      expect(results.filter((r) => r.blocked).length).toBe(20);
    });

    it("tells the last permitted attempt it is the last", async () => {
      const { reserveLoginAttempt } = await import("@/lib/admin/rate-limit");
      const seen: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await reserveLoginAttempt(
          "admin-login",
          "10.0.0.2",
          "a@b.co",
        );
        expect(r.blocked).toBe(false);
        seen.push(r.remaining);
      }
      expect(seen).toEqual([4, 3, 2, 1, 0]);
      const sixth = await reserveLoginAttempt(
        "admin-login",
        "10.0.0.2",
        "a@b.co",
      );
      expect(sixth.blocked).toBe(true);
    });

    it("starts over after a success clears the key", async () => {
      const { reserveLoginAttempt, clearLoginLimit } =
        await import("@/lib/admin/rate-limit");
      for (let i = 0; i < 3; i++) {
        await reserveLoginAttempt("admin-login", "10.0.0.3", "c@d.co");
      }
      await clearLoginLimit("admin-login", "10.0.0.3", "c@d.co");
      const next = await reserveLoginAttempt(
        "admin-login",
        "10.0.0.3",
        "c@d.co",
      );
      expect(next).toMatchObject({ blocked: false, remaining: 4 });
    });
  });

  describe("a TOTP code is spent once", () => {
    const EMAIL = "iki-asama@laffogato.net";

    beforeEach(async () => {
      const { generateSecret } = await import("otplib");
      await pool!.query(`delete from public.admin_2fa where email = $1`, [
        EMAIL,
      ]);
      await pool!.query(
        `insert into public.admin_2fa (email, secret, enabled, "enrolledAt", "updatedAt")
         values ($1, $2, true, '', '')`,
        [EMAIL, generateSecret()],
      );
    });

    async function currentCode(): Promise<string> {
      const { generateSync } = await import("otplib");
      const { rows } = await pool!.query(
        `select secret from public.admin_2fa where email = $1`,
        [EMAIL],
      );
      return generateSync({ secret: rows[0].secret });
    }

    it("accepts a code once and refuses it the second time", async () => {
      const { verifyToken } = await import("@/lib/admin/twofa");
      const code = await currentCode();
      expect(await verifyToken(EMAIL, code)).toBe(true);
      expect(await verifyToken(EMAIL, code)).toBe(false);
    });

    it("lets only one of two simultaneous submissions through", async () => {
      const { verifyToken } = await import("@/lib/admin/twofa");
      const code = await currentCode();
      const both = await Promise.all([
        verifyToken(EMAIL, code),
        verifyToken(EMAIL, code),
        verifyToken(EMAIL, code),
      ]);
      expect(both.filter(Boolean)).toHaveLength(1);
    });

    it("still refuses a wrong code", async () => {
      const { verifyToken } = await import("@/lib/admin/twofa");
      expect(await verifyToken(EMAIL, "000000")).toBe(false);
    });
  });

  describe("table-returning functions read as rows (rpcRows)", () => {
    it("birthday_greeting_audience returns today's members", async () => {
      await pool!.query(
        `delete from public.customers where email like 'dogum-%'`,
      );
      await pool!.query(
        `insert into public.customers (id, email, name, "passwordHash", birthday,
           "emailVerified", "isActive", "createdAt", "updatedAt")
         values ('cst-bday-1', 'dogum-1@laffogato.net', 'Doğum Günlü', '', '1990-09-23',
           true, true, '', '')`,
      );
      const { getDb } = await import("@/lib/db");
      const { data, error } = await getDb().rpcRows<{ email: string }>(
        "birthday_greeting_audience",
        { p_month_days: ["09-23"] },
      );
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.map((r) => r.email)).toContain("dogum-1@laffogato.net");
    });
  });
});
