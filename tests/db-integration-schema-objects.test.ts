import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyBundledSchema } from "./_support/apply-schema";

/**
 * What the bundled schema leaves behind in a real Postgres, after the whole
 * bundle has been replayed (the bootstrap path, and a hand apply of
 * db/schema.sql): later files that drop or amend what earlier files create
 * must win. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

maybe("bundled schema objects in a real Postgres", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function signatures(name: string): Promise<string[]> {
    const r = await pool.query<{ args: string }>(
      `select pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1
        order by 1`,
      [name],
    );
    return r.rows.map((row) => row.args);
  }

  it("keeps only the current campaign claim and mark signatures", async () => {
    expect(await signatures("campaign_email_claim")).toEqual([
      "p_campaign text, p_stale_before text, p_posted_before text, p_now text",
    ]);
    expect(await signatures("campaign_email_mark")).toEqual([
      "p_campaign text, p_batch integer, p_status text, p_ids jsonb, p_error text, p_now text, p_claimed_at text",
    ]);
  });

  describe("email_suppressions (Resend bounces and complaints)", () => {
    const MEMBER = "bastirma-uye@laffogato.net";
    const SUBSCRIBER = "bastirma-abone@laffogato.net";

    async function audience(): Promise<string[]> {
      const r = await pool.query<{ email: string }>(
        `select email from public.campaign_email_audience('both', 'marketing')
          where email like 'bastirma-%'`,
      );
      return r.rows.map((row) => row.email).sort();
    }

    beforeAll(async () => {
      await pool.query(
        `delete from public.email_suppressions where email like 'bastirma-%'`,
      );
      await pool.query(
        `delete from public.customers where email like 'bastirma-%'`,
      );
      await pool.query(
        `delete from public.newsletter_subscribers where email like 'bastirma-%'`,
      );
      await pool.query(
        `insert into public.customers
           (id, email, name, "isActive", "emailVerified", "notificationPrefs",
            "marketingConsentAt", "unsubToken", birthday)
         values ('cst-bastirma', $1, 'Üye', true, true,
                 '{"orderUpdates":true,"marketing":true,"newsletter":false}'::jsonb,
                 '2026-09-01T10:00:00.000Z', 'tok-uye', '1990-09-23')`,
        [MEMBER],
      );
      await pool.query(
        `insert into public.newsletter_subscribers
           (id, email, name, "isActive", "consentAt", "unsubToken")
         values ('nws-bastirma', $1, 'Abone', true,
                 '2026-09-01T10:00:00.000Z', 'tok-abone')`,
        [SUBSCRIBER],
      );
    });

    it("leaves both addresses in the audience while nothing is suppressed", async () => {
      expect(await audience()).toEqual([SUBSCRIBER, MEMBER].sort());
    });

    it("drops a suppressed address from the audience and the greeting's mail flag", async () => {
      await pool.query(
        `select public.email_suppression_record($1, 'bounced', 'Permanent',
                'msg_1', 'em_1', '2026-09-23T10:00:00.000Z')`,
        [MEMBER.toUpperCase()],
      );
      expect(await audience()).toEqual([SUBSCRIBER]);
      const greeting = await pool.query<{ marketing: boolean }>(
        `select marketing from public.birthday_greeting_audience('["09-23"]'::jsonb)
          where email = $1`,
        [MEMBER],
      );
      // Still in the result (the coupon is an account right), but not mailed.
      expect(greeting.rows).toEqual([{ marketing: false }]);
    });

    it("keeps the first-seen time when the event repeats", async () => {
      await pool.query(
        `select public.email_suppression_record($1, 'complained', 'spam',
                'msg_2', 'em_2', '2026-09-24T10:00:00.000Z')`,
        [MEMBER],
      );
      const r = await pool.query(
        `select reason, "createdAt", "updatedAt" from public.email_suppressions
          where email = $1`,
        [MEMBER],
      );
      expect(r.rows).toEqual([
        {
          reason: "complained",
          createdAt: "2026-09-23T10:00:00.000Z",
          updatedAt: "2026-09-24T10:00:00.000Z",
        },
      ]);
    });
  });

  it("replays cleanly a second time", async () => {
    await applyBundledSchema(pool);
    expect(await signatures("campaign_email_claim")).toHaveLength(1);
    expect(await signatures("campaign_email_mark")).toHaveLength(1);
  });
});
