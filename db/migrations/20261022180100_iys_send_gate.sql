-- No commercial e-mail to an address whose consent is not registered in İYS
-- (22 Oct 2026).
--
-- Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik, as
-- amended in 2020: a consent obtained outside İYS that is not registered in
-- İYS within three business days cannot be relied on. The campaign audience
-- used to read only our own consent stores; it now also requires that İYS
-- holds ONAY for the address, as far as we know (iys_recipients."iysStatus",
-- set when the operator confirms an upload or imports İYS's consent list,
-- 20261022180000_iys_consent_sync.sql), and that no refusal for the address
-- sits in a downloaded file waiting to be confirmed (İYS may already hold
-- that RET: a person who withdrew and then consented again is mailed only
-- once İYS has the new ONAY).
--
-- Both functions are the 20261018090100_deletion_request_commercial_mail
-- versions with these two clauses added and nothing taken away. The count,
-- the enqueue and the claim all read campaign_email_audience, so a campaign
-- queued before this file, or an address whose İYS record changes after the
-- queue, is re-checked when its batch is claimed. The birthday coupon stays
-- (an account right, not a message); only the greeting's mail flag needs
-- the İYS registration too.
--
-- The other half of the gate is in the application: no commercial send
-- while the last İYS refusal check is older than three business days
-- (src/lib/iys/gate.ts).
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
       and exists (
         select 1
           from public.iys_recipients r
          where r.email = e.email
            and r."iysStatus" = 'ONAY'
       )
       and not exists (
         select 1
           from public.iys_events v
          where v.email = e.email
            and v.status = 'RET'
            and v.state = 'exported'
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
            )
            and exists (
              select 1
                from public.iys_recipients r
               where r.email = lower(c.email)
                 and r."iysStatus" = 'ONAY'
            )
            and not exists (
              select 1
                from public.iys_events v
               where v.email = lower(c.email)
                 and v.status = 'RET'
                 and v.state = 'exported'
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
