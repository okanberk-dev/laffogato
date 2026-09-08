-- Campaign e-mail: the audience rule, the queue and the send log.
--
-- Commercial mail (6563) needed three things the schema did not have: a way
-- for a MEMBER to unsubscribe without logging in (only newsletter_subscribers
-- carried a token), a record of which campaign went to whom (so a retry can
-- never mail anyone twice), and the audience predicate in ONE place — a
-- jsonb filter over a table the JavaScript query builder can neither join
-- nor filter by jsonb key without paging every member row through Node.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── customers."unsubToken" ────────────────────────────────────────────────
-- Bearer token for the one-click unsubscribe link (RFC 8058) in every
-- campaign mail to a member. Same shape and the same caveat as the subscriber
-- token: the worst a leaked one can do is unsubscribe an address that asked
-- to be unsubscribed. Minted lazily — by campaign_email_enqueue for the whole
-- audience, or by ensureCustomerUnsubToken() for a single link — so existing
-- rows need no backfill.
alter table public.customers
  add column if not exists "unsubToken" text not null default '';

create unique index if not exists customers_unsub_token_idx
  on public.customers ("unsubToken")
  where "unsubToken" <> '';

-- ── app_posts."emailCampaignId" ───────────────────────────────────────────
-- The campaign_emails row a published post was mailed as. Set once, never
-- cleared: a later save of the same post must not mail the members again.
alter table public.app_posts
  add column if not exists "emailCampaignId" text not null default '';

-- ── campaign_emails ───────────────────────────────────────────────────────
-- One row per campaign the panel composes. `fields` holds the template's
-- [ALAN] values. `status` walks draft → queued → sending → sent | failed
-- (or cancelled). `audience` names the consent store(s) the recipients come
-- from: marketing (members), newsletter (subscribers), both.
create table if not exists public.campaign_emails (
  id             text    primary key,
  template       text    not null,
  status         text    not null default 'draft',
  audience       text    not null default 'marketing',
  subject        text    not null default '',
  fields         jsonb   not null default '{}'::jsonb,
  "sourcePostId" text    not null default '',
  "createdBy"    text    not null default '',
  "createdAt"    text    not null default '',
  "queuedAt"     text    not null default '',
  "sentAt"       text    not null default '',
  total          integer not null default 0,
  "sentCount"    integer not null default 0,
  "failedCount"  integer not null default 0,
  "lastError"    text    not null default ''
);
create index if not exists campaign_emails_status_idx
  on public.campaign_emails (status);
alter table public.campaign_emails enable row level security;

-- ── campaign_email_sends ──────────────────────────────────────────────────
-- One row per (campaign, recipient). Unique on the pair, so re-queueing a
-- campaign adds newcomers and never duplicates anyone. `batchNo` is fixed at
-- enqueue: the provider idempotency key is `cmp-<campaignId>-b<batchNo>`, so a
-- retried batch is the same request with the same addresses and Resend
-- dedupes it within 24 hours. `status`: queued → sending → sent | failed |
-- skipped (no provider key, dry run, preview host — never attempted, so a
-- re-queue puts skipped rows back in the queue; sent and failed are final).
create table if not exists public.campaign_email_sends (
  id              bigint  generated always as identity primary key,
  "campaignId"    text    not null,
  email           text    not null,
  "recipientKind" text    not null default 'customer',
  name            text    not null default '',
  "unsubUrl"      text    not null default '',
  "batchNo"       integer not null default 0,
  status          text    not null default 'queued',
  "providerId"    text    not null default '',
  error           text    not null default '',
  "claimedAt"     text    not null default '',
  "createdAt"     text    not null default '',
  "sentAt"        text    not null default ''
);
create unique index if not exists campaign_email_sends_recipient_key
  on public.campaign_email_sends ("campaignId", email);
create index if not exists campaign_email_sends_batch_idx
  on public.campaign_email_sends ("campaignId", status, "batchNo");
alter table public.campaign_email_sends enable row level security;

