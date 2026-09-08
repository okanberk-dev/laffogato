import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const FILE = "20260908150000_campaign_emails.sql";
const sql = readFileSync(join(process.cwd(), "db", "migrations", FILE), "utf8");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** The file with its `--` comments removed — the part Postgres actually runs. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe(FILE, () => {
  it("never records itself in _migrations", () => {
    // scripts/db-migrate.mjs inserts the row itself, inside the same
    // transaction. A hand-written insert collides with it (23505) and rolls
    // the WHOLE file back — the tables would silently never exist.
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("gives members a one-click way out, once per row", () => {
    // Only newsletter_subscribers carried a token; a member who consented at
    // sign-up could not be sent a campaign with a compliant unsubscribe link.
    expect(statements).toMatch(
      /alter table public\.customers\s+add column if not exists "unsubToken" text not null default ''/,
    );
    expect(statements).toContain(
      "create unique index if not exists customers_unsub_token_idx",
    );
    expect(statements).toContain(`where "unsubToken" <> ''`);
  });

  it("marks a post that has been mailed so a later save cannot mail it again", () => {
    expect(statements).toMatch(
      /alter table public\.app_posts\s+add column if not exists "emailCampaignId" text not null default ''/,
    );
  });

  it("creates both tables idempotently", () => {
    expect(sql).toContain("create table if not exists public.campaign_emails");
    expect(sql).toContain(
      "create table if not exists public.campaign_email_sends",
    );
  });

  it("keeps one row per campaign and recipient", () => {
    // The unique pair is what makes a re-queue add newcomers instead of
    // mailing everyone twice.
    expect(statements).toMatch(
      /create unique index if not exists campaign_email_sends_recipient_key\s+on public\.campaign_email_sends \("campaignId", email\)/,
    );
    expect(statements).toContain(
      `on conflict ("campaignId", email) do nothing`,
    );
    expect(statements).toContain(`("campaignId", status, "batchNo")`);
  });

  it("keeps the audience rule in the database, in one place", () => {
    expect(statements).toContain(
      "create or replace function public.campaign_email_audience(",
    );
    // Members: active, verified, the preference on, consent stamped, no
    // guest or closed-account placeholders.
    expect(statements).toContain(`c."isActive"`);
    expect(statements).toContain(`c."emailVerified"`);
    expect(statements).toContain(
      `coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'`,
    );
    expect(statements).toContain(
      `(p_pref <> 'marketing' or c."marketingConsentAt" <> '')`,
    );
    expect(statements).toContain(`c.email not like '%@laffogato.local'`);
    expect(statements).toContain(`c.email not like '%@anon.local'`);
    // Subscribers: active, consent recorded, token present.
    expect(statements).toContain(`s."consentAt" <> ''`);
    expect(statements).toContain(`s."unsubToken" <> ''`);
    // One row per address; the member row wins.
    expect(statements).toContain("select distinct on (e.email)");
    expect(statements).toContain(
      "order by e.email, (e.kind = 'customer') desc",
    );
    // Both readers go through the same function.
    const enqueueBody = statements.slice(
      statements.indexOf("function public.campaign_email_enqueue("),
    );
    const countBody = statements.slice(
      statements.indexOf("function public.campaign_email_audience_count("),
      statements.indexOf("function public.campaign_email_enqueue("),
    );
    expect(enqueueBody).toContain("from public.campaign_email_audience(");
    expect(countBody).toContain("from public.campaign_email_audience(");
  });

  it("mints member tokens without assuming pgcrypto", () => {
    expect(statements).toContain("gen_random_uuid()");
    expect(statements).not.toContain("gen_random_bytes");
  });

  it("hands out batches under skip locked and never renumbers them", () => {
    expect(statements).toContain("for update skip locked");
    // Batches of 100 — Resend's batch endpoint cap.
    expect(statements).toContain("/ 100");
    // Newcomers continue after the last batch: a key already used for one
    // set of addresses must never be reused for another.
    expect(statements).toContain(`coalesce(max(s."batchNo"), -1) + 1`);
    // Skipped rows (no key / dry run / preview host) go back in the queue;
    // sent and failed stay final.
    expect(statements).toMatch(
      /set status = 'queued', error = '', "claimedAt" = ''\s+where s\."campaignId" = p_campaign\s+and s\.status = 'skipped'/,
    );
  });

  it("settles a batch in one statement and refreshes the counters from the rows", () => {
    expect(statements).toContain(
      "create or replace function public.campaign_email_mark(",
    );
    expect(statements).toContain(`coalesce(p_ids ->> (o.idx)::int, '')`);
    expect(statements).toContain(`s.status in ('failed', 'skipped')`);
  });

  it("locks search_path on every function", () => {
    const functions = statements.match(/create or replace function/g) ?? [];
    const locked = statements.match(/set search_path = ''/g) ?? [];
    expect(functions.length).toBe(5);
    expect(locked.length).toBe(functions.length);
  });

  it("enables row level security on both tables", () => {
    expect(sql).toContain(
      "alter table public.campaign_emails enable row level security",
    );
    expect(sql).toContain(
      "alter table public.campaign_email_sends enable row level security",
    );
  });

  it("is carried by the hand-apply bundle", () => {
    expect(bundle).toContain(
      "create table if not exists public.campaign_emails",
    );
    expect(bundle).toContain(
      "create or replace function public.campaign_email_claim(",
    );
    expect(bundle).toContain(
      `insert into public._migrations (name) values ('${FILE}')`,
    );
  });
});
