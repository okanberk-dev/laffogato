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

// ── 20260908170000_campaign_email_reconsent.sql ───────────────────────────
//
// The amendment: consent re-read at claim, `postedAt` on the send row, the
// bulletin's consent register for members, claims serialised per campaign,
// the mark scoped to its own claim, and a fresh batch number for a row that
// comes back. Same shape checks, same reason — a function silently reverted
// to the first version would mail people who withdrew, mail a batch twice,
// or post a used key with a different address set.

const RECONSENT = "20260908170000_campaign_email_reconsent.sql";
const reconsent = readFileSync(
  join(process.cwd(), "db", "migrations", RECONSENT),
  "utf8",
);
const reconsentStatements = reconsent
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

/** Every `create or replace function public.<name>(` block, in file order. */
function functionBodies(source: string, name: string): string[] {
  const head = `create or replace function public.${name}(`;
  const out: string[] = [];
  let from = source.indexOf(head);
  while (from >= 0) {
    const rest = source.slice(from);
    const end = rest.indexOf("\n$$;");
    out.push(end >= 0 ? rest.slice(0, end) : rest);
    from = source.indexOf(head, from + head.length);
  }
  expect(out.length, name).toBeGreaterThan(0);
  return out;
}

/** The body of the FIRST `create or replace function public.<name>(` block. */
function functionBody(source: string, name: string): string {
  return functionBodies(source, name)[0];
}

