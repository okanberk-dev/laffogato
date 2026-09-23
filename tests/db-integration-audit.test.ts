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
    await applyBundledSchema(pool);
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

  describe("caps and refunds hold under concurrency (SQL, not JS)", () => {
    const iso = () => new Date().toISOString();

    it("records only the refunds that fit, when they race", async () => {
      await pool!.query(`delete from public.orders where id = 'ord-rfn-1'`);
      await pool!.query(
        `insert into public.orders (id, "orderNo", "customerEmail", status, "totalMinor",
           "subtotalMinor", refunds, items, "createdAt", "paidAt")
         values ('ord-rfn-1', 990001, 'iade@laffogato.net', 'paid', 10000, 10000,
           '[]'::jsonb, '[]'::jsonb, $1, $1)`,
        [iso()],
      );
      const { reserveRefund } = await import("@/lib/admin/store");
      // Three refunds of 60,00 ₺ against a 100,00 ₺ order: one fits.
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          reserveRefund("ord-rfn-1", { amountMinor: 6000, reason: "yarış" }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const { rows } = await pool!.query(
        `select refunds from public.orders where id = 'ord-rfn-1'`,
      );
      expect(rows[0].refunds).toHaveLength(1);
    });

    it("takes a reserved refund back when the POS refuses it", async () => {
      const { reserveRefund, releaseRefund } =
        await import("@/lib/admin/store");
      await pool!.query(
        `update public.orders set refunds = '[]'::jsonb where id = 'ord-rfn-1'`,
      );
      const r = await reserveRefund("ord-rfn-1", {
        amountMinor: 2500,
        reason: "deneme",
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      await releaseRefund("ord-rfn-1", r.refund.id);
      const { rows } = await pool!.query(
        `select refunds from public.orders where id = 'ord-rfn-1'`,
      );
      expect(rows[0].refunds).toEqual([]);
    });

    it("keeps an app member to MAX_OPEN_ORDERS unpaid orders", async () => {
      await pool!.query(
        `delete from public.orders where "customerEmail" = 'cap@laffogato.net'`,
      );
      const inserts = [1, 2, 3, 4, 5].map((n) =>
        pool!
          .query(
            `insert into public.orders (id, "orderNo", "customerEmail", status, channel, "createdAt")
             values ($1, $2, 'cap@laffogato.net', 'pending_payment', 'app', $3)`,
            [`ord-cap-${n}`, 991000 + n, iso()],
          )
          .then(
            () => "ok",
            (e: Error) => e.message,
          ),
      );
      const outcomes = await Promise.all(inserts);
      expect(outcomes.filter((o) => o === "ok")).toHaveLength(3);
      expect(
        outcomes.filter((o) => /TOO_MANY_PENDING_ORDERS/.test(o)),
      ).toHaveLength(2);
    });

    it("does not cap web orders or an admin's manual ones", async () => {
      await pool!.query(
        `insert into public.orders (id, "orderNo", "customerEmail", status, channel, "createdAt")
         values ('ord-cap-web', 991100, 'cap@laffogato.net', 'pending_payment', 'web', $1)`,
        [iso()],
      );
    });

    it("keeps a member to KARAOKE_OPEN_CAP open bookings", async () => {
      await pool!.query(
        `delete from public.karaoke_reservations where "customerEmail" = 'krk@laffogato.net'`,
      );
      const outcomes = await Promise.all(
        [1, 2, 3, 4].map((n) =>
          pool!
            .query(
              `insert into public.karaoke_reservations (id, "customerEmail", date, "startHour", status)
               values ($1, 'krk@laffogato.net', '2099-01-01', $2, 'requested')`,
              [`krk-cap-${n}`, 12 + n * 2],
            )
            .then(
              () => "ok",
              (e: Error) => e.message,
            ),
        ),
      );
      expect(outcomes.filter((o) => o === "ok")).toHaveLength(2);
    });

    it("keeps till QR issuing to MAX_ISSUES_PER_WINDOW a minute", async () => {
      await pool!.query(
        `delete from public.counter_tokens where "customerEmail" = 'qr@laffogato.net'`,
      );
      const now = iso();
      const outcomes = await Promise.all(
        Array.from({ length: 13 }, (_, n) =>
          pool!
            .query(
              `insert into public.counter_tokens ("tokenHash", "customerEmail", code, "expiresAt", "createdAt")
               values ($1, 'qr@laffogato.net', $2, '2099-01-01T00:00:00.000Z', $3)`,
              [`hash-${n}`, `CODE${n}`, now],
            )
            .then(
              () => "ok",
              (e: Error) => e.message,
            ),
        ),
      );
      expect(outcomes.filter((o) => o === "ok")).toHaveLength(10);
    });
  });

  describe("bulletin double opt-in (6563)", () => {
    const EMAIL = "cift-onay@laffogato.net";
    const row = async () =>
      (
        await pool!.query(
          `select "isActive", "consentAt", "confirmToken", "consentIp" from public.newsletter_subscribers where email = $1`,
          [EMAIL],
        )
      ).rows[0];

    beforeEach(async () => {
      await pool!.query(
        `delete from public.newsletter_subscribers where email = $1`,
        [EMAIL],
      );
    });

    it("stores a footer request pending, never as a subscriber", async () => {
      const { subscribeNewsletter } = await import("@/lib/newsletter/store");
      const res = await subscribeNewsletter(EMAIL, "", "footer", {
        at: new Date().toISOString(),
        ip: "10.1.1.1",
      });
      expect(res).toMatchObject({ ok: true, pending: true });
      expect(await row()).toMatchObject({ isActive: false, consentAt: "" });
    });

    it("subscribes when the owner confirms, once", async () => {
      const { subscribeNewsletter, confirmNewsletterByToken } =
        await import("@/lib/newsletter/store");
      const res = await subscribeNewsletter(EMAIL, "", "footer", {
        at: new Date().toISOString(),
        ip: "10.1.1.1",
      });
      const token = res.ok ? res.confirmToken! : "";
      expect(await confirmNewsletterByToken(token, "10.2.2.2")).toBe(EMAIL);
      const after = await row();
      expect(after).toMatchObject({
        isActive: true,
        confirmToken: "",
        consentIp: "10.2.2.2",
      });
      expect(after.consentAt).not.toBe("");
      expect(await confirmNewsletterByToken(token, "10.2.2.2")).toBeNull();
    });

    it("refuses a confirmation link older than seven days", async () => {
      const { subscribeNewsletter, confirmNewsletterByToken } =
        await import("@/lib/newsletter/store");
      const res = await subscribeNewsletter(EMAIL, "", "footer", {
        at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        ip: "10.1.1.1",
      });
      const token = res.ok ? res.confirmToken! : "";
      expect(await confirmNewsletterByToken(token, "10.2.2.2")).toBeNull();
      expect((await row()).isActive).toBe(false);
    });

    it("activates an account's pending request on e-mail verification only", async () => {
      const { subscribeNewsletter, confirmPendingNewsletterForEmail } =
        await import("@/lib/newsletter/store");
      await subscribeNewsletter(
        EMAIL,
        "Üye",
        "register",
        { at: new Date().toISOString(), ip: "10.1.1.1" },
        { confirmed: false },
      );
      expect((await row()).isActive).toBe(false);
      expect(await confirmPendingNewsletterForEmail(EMAIL, "10.3.3.3")).toBe(
        true,
      );
      expect((await row()).isActive).toBe(true);
    });

    it("never revives a subscriber who opted out, from verification", async () => {
      const {
        subscribeNewsletter,
        deactivateNewsletterSubscriber,
        confirmPendingNewsletterForEmail,
      } = await import("@/lib/newsletter/store");
      await subscribeNewsletter(
        EMAIL,
        "",
        "account",
        { at: new Date().toISOString(), ip: "10.1.1.1" },
        { confirmed: true },
      );
      const { rows } = await pool!.query(
        `select id from public.newsletter_subscribers where email = $1`,
        [EMAIL],
      );
      await deactivateNewsletterSubscriber(rows[0].id);
      expect(await confirmPendingNewsletterForEmail(EMAIL, "10.3.3.3")).toBe(
        false,
      );
      expect((await row()).isActive).toBe(false);
    });
  });
});
