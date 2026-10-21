-- No commercial mail to a member who asked for their account to be deleted.
--
-- Until 18 Oct 2026 the site deleted an account on the member's click, and
-- `deleteMe` switched marketing and the bulletin off in the same second. Now
-- /uye/hesap/sil only opens a request (`customers."deletionRequestedAt"`,
-- 20261018090000) and the team closes the account within thirty days (KVKK
-- m.13/2). In that window the campaign audience and the birthday greeting
-- still named the member.
--
-- 6563 m.8/3 has the sender stop within three working days of a refusal,
-- and the site's own İleti onayı text says ending the membership ends the
-- consent with no separate request. A request to delete the account is read
-- as that refusal from the moment it arrives. Reversible: nothing in the
-- consent record changes, so a member who takes the request back
-- (`withdrawDeletionRequest` clears the stamp) is in the audience again.
--
-- Both functions are the 20260923230300_email_suppressions versions, with
-- one more clause each. Subscriber rows under the same address are left out
-- too: the closure deletes that subscription with the account. The coupon
-- stays (an account right, not a message); only the greeting's mail flag
-- turns false. The count, the enqueue and the claim all read the audience,
-- so a request opened after a campaign was queued is honoured when its batch
-- is claimed.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── campaign_email_audience ─────────────────────────────────────────────
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
       and not exists (
         select 1
           from public.customers d
          where d."deletionRequestedAt" is not null
            and lower(d.email) = e.email
       )
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- ── birthday_greeting_audience ──────────────────────────────────────────
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
            and c."deletionRequestedAt" is null
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
