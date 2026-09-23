-- Bounce and complaint suppression for commercial mail (docs/AUDIT.md,
-- "İYS kaydı, bounce/şikâyet bastırma listesi ... açık").
--
-- Resend reports a permanent bounce (email.bounced) and a spam complaint
-- (email.complained) over a Svix-signed webhook, POST /api/webhooks/resend.
-- The route records the address here; the campaign audience and the birthday
-- greeting's commercial flag leave it out from then on. Mailing a dead
-- address again hurts the sending domain's reputation for every member, and
-- mailing someone who marked the last campaign as spam is the complaint the
-- law and the inbox providers both punish.
--
-- Scope is COMMERCIAL mail only. Order, shipping and password mail are not
-- read through these functions and are not affected: a person who flagged a
-- campaign still gets their receipt.
--
-- Inert until the operator sets RESEND_WEBHOOK_SECRET and registers the
-- endpoint in the Resend dashboard: with the table empty, both functions
-- below return exactly what they returned before.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── email_suppressions ──────────────────────────────────────────────────
-- One row per address (lower-cased). `reason` is the latest event's kind,
-- 'bounced' or 'complained'; either one suppresses. `createdAt` is the first
-- event, `updatedAt` the latest - the retention sweep measures from the
-- latest, so an address that keeps bouncing keeps its row.
create table if not exists public.email_suppressions (
  email             text primary key,
  reason            text not null default '',
  detail            text not null default '',
  "providerEventId" text not null default '',
  "providerEmailId" text not null default '',
  "createdAt"       text not null default '',
  "updatedAt"       text not null default ''
);

create index if not exists email_suppressions_updated_idx
  on public.email_suppressions ("updatedAt");

alter table public.email_suppressions enable row level security;

-- ── email_suppression_record ────────────────────────────────────────────
-- Upsert that keeps the first-seen time. The query builder's upsert writes
-- every column it is given, which would move createdAt on each repeat event.
-- A replayed webhook (same svix-id) changes nothing but updatedAt.
create or replace function public.email_suppression_record(
  p_email text,
  p_reason text,
  p_detail text,
  p_event_id text,
  p_email_id text,
  p_now text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_reason not in ('bounced', 'complained') then
    raise exception 'email_suppression_record: unknown reason %', p_reason;
  end if;
  if coalesce(btrim(p_email), '') = '' then
    return;
  end if;
  insert into public.email_suppressions as x
    (email, reason, detail, "providerEventId", "providerEmailId",
     "createdAt", "updatedAt")
  values
    (lower(btrim(p_email)), p_reason, left(coalesce(p_detail, ''), 300),
     coalesce(p_event_id, ''), coalesce(p_email_id, ''), p_now, p_now)
  on conflict (email) do update
     set reason            = excluded.reason,
         detail            = excluded.detail,
         "providerEventId" = excluded."providerEventId",
         "providerEmailId" = excluded."providerEmailId",
         "updatedAt"       = excluded."updatedAt";
end;
$$;

-- ── campaign_email_audience ─────────────────────────────────────────────
-- THE audience rule from 20260908170000_campaign_email_reconsent, unchanged
-- but for the last line: a suppressed address is not named. The count, the
-- enqueue and the claim all read this function, so a suppression that lands
-- after a campaign was queued is honoured when its batch is claimed (the row
-- is skipped with the usual "kitle dışına çıktı" reason).
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
     where not exists (
       select 1
         from public.email_suppressions x
        where x.email = e.email
     )
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- ── birthday_greeting_audience ──────────────────────────────────────────
-- As in 20260916140000_birthday_mail_and_scheduled_campaigns, but the
-- `marketing` flag (= "may be sent the greeting mail") is false for a
-- suppressed address. The coupon is an account right, not a message, and is
-- still granted: the row stays in the result.
create or replace function public.birthday_greeting_audience(
  p_month_days jsonb
)
returns table (email text, name text, marketing boolean)
language plpgsql
set search_path = ''
as $$
begin
  return query
    select lower(c.email) as email,
           c.name         as name,
           (coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
            and c."marketingConsentAt" <> ''
            and not exists (
              select 1
                from public.email_suppressions x
               where x.email = lower(c.email)
            )) as marketing
      from public.customers c
     where c."isActive"
       and c."emailVerified"
       and length(c.birthday) >= 5
       and right(c.birthday, 5) in (
             select jsonb_array_elements_text(p_month_days)
           )
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local'
     order by lower(c.email);
end;
$$;
