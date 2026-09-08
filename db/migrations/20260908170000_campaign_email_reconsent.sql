-- Campaign e-mail, second pass: consent is re-read when a batch is CLAIMED,
-- not only when the campaign was queued; a batch handed to the provider is
-- recorded as posted BEFORE the POST, so a batch whose answer was never
-- written down is not posted a second time once the provider's idempotency
-- window has closed; a member reaches the bulletin only with a consent
-- record behind the flag; claims are serialised per campaign, so two
-- runners never split one batch under one provider key; a mark settles only
-- the rows of its own claim; and a skipped row that comes back to the queue
-- gets a NEW batch number, never the number of a batch that was posted.
--
-- Three of the five functions from 20260908150000_campaign_emails.sql are
-- replaced here (campaign_email_audience, campaign_email_enqueue,
-- campaign_email_claim) and campaign_email_mark gains a seventh argument;
-- campaign_email_audience_count is unchanged. The old signatures of the
-- claim and the mark stay for ONE release (see the end of the file).
-- Reviewed 8 Sep 2026 (web review, findings "consent is never re-checked
-- between enqueue and send", "double-send path", "member audience for the
-- bulletin needs no consent record", "two concurrent claims split one
-- batch", "a re-queued row rejoins its original batch").
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── campaign_email_sends."postedAt" ──────────────────────────────────────
-- The instant the runner handed this row's batch to the provider — written
-- BEFORE the POST, cleared only by a re-queue. A row still 'sending' with a
-- postedAt may have been delivered: the runner never learned the answer.
-- Within the provider's 24-hour idempotency window the same key may be posted
-- again and is deduped upstream; after it, the row is settled as failed for a
-- person to look at rather than mailed a second time.
alter table public.campaign_email_sends
  add column if not exists "postedAt" text not null default '';

-- ── campaign_email_audience ───────────────────────────────────────────────
-- THE audience rule, as before, with one change: the `newsletter` preference
-- of a member is worth nothing on its own. `customers` carries no consent
-- stamp for the bulletin (only `marketingConsentAt`, for the marketing
-- preference), and the consent register for the bulletin is
-- newsletter_subscribers (consentAt · consentIp · consentText) — the row the
-- site's account page and the app's PATCH /me both write when the toggle goes
-- on. A member with the flag but no such row (an app subscriber from before
-- that write existed) is out until they toggle again. 6563 puts the burden of
-- proving consent on the sender; a bare boolean does not carry it.
--
--   marketing  → members: active, e-mail verified, the named preference on,
--                and a consent record — `marketingConsentAt` for the
--                `marketing` preference, an active consented
--                newsletter_subscribers row for `newsletter`. Guest checkouts
--                (@laffogato.local) and closed accounts (@anon.local) are out.
--   newsletter → subscribers: active, with a consent record and a token.
--   both       → the union, one row per address; the member row wins.
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
         and (case p_pref
                when 'marketing' then c."marketingConsentAt" <> ''
                else exists (
                  select 1
                    from public.newsletter_subscribers n
                   where lower(n.email) = lower(c.email)
                     and n."isActive"
                     and n."consentAt" <> ''
                )
              end)
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

-- ── campaign_email_enqueue ────────────────────────────────────────────────
-- As before — mint member tokens, put skipped rows back, add newcomers after
-- the last batch — with two changes. A skipped row goes back in the queue
-- only for a recipient the audience rule still names, and as the rule names
-- them NOW: kind, name and the unsubscribe link are re-read from the
-- audience, so a token spent and re-minted in the meantime is not sent out
-- dead; a skipped row the rule no longer names stays skipped and says why.
-- And a row that comes back gets a NEW batch number, after the last one in
-- use. A batch number is part of the provider key, and now that the claim
-- skips a single row for consent (below), a 'skipped' row may belong to a
-- batch that WAS posted for the others: put back under that number it would
-- go up under a used key with a different address set — refused by the
-- provider inside its window (the row failed for nothing), delivered as a
-- new request outside it. Newcomers continue after the rows that came back.
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
  -- assumed: two uuids give 256 random bits in core Postgres. Same predicate
  -- as the audience function's members branch.
  if p_audience in ('marketing', 'both') then
    update public.customers c
       set "unsubToken" = replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '')
     where c."unsubToken" = ''
       and c."isActive"
       and c."emailVerified"
       and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
       and (case p_pref
              when 'marketing' then c."marketingConsentAt" <> ''
              else exists (
                select 1
                  from public.newsletter_subscribers n
                 where lower(n.email) = lower(c.email)
                   and n."isActive"
                   and n."consentAt" <> ''
              )
            end)
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local';
  end if;

  -- Rows that come back start after the last batch number in use — read
  -- BEFORE the re-queue, so no row returns to its old batch.
  select coalesce(max(s."batchNo"), -1) + 1 into next_batch
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  -- A row that never had an attempt goes back in the queue — re-read from
  -- the audience as it stands now, under a fresh batch number, a hundred to
  -- a batch in e-mail order. Sent and failed rows are final.
  with back as (
    select s.id,
           a.kind,
           a.name,
           a.token,
           row_number() over (order by s.email) as rn
      from public.campaign_email_sends s
      join public.campaign_email_audience(p_audience, p_pref) a
        on a.email = s.email
     where s."campaignId" = p_campaign
       and s.status = 'skipped'
       and a.token <> ''
  )
  update public.campaign_email_sends s
     set status          = 'queued',
         error           = '',
         "claimedAt"     = '',
         "postedAt"      = '',
         "recipientKind" = back.kind,
         name            = back.name,
         "unsubUrl"      = p_unsub_base || back.token,
         "batchNo"       = next_batch + (back.rn - 1) / 100
    from back
   where s.id = back.id;

  -- Whoever is still skipped is no longer in the audience.
  update public.campaign_email_sends s
     set error = 'onay geri çekildi ya da kitle dışına çıktı'
   where s."campaignId" = p_campaign
     and s.status = 'skipped';

  -- Newcomers continue after the rows that came back.
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
-- Hands one batch (≤ 100 rows) to the runner, as before — the lowest batch
-- that still has queued rows, or rows a runner claimed and then died on
-- ('sending', claimedAt older than p_stale_before), flipped to 'sending'
-- under `for update skip locked`. Three things happen first, every time:
--
--   0. The campaign's own row is locked (`for update`) and stays locked to
--      the end of this statement's transaction, so claims on one campaign
--      run one after another. Two runners DO call this at once — the panel's
--      after() and the 06:00 cron overlap, and "Gönder" is safe to press
--      twice — and without the lock both read the same lowest batch, `skip
--      locked` hands each the rows the other had not reached, and both post
--      cmp-<id>-b<n> with half the addresses: the provider refuses the second
--      (same key, different payload) and its rows are failed for nothing, or
--      the first's mark settles rows the second never delivered. With the
--      lock the second claim waits, then reads the first's fresh 'sending'
--      rows and takes the NEXT batch. `skip locked` stays as a belt.
--   1. A stale 'sending' row whose batch was POSTED (postedAt set) earlier
--      than p_posted_before — the provider's idempotency window has closed —
--      is settled as 'failed' with the reason. It may have been delivered;
--      a retry could deliver it twice; a person decides. A posted row inside
--      the window is reclaimed like any other: the same key goes up again and
--      the provider dedupes it.
--   2. Every queued (or stale, unposted) row is checked against the audience
--      rule AS IT STANDS NOW: the recipient must still be named by
--      campaign_email_audience for their own store (members against
--      'marketing', subscribers against 'newsletter', both with the
--      campaign's preference), with a token, and the token in the row's
--      stored link must still be the current one — a spent link is a dead
--      link. Rows that fail are 'skipped' with the reason; a re-queue puts
--      them back only if the rule names them again. "Now" is this
--      statement's snapshot (read committed): a withdrawal that commits
--      while the claim is running is honoured by the next claim, not this
--      one — the seconds between the claim and the POST are not covered.
--
-- The signature gained p_posted_before. The old three-argument form is kept
-- one release as a wrapper (below), for a runner of the previous build still
-- mid-send when this file lands.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_posted_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_audience text;
  v_pref     text;
  settled    integer := 0;
  dropped    integer := 0;
  target     integer;
  claimed    jsonb;
begin
  -- 0. One claim at a time per campaign: the row lock is held until this
  --    statement's transaction ends, and the next claim starts from what
  --    this one committed.
  select c.audience,
         case when c.template = 'bulten-kampanya' then 'newsletter'
              else 'marketing' end
    into v_audience, v_pref
    from public.campaign_emails c
   where c.id = p_campaign
     for update;
  if v_audience is null then
    return '[]'::jsonb;
  end if;

  -- 1. Posted, never settled, window closed: failed, not re-posted.
  update public.campaign_email_sends s
     set status = 'failed',
         error  = 'sağlayıcı yanıtı teyit edilemedi'
   where s."campaignId" = p_campaign
     and s.status = 'sending'
     and s."claimedAt" < p_stale_before
     and s."postedAt" <> ''
     and s."postedAt" < p_posted_before;
  get diagnostics settled = row_count;

  -- 2. Consent, re-read now. A row already handed to the provider is left
  --    alone here: it is reclaimed (same key) or settled above, never mailed
  --    afresh.
  with ok as (
    select a.email, a.kind, a.token
      from public.campaign_email_audience('marketing', v_pref) a
    union all
    select a.email, a.kind, a.token
      from public.campaign_email_audience('newsletter', v_pref) a
  )
  update public.campaign_email_sends s
     set status      = 'skipped',
         error       = 'onay geri çekildi ya da kitle dışına çıktı',
         "claimedAt" = ''
   where s."campaignId" = p_campaign
     and s."postedAt" = ''
     and (s.status = 'queued'
          or (s.status = 'sending' and s."claimedAt" < p_stale_before))
     and not exists (
       select 1
         from ok
        where ok.email = s.email
          and ok.kind  = s."recipientKind"
          and ok.token <> ''
          and right(s."unsubUrl", length(ok.token)) = ok.token
     );
  get diagnostics dropped = row_count;

  if settled + dropped > 0 then
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
  end if;

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

-- ── campaign_email_claim(text, text, text) — one release of compatibility ─
-- A runner of the previous build still inside after() when this file lands
-- (up to 240 s) calls the three-argument claim; dropped, it would fail with
-- 42883 and its campaign would be patched 'failed' for a person to re-send
-- by hand. So the old signature stays for one release, as a wrapper. It
-- passes '' as p_posted_before: no timestamp sorts below '', so it settles
-- nothing as unconfirmed — the old runner never wrote postedAt, and a row
-- posted by the new build cannot have outlived the provider's window while
-- this file is fresh. Drop it in the next migration.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  return public.campaign_email_claim(p_campaign, p_stale_before, '', p_now);
end;
$$;

-- ── campaign_email_mark ───────────────────────────────────────────────────
-- As before — settles a claimed batch in one statement, p_ids in the batch's
-- e-mail order, counters refreshed from the rows — but only the rows of the
-- caller's OWN claim: p_claimed_at is the claimedAt the claim stamped, read
-- by the runner off the rows it was handed. A runner that stalled past the
-- stale window and whose batch was reclaimed by another finds nothing to
-- mark here; it can no longer settle rows another runner holds, nor mark as
-- sent rows it never delivered. The six-argument form from 20260908150000
-- stays one release for a runner of the previous build; drop it in the next
-- migration.
create or replace function public.campaign_email_mark(
  p_campaign text,
  p_batch integer,
  p_status text,
  p_ids jsonb,
  p_error text,
  p_now text,
  p_claimed_at text
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
       and s."claimedAt" = p_claimed_at
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