describe(RECONSENT, () => {
  it("never records itself in _migrations", () => {
    expect(reconsentStatements).not.toContain("insert into public._migrations");
  });

  it("sorts after the file it amends, so the bundle applies it last", () => {
    expect(RECONSENT > FILE).toBe(true);
    expect(bundle.indexOf(`-- ${RECONSENT}`)).toBeGreaterThan(
      bundle.indexOf(`-- ${FILE}`),
    );
  });

  it("records the hand-off on the send row", () => {
    expect(reconsentStatements).toMatch(
      /alter table public\.campaign_email_sends\s+add column if not exists "postedAt" text not null default ''/,
    );
  });

  it("replaces the audience, the enqueue and the claim, widens the mark, and keeps the old signatures one release", () => {
    const names = [
      ...reconsentStatements.matchAll(
        /create or replace function public\.([a-z_]+)\(/g,
      ),
    ].map((m) => m[1]);
    expect(names).toEqual([
      "campaign_email_audience",
      "campaign_email_enqueue",
      "campaign_email_claim",
      "campaign_email_claim",
      "campaign_email_mark",
    ]);
    const [claim, wrapper] = functionBodies(
      reconsentStatements,
      "campaign_email_claim",
    );
    expect(claim).toMatch(
      /p_campaign text,\s+p_stale_before text,\s+p_posted_before text,\s+p_now text/,
    );
    // A runner of the previous build still inside after() when this lands
    // calls the three-argument claim; dropped, it would fail with 42883 and
    // patch its campaign 'failed'. So the old signature stays, delegating —
    // with '' as the posted threshold, which settles nothing.
    expect(reconsentStatements).not.toContain("drop function");
    expect(wrapper).toMatch(
      /p_campaign text,\s+p_stale_before text,\s+p_now text/,
    );
    expect(wrapper).toContain(
      "return public.campaign_email_claim(p_campaign, p_stale_before, '', p_now);",
    );
    // The mark's six-argument form from the first file is not dropped either.
    expect(functionBody(reconsentStatements, "campaign_email_mark")).toMatch(
      /p_error text,\s+p_now text,\s+p_claimed_at text/,
    );
  });

  it("locks search_path on every function", () => {
    const functions =
      reconsentStatements.match(/create or replace function/g) ?? [];
    const locked = reconsentStatements.match(/set search_path = ''/g) ?? [];
    expect(functions.length).toBe(5);
    expect(locked.length).toBe(functions.length);
  });

  it("serialises claims per campaign: the campaign row is locked before anything is read or written", () => {
    const claim = functionBody(reconsentStatements, "campaign_email_claim");
    const lock = claim.search(
      /from public\.campaign_emails c\s+where c\.id = p_campaign\s+for update;/,
    );
    expect(lock).toBeGreaterThanOrEqual(0);
    // Before the settle, the consent pass and the pick — a second runner
    // waits here, then reads the first's fresh 'sending' rows and takes the
    // next batch instead of half of this one.
    expect(lock).toBeLessThan(
      claim.indexOf("'sağlayıcı yanıtı teyit edilemedi'"),
    );
    expect(lock).toBeLessThan(claim.indexOf("'onay geri çekildi"));
    expect(lock).toBeLessThan(claim.indexOf("for update skip locked"));
  });

  it("scopes the mark to the caller's own claim", () => {
    const mark = functionBody(reconsentStatements, "campaign_email_mark");
    expect(mark).toMatch(
      /and s\.status = 'sending'\s+and s\."claimedAt" = p_claimed_at/,
    );
    // Otherwise unchanged: ids by e-mail index, counters from the rows.
    expect(mark).toContain(`coalesce(p_ids ->> (o.idx)::int, '')`);
    expect(mark).toContain(`s.status in ('failed', 'skipped')`);
  });

  it("asks the bulletin's consent register for a member's newsletter flag, in the audience and in the mint", () => {
    const consent =
      /case p_pref\s+when 'marketing' then c\."marketingConsentAt" <> ''\s+else exists \(\s+select 1\s+from public\.newsletter_subscribers n\s+where lower\(n\.email\) = lower\(c\.email\)\s+and n\."isActive"\s+and n\."consentAt" <> ''\s+\)\s+end/g;
    expect(
      functionBody(reconsentStatements, "campaign_email_audience"),
    ).toMatch(consent);
    expect(functionBody(reconsentStatements, "campaign_email_enqueue")).toMatch(
      consent,
    );
    // The waiver is gone from the replacement.
    expect(reconsentStatements).not.toContain(
      `(p_pref <> 'marketing' or c."marketingConsentAt" <> '')`,
    );
  });

  it("re-reads consent when a batch is claimed and skips whoever withdrew, with the reason", () => {
    const claim = functionBody(reconsentStatements, "campaign_email_claim");
    // The campaign's own preference, each row against its own store.
    expect(claim).toMatch(
      /case when c\.template = 'bulten-kampanya' then 'newsletter'\s+else 'marketing' end/,
    );
    expect(claim).toContain(
      "from public.campaign_email_audience('marketing', v_pref) a",
    );
    expect(claim).toContain(
      "from public.campaign_email_audience('newsletter', v_pref) a",
    );
    expect(claim).toContain(`ok.kind  = s."recipientKind"`);
    expect(claim).toContain("ok.token <> ''");
    // The stored link must carry the CURRENT token — a spent link is dead.
    expect(claim).toContain(`right(s."unsubUrl", length(ok.token)) = ok.token`);
    expect(claim).toMatch(
      /set status\s+= 'skipped',\s+error\s+= 'onay geri çekildi ya da kitle dışına çıktı'/,
    );
    // Both passes run BEFORE the batch is picked.
    expect(claim.indexOf("'onay geri çekildi")).toBeLessThan(
      claim.indexOf("for update skip locked"),
    );
    // And the counters are refreshed when either pass touched a row.
    expect(claim).toContain("if settled + dropped > 0 then");
    expect(claim).toContain(`s.status in ('failed', 'skipped')`);
  });

  it("settles a batch posted before the provider window closed as failed, and never re-posts it", () => {
    const claim = functionBody(reconsentStatements, "campaign_email_claim");
    expect(claim).toMatch(
      /set status = 'failed',\s+error\s+= 'sağlayıcı yanıtı teyit edilemedi'/,
    );
    expect(claim).toContain(`s."postedAt" <> ''`);
    expect(claim).toContain(`s."postedAt" < p_posted_before`);
    // A posted row is not consent-skipped: reclaimed under its key or settled.
    expect(claim).toContain(`s."postedAt" = ''`);
    expect(claim.indexOf("'sağlayıcı yanıtı teyit edilemedi'")).toBeLessThan(
      claim.indexOf("for update skip locked"),
    );
  });

  it("re-queues a skipped row from the audience as it stands now, and names the rest", () => {
    const enqueue = functionBody(reconsentStatements, "campaign_email_enqueue");
    const reads = enqueue.match(
      /(?:from|join) public\.campaign_email_audience\(p_audience, p_pref\) a/g,
    );
    expect(reads).toHaveLength(2);
    expect(enqueue).toMatch(
      /set status\s+= 'queued',\s+error\s+= '',\s+"claimedAt"\s+= '',\s+"postedAt"\s+= '',\s+"recipientKind" = back\.kind,\s+name\s+= back\.name,\s+"unsubUrl"\s+= p_unsub_base \|\| back\.token,\s+"batchNo"\s+= next_batch \+ \(back\.rn - 1\) \/ 100/,
    );
    expect(enqueue).toContain("and s.status = 'skipped'");
    expect(enqueue).toContain("and a.token <> ''");
    expect(enqueue).toMatch(
      /set error = 'onay geri çekildi ya da kitle dışına çıktı'\s+where s\."campaignId" = p_campaign\s+and s\.status = 'skipped'/,
    );
    expect(enqueue).toContain(`on conflict ("campaignId", email) do nothing`);
  });

  it("gives a row that comes back a fresh batch number, read BEFORE the re-queue, and newcomers one after that", () => {
    const enqueue = functionBody(reconsentStatements, "campaign_email_enqueue");
    const next = `coalesce(max(s."batchNo"), -1) + 1`;
    const first = enqueue.indexOf(next);
    const second = enqueue.indexOf(next, first + 1);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    // A batch number is part of the provider key; the row's old batch may
    // have been posted for the others, and that key is spent for that set.
    const requeue = enqueue.indexOf(`set status          = 'queued'`);
    expect(first).toBeLessThan(requeue);
    expect(second).toBeGreaterThan(requeue);
    expect(second).toBeLessThan(
      enqueue.indexOf("insert into public.campaign_email_sends"),
    );
    // A hundred to a batch, in e-mail order, like the newcomers.
    expect(enqueue).toContain("row_number() over (order by s.email) as rn");
    expect(enqueue).toContain(
      `"batchNo"       = next_batch + (back.rn - 1) / 100`,
    );
  });

  it("is carried by the hand-apply bundle, after the original", () => {
    expect(bundle).toContain(
      `insert into public._migrations (name) values ('${RECONSENT}')`,
    );
    // The four-argument claim, the delegating three-argument one, and the
    // seven-argument mark are all in the bundle, after the first file.
    const origin = bundle.indexOf(`-- ${FILE}`);
    const claims = functionBodies(bundle.slice(origin), "campaign_email_claim");
    expect(claims.some((b) => /p_posted_before text/.test(b))).toBe(true);
    expect(
      claims.some((b) =>
        b.includes(
          "return public.campaign_email_claim(p_campaign, p_stale_before, '', p_now);",
        ),
      ),
    ).toBe(true);
    expect(
      functionBodies(bundle.slice(origin), "campaign_email_mark").some((b) =>
        /p_claimed_at text/.test(b),
      ),
    ).toBe(true);
  });
});
