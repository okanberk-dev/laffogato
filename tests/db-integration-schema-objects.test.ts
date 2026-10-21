import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";
import { schemaTableSecurity } from "./_support/schema-tables";

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
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool.end();
    await release?.();
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

  it("keeps row level security on for every table in schema public", async () => {
    // pg_class is the answer the static check in tests/db-rls.test.ts can
    // only predict: RLS with no policy is what closes a table to Supabase's
    // client roles (docs/SUPABASE-GECIS.md §1).
    const r = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')`,
    );
    // db-integration.test.ts builds and drops a scratch table of its own;
    // it is not the schema's, and the suite lock keeps it out of this run.
    const tables = r.rows.filter((row) => row.relname !== "shim_probe");
    expect(
      tables.filter((row) => !row.relrowsecurity).map((row) => row.relname),
    ).toEqual([]);
    // Every table the bundle creates is there, so the check covered them.
    expect(tables.map((row) => row.relname)).toEqual(
      expect.arrayContaining([...schemaTableSecurity().keys()]),
    );
  });

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

  describe("hyphen-only live text (20260923230500)", () => {
    const EM = "\u2014";
    const EN = "\u2013";
    const FILE = "db/migrations/20260923230500_hyphen_only_live_text.sql";

    async function productName(id: string): Promise<string> {
      const r = await pool.query(
        `select name from public.products where id = $1`,
        [id],
      );
      return r.rows[0]?.name as string;
    }

    beforeAll(async () => {
      const old: Record<string, string> = {
        "prd-0001": `Sirena ${EM} Espresso Harmanı`,
        "prd-0006": `Moka ${EM} Bialetti × L'Affogato`,
        "prd-0011": `Cantucci ${EM} Bronte Pistachio`,
        // Edited by the operator since the measurement: must stay as it is.
        "prd-0002": `Notturna ${EM} Filtre Lotu (yeni)`,
      };
      for (const [id, name] of Object.entries(old)) {
        await pool.query(
          `insert into public.products (id, slug, name) values ($1, $2, $3)
           on conflict (id) do update set name = excluded.name`,
          [id, `tire-${id}`, name],
        );
      }
      await pool.query(
        `insert into public.menu_items (id, "categoryKey", name, "desc")
         values ('mnu-0010', 'kahve', 'Cappuccino', $1)
         on conflict (id) do update set "desc" = excluded."desc"`,
        [`Espresso, buharlı süt ve bol köpük ${EM} eşit üç katman.`],
      );
      await pool.query(
        `delete from public.story_timeline where id = 'tire-2008'`,
      );
      await pool.query(
        `insert into public.story_timeline (id, year, title)
         values ('tire-2008', '2008', $1)`,
        [` Sicily ${EM} Bronte pistacchio anlaşması `],
      );
      await pool.query(
        `insert into public.app_posts (id, title, body)
         values ('apost-001', 'Sabah ritüeli', $1)
         on conflict (id) do update set body = excluded.body`,
        [
          `Hafta içi 09:00${EN}11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.`,
        ],
      );
    });

    it("replaces the measured values, keeps spacing, leaves an edited row alone", async () => {
      const { readFileSync } = await import("node:fs");
      const sql = readFileSync(FILE, "utf8");
      await pool.query(sql);
      // Twice: the second run matches nothing and changes nothing.
      await pool.query(sql);

      expect(await productName("prd-0001")).toBe("Sirena - Espresso Harmanı");
      expect(await productName("prd-0006")).toBe(
        "Moka - Bialetti × L'Affogato",
      );
      expect(await productName("prd-0011")).toBe("Cantucci - Bronte Pistachio");
      expect(await productName("prd-0002")).toBe(
        `Notturna ${EM} Filtre Lotu (yeni)`,
      );
      const menu = await pool.query(
        `select "desc" from public.menu_items where id = 'mnu-0010'`,
      );
      expect(menu.rows[0].desc).toBe(
        "Espresso, buharlı süt ve bol köpük - eşit üç katman.",
      );
      const story = await pool.query(
        `select title from public.story_timeline where id = 'tire-2008'`,
      );
      expect(story.rows[0].title).toBe(
        " Sicily - Bronte pistacchio anlaşması ",
      );
      const post = await pool.query(
        `select body from public.app_posts where id = 'apost-001'`,
      );
      expect(post.rows[0].body).toBe(
        "Hafta içi 09:00-11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.",
      );
    });

    it("ends hyphenated after a whole-bundle replay, although an older file flips two names back", async () => {
      await applyBundledSchema(pool);
      expect(await productName("prd-0006")).toBe(
        "Moka - Bialetti × L'Affogato",
      );
      expect(await productName("prd-0011")).toBe("Cantucci - Bronte Pistachio");
    });
  });

  it("replays cleanly a second time", async () => {
    await applyBundledSchema(pool);
    expect(await signatures("campaign_email_claim")).toHaveLength(1);
    expect(await signatures("campaign_email_mark")).toHaveLength(1);
  });
});