-- ── campaign_email_audience ───────────────────────────────────────────────
-- THE audience rule. Everything that decides who may receive a commercial
-- mail is in this one query, and both the dry count the panel shows before
-- "Gönder" and the enqueue below read it, so the two can never disagree.
--
--   marketing  → members: active, e-mail verified, the named preference on,
--                and — for the `marketing` preference — an explicit consent
--                stamp. Guest checkouts (@laffogato.local) and closed
--                accounts (@anon.local) are out even if a flag is stale.
--   newsletter → subscribers: active, with a consent record and a token
--                (no token = no unsubscribe link = no mail, 6563).
--   both       → the union, one row per address; the member row wins so the
--                unsubscribe link switches off the account's preferences.
--
-- A member's token may still be '' here; campaign_email_enqueue mints it
-- before it reads this.
create or replace function public.campaign_email_audience(
  p_audience text,
  p_pref text
)
returns table (email text, name text, kind text, token text)
language plpgsql
set search_path = ''
as $$
begin
  return query
    with members as (
      select lower(c.email)     as email,
             c.name             as name,
             'customer'::text   as kind,
             c."unsubToken"     as token
        from public.customers c
       where p_audience in ('marketing', 'both')
         and c."isActive"
         and c."emailVerified"
         and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
         and (p_pref <> 'marketing' or c."marketingConsentAt" <> '')
         and c.email not like '%@laffogato.local'
         and c.email not like '%@anon.local'
    ),
    news as (
      select lower(s.email)     as email,
             s.name             as name,
             'subscriber'::text as kind,
             s."unsubToken"     as token
        from public.newsletter_subscribers s
       where p_audience in ('newsletter', 'both')
         and s."isActive"
         and s."consentAt" <> ''
         and s."unsubToken" <> ''
    ),
    everyone as (
      select m.email, m.name, m.kind, m.token from members m
      union all
      select n.email, n.name, n.kind, n.token from news n
    )
    select distinct on (e.email) e.email, e.name, e.kind, e.token
      from everyone e
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- Dry count for the confirmation dialog: "Bu kampanya N adrese gidecek."
create or replace function public.campaign_email_audience_count(
  p_audience text,
  p_pref text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n
    from public.campaign_email_audience(p_audience, p_pref) a;
  return coalesce(n, 0);
end;
$$;

-- ── campaign_email_enqueue ────────────────────────────────────────────────
-- Materialises the audience into campaign_email_sends and marks the campaign
-- queued. Returns the number of rows added. Safe to call again: existing
-- recipients are left alone (on conflict do nothing), skipped rows go back
-- to the queue, and newcomers are numbered AFTER the last existing batch —
-- a batch number is part of the idempotency key, and a key already sent for
-- one set of addresses must never be reused for another set.
create or replace function public.campaign_email_enqueue(
  p_campaign text,
  p_audience text,
  p_pref text,
  p_now text,
  p_unsub_base text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted   integer := 0;
  next_batch integer := 0;
  total_rows integer := 0;
begin
  if p_audience not in ('marketing', 'newsletter', 'both') then
    raise exception 'campaign_email_enqueue: unknown audience %', p_audience;
  end if;

  -- Members get their unsubscribe token here, before the audience is read,
  -- so every row inserted below carries a working link. pgcrypto is not
  -- assumed: two uuids give 256 random bits in core Postgres.
  if p_audience in ('marketing', 'both') then
    update public.customers c
       set "unsubToken" = replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '')
     where c."unsubToken" = ''
       and c."isActive"
       and c."emailVerified"
       and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
       and (p_pref <> 'marketing' or c."marketingConsentAt" <> '')
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local';
  end if;

  -- A row that never had an attempt goes back in the queue; sent and failed
  -- rows are final.
  update public.campaign_email_sends s
     set status = 'queued', error = '', "claimedAt" = ''
   where s."campaignId" = p_campaign
     and s.status = 'skipped';

  select coalesce(max(s."batchNo"), -1) + 1 into next_batch
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  insert into public.campaign_email_sends
    ("campaignId", email, "recipientKind", name, "unsubUrl", "batchNo",
     status, "createdAt")
  select p_campaign,
         a.email,
         a.kind,
         a.name,
         p_unsub_base || a.token,
         next_batch + ((row_number() over (order by a.email)) - 1) / 100,
         'queued',
         p_now
    from public.campaign_email_audience(p_audience, p_pref) a
   where a.token <> ''
     and not exists (
       select 1
         from public.campaign_email_sends s
        where s."campaignId" = p_campaign
          and s.email = a.email
     )
  on conflict ("campaignId", email) do nothing;
  get diagnostics inserted = row_count;

  select count(*) into total_rows
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  update public.campaign_emails c
     set status      = 'queued',
         total       = total_rows,
         "queuedAt"  = p_now,
         "lastError" = ''
   where c.id = p_campaign;

  return inserted;
end;
$$;

-- ── campaign_email_claim ──────────────────────────────────────────────────
-- Hands one batch (≤ 100 rows, by construction) to the runner: the lowest
-- batch that still has queued rows — or rows a runner claimed and then died
-- on, i.e. still 'sending' with a claimedAt older than p_stale_before. The
-- rows are flipped to 'sending' in the same statement, under
-- `for update skip locked`, so two runners (the panel's after() and the cron)
-- never take the same batch.
--
-- Returns the rows as a jsonb array ordered by e-mail. The query builder's
-- rpc() reads a single `result` cell, which is why this is jsonb and not
-- `setof campaign_email_sends`.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target  integer;
  claimed jsonb;
begin
  select min(s."batchNo") into target
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign
     and (s.status = 'queued'
          or (s.status = 'sending' and s."claimedAt" < p_stale_before));
  if target is null then
    return '[]'::jsonb;
  end if;

  with picked as (
    select s.id
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = target
       and (s.status = 'queued'
            or (s.status = 'sending' and s."claimedAt" < p_stale_before))
     order by s.email
       for update skip locked
  ),
  marked as (
    update public.campaign_email_sends s
       set status = 'sending', "claimedAt" = p_now
      from picked
     where s.id = picked.id
    returning s.*
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.email), '[]'::jsonb)
    into claimed
    from marked m;

  return claimed;
end;
$$;

-- ── campaign_email_mark ───────────────────────────────────────────────────
-- Settles a claimed batch in one statement rather than a hundred updates on
-- a max:1 pool: every row still 'sending' in that batch becomes p_status.
-- p_ids is the provider's id list in the batch's e-mail order (the order the
-- claim returned and the runner posted), so element i lands on row i. On a
-- failure p_ids is empty and p_error is written to every row. The campaign's
-- counters are refreshed from the table so they cannot drift.
create or replace function public.campaign_email_mark(
  p_campaign text,
  p_batch integer,
  p_status text,
  p_ids jsonb,
  p_error text,
  p_now text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  with ordered as (
    select s.id,
           (row_number() over (order by s.email)) - 1 as idx
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = p_batch
       and s.status = 'sending'
  )
  update public.campaign_email_sends s
     set status       = p_status,
         "providerId" = coalesce(p_ids ->> (o.idx)::int, ''),
         error        = coalesce(p_error, ''),
         "sentAt"     = case when p_status = 'sent' then p_now else '' end
    from ordered o
   where s.id = o.id;

  update public.campaign_emails c
     set "sentCount"   = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status = 'sent'),
         "failedCount" = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status in ('failed', 'skipped'))
   where c.id = p_campaign;
end;
$$;
