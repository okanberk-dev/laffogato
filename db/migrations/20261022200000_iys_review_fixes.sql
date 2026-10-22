-- İYS fixes after the post-merge review of 20261022180000 (22 Ekim 2026).
--
-- 1. iys_apply_list: an imported list that shows ONAY no longer overwrites
--    a RET we registered. Only our own upload gives this brand an ONAY in
--    İYS, so such a list is older than our RET; overwriting it marked the
--    address ONAY, and a later consent was then neither uploaded (reconcile
--    step 4 skips iysStatus = 'ONAY') nor kept out of campaigns.
-- 2. iys_reconcile step 5: a RET that İYS refused is created again while
--    İYS (as far as we know) still holds ONAY for the address. Before, a
--    refused RET counted as done and İYS kept the ONAY of someone who had
--    refused.
-- 3. iys_export_events: a download holds at most ONE open event per
--    address (the oldest; the next waits for the next file). İYS refuses a
--    list with the same address twice (H194, docs/IYS.md), and an ONAY and
--    a RET in one file may be processed in either order. An event that an
--    earlier file carried beside an older one for the same address goes
--    back to pending.
-- 4. iys_retention: the outbox rows of an address whose consent ended more
--    than three years ago go, like the consent ledger's
--    (customer_consents_retention, the same published period). Before, they
--    were kept forever.
-- Functions only: re-applying the bundle replaces them with these bodies.

create or replace function public.iys_reconcile(
  p_now text,
  p_sources jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_launch     text;
  v_onay       integer := 0;
  v_ret        integer := 0;
  v_superseded integer := 0;
  v_n          integer := 0;
  v_result     jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('laffogato:iys_reconcile'));

  insert into public.iys_state (id, "launchedAt")
  values ('iys', p_now)
  on conflict (id) do nothing;
  select s."launchedAt" into v_launch
    from public.iys_state s
   where s.id = 'iys';

  -- 1. Active consents, the latest per address.
  if to_regclass('pg_temp.iys_desired') is not null then
    drop table pg_temp.iys_desired;
  end if;
  create temporary table iys_desired (
    email  text primary key,
    at     text not null,
    source text not null
  ) on commit drop;

  insert into pg_temp.iys_desired (email, at, source)
  select distinct on (g.email) g.email, g.at, coalesce(g.source, '')
    from (
      select lower(c.email) as email,
             greatest(c."marketingConsentAt", c."verifiedAt") as at,
             coalesce(
               p_sources ->> (
                 select l.source
                   from public.customer_consents l
                  where l."customerEmail" = lower(c.email)
                    and l.purpose = 'marketing'
                    and l.granted
                  order by l.id desc
                  limit 1
               ),
               p_sources ->> 'unknown-grant'
             ) as source
        from public.customers c
       where c."isActive"
         and c."emailVerified"
         and coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
         and c."marketingConsentAt" <> ''
         and c."deletionRequestedAt" is null
      union all
      select lower(s.email),
             s."consentAt",
             coalesce(
               case when s.source = 'account' then
                 p_sources ->> (
                   select l.source
                     from public.customer_consents l
                    where l."customerEmail" = lower(s.email)
                      and l.purpose = 'newsletter'
                      and l.granted
                    order by l.id desc
                    limit 1
                 )
               end,
               p_sources ->> ('subscriber:' || s.source),
               p_sources ->> 'unknown-grant'
             )
        from public.newsletter_subscribers s
       where s."isActive"
         and s."consentAt" <> ''
         and not exists (
           select 1
             from public.customers d
            where d."deletionRequestedAt" is not null
              and lower(d.email) = lower(s.email)
         )
    ) g
   where g.email <> ''
     and g.email not like '%@laffogato.local'
     and g.email not like '%@anon.local'
   order by g.email, g.at desc;

  -- 2a. Wants ONAY.
  insert into public.iys_recipients as r
    (email, "desiredStatus", "desiredAt", "desiredSource", "createdAt",
     "updatedAt")
  select d.email, 'ONAY', d.at, coalesce(d.source, ''), p_now, p_now
    from pg_temp.iys_desired d
  on conflict (email) do update
     set "desiredStatus" = 'ONAY',
         "desiredAt"     = excluded."desiredAt",
         "desiredSource" = excluded."desiredSource",
         "updatedAt"     = p_now
   where r."desiredStatus" <> 'ONAY'
      or r."desiredAt" <> excluded."desiredAt"
      or r."desiredSource" <> excluded."desiredSource";

  -- 2b. Wanted ONAY, no longer listed: NONE, from the withdrawal.
  --     A row an İYS list added (iys_apply_list) has no desired state
  --     yet ("desiredAt" = ''): it is worked out here the same way.
  with gone as (
    select r.email,
           case when r."desiredStatus" = 'ONAY' then r."desiredAt"
                else '' end as granted_at
      from public.iys_recipients r
     where (r."desiredStatus" = 'ONAY' or r."desiredAt" = '')
       and not exists (
         select 1 from pg_temp.iys_desired d where d.email = r.email
       )
  ),
  candidates as (
    select l."customerEmail" as email,
           l."createdAt" as at,
           case when l.source = 'account-deletion' and l.ip = ''
                then 'account-deletion/admin'
                else l.source end as key,
           0 as rank
      from public.customer_consents l
      join gone g on g.email = l."customerEmail"
     where not l.granted
    union all
    select lower(c.email), c."deletionRequestedAt", 'deletion-request', 0
      from public.customers c
      join gone g on g.email = lower(c.email)
     where c."deletionRequestedAt" is not null
    union all
    select lower(s.email),
           s."unsubscribedAt",
           case when s."unsubToken" = '' then 'subscriber-link'
                else 'subscriber-panel' end,
           case when s."unsubToken" = '' then 0 else 1 end
      from public.newsletter_subscribers s
      join gone g on g.email = lower(s.email)
     where not s."isActive"
       and s."unsubscribedAt" <> ''
  ),
  best as (
    select distinct on (g.email) g.email, c.at, c.key
      from gone g
      join candidates c
        on c.email = g.email
       and c.at > g.granted_at
     order by g.email, c.rank, c.at desc
  )
  update public.iys_recipients r
     set "desiredStatus" = 'NONE',
         "desiredAt"     = coalesce(b.at, p_now),
         "desiredSource" = coalesce(p_sources ->> b.key,
                                    p_sources ->> 'unknown-withdrawal',
                                    ''),
         "updatedAt"     = p_now
    from gone g
    left join best b on b.email = g.email
   where r.email = g.email;

  -- 3. Nothing to upload any more.
  update public.iys_events v
     set state       = 'superseded',
         "settledAt" = p_now,
         "settledBy" = 'system',
         note        = 'onay İYS''ye yüklenmeden geri çekildi'
    from public.iys_recipients r
   where r.email = v.email
     and r."desiredStatus" = 'NONE'
     and v.status = 'ONAY'
     and v.state = 'pending';
  get diagnostics v_n = row_count;
  v_superseded := v_superseded + v_n;

  update public.iys_events v
     set state       = 'superseded',
         "settledAt" = p_now,
         "settledBy" = 'system',
         note        = 'ret İYS''ye yüklenmeden yeni onay geldi'
    from public.iys_recipients r
   where r.email = v.email
     and r."desiredStatus" = 'ONAY'
     and v.status = 'RET'
     and v.state = 'pending';
  get diagnostics v_n = row_count;
  v_superseded := v_superseded + v_n;

  -- 4. ONAY to upload.
  insert into public.iys_events
    (email, status, source, "consentDate", "dueAt", state, legacy,
     "createdAt")
  select r.email,
         'ONAY',
         r."desiredSource",
         r."desiredAt",
         public.iys_add_business_days(r."desiredAt", 3),
         'pending',
         r."desiredAt" < v_launch,
         p_now
    from public.iys_recipients r
   where r."desiredStatus" = 'ONAY'
     and r."desiredAt" <> ''
     and r."iysStatus" <> 'ONAY'
     and (r."iysStatus" <> 'RET' or r."desiredAt" > r."iysConsentDate")
     and not exists (
       select 1
         from public.iys_events v
        where v.email = r.email
          and (
            (v.status = 'ONAY' and v.state in ('pending', 'exported'))
            or (v.status = 'RET' and v.state = 'exported')
            or (v.status = 'ONAY'
                and v.state in ('registered', 'rejected')
                and v."consentDate" >= r."desiredAt")
          )
     )
  on conflict do nothing;
  get diagnostics v_onay = row_count;

  -- 5. RET to upload.
  insert into public.iys_events
    (email, status, source, "consentDate", "dueAt", state, legacy,
     "createdAt")
  select r.email,
         'RET',
         r."desiredSource",
         r."desiredAt",
         public.iys_add_business_days(r."desiredAt", 3),
         'pending',
         r."desiredAt" < v_launch,
         p_now
    from public.iys_recipients r
   where r."desiredStatus" = 'NONE'
     and r."desiredAt" <> ''
     and (
       r."iysStatus" = 'ONAY'
       or exists (
         select 1
           from public.iys_events v
          where v.email = r.email
            and v.status = 'ONAY'
            and v.state = 'exported'
       )
     )
     and not exists (
       select 1
         from public.iys_events v
        where v.email = r.email
          and v.status = 'RET'
          and (
            v.state in ('pending', 'exported')
            or (v.state = 'registered'
                and v."consentDate" >= r."desiredAt")
            -- A refused RET is done only once İYS no longer holds ONAY:
            -- while it does, the refusal must reach İYS again
            -- (20261022200000).
            or (v.state = 'rejected'
                and v."consentDate" >= r."desiredAt"
                and r."iysStatus" <> 'ONAY')
          )
     )
  on conflict do nothing;
  get diagnostics v_ret = row_count;

  v_result := jsonb_build_object(
    'onay', v_onay,
    'ret', v_ret,
    'superseded', v_superseded,
    'launchedAt', v_launch
  );

  update public.iys_state s
     set "lastReconcileAt" = p_now,
         "lastReconcile"   = v_result
   where s.id = 'iys';

  return v_result;
end;
$$;

create or replace function public.iys_apply_list(
  p_onay jsonb,
  p_ret jsonb,
  p_by text,
  p_now text,
  p_summary jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_onay_listed integer := 0;
  v_onay_known  integer := 0;
  v_ret_listed  integer := 0;
  v_registered  integer := 0;
  v_superseded  integer := 0;
  v_n           integer := 0;
  v_result      jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('laffogato:iys_reconcile'));

  if to_regclass('pg_temp.iys_listed') is not null then
    drop table pg_temp.iys_listed;
  end if;
  create temporary table iys_listed (
    email  text primary key,
    status text not null
  ) on commit drop;

  insert into pg_temp.iys_listed (email, status)
  select distinct lower(btrim(x)), 'ONAY'
    from jsonb_array_elements_text(coalesce(p_onay, '[]'::jsonb)) x
   where btrim(x) <> ''
  on conflict (email) do nothing;
  -- A refusal wins over an approval listed for the same address.
  insert into pg_temp.iys_listed (email, status)
  select distinct lower(btrim(x)), 'RET'
    from jsonb_array_elements_text(coalesce(p_ret, '[]'::jsonb)) x
   where btrim(x) <> ''
  on conflict (email) do update set status = 'RET';

  select count(*) filter (where l.status = 'ONAY'),
         count(*) filter (where l.status = 'RET')
    into v_onay_listed, v_ret_listed
    from pg_temp.iys_listed l;

  -- ONAY, for addresses with a commercial-consent trace.
  insert into public.iys_recipients as r
    (email, "iysStatus", "iysConsentDate", "iysStatusAt", "createdAt",
     "updatedAt")
  select l.email, 'ONAY', '', p_now, p_now, p_now
    from pg_temp.iys_listed l
   where l.status = 'ONAY'
     and (
       exists (select 1 from public.iys_recipients k where k.email = l.email)
       or exists (
         select 1
           from public.newsletter_subscribers s
          where lower(s.email) = l.email
       )
       or exists (
         select 1
           from public.customer_consents c
          where c."customerEmail" = l.email
       )
     )
  on conflict (email) do update
     set "iysStatus"      = 'ONAY',
         "iysConsentDate" = case when r."iysStatus" = 'ONAY'
                                 then r."iysConsentDate" else '' end,
         "iysStatusAt"    = p_now,
         "updatedAt"      = p_now
   -- A RET we registered ourselves ("iysConsentDate" set) is not undone by
   -- a list that shows ONAY: only our own upload gives this brand an ONAY,
   -- so that list predates our RET (an old file, or İYS still processing
   -- the upload). Overwriting it let a later consent skip registration and
   -- be mailed while İYS held RET (20261022200000).
   where not (r."iysStatus" = 'RET' and r."iysConsentDate" <> '');
  get diagnostics v_onay_known = row_count;

  -- RET, for every listed address.
  insert into public.iys_recipients as r
    (email, "iysStatus", "iysConsentDate", "iysStatusAt", "createdAt",
     "updatedAt")
  select l.email, 'RET', '', p_now, p_now, p_now
    from pg_temp.iys_listed l
   where l.status = 'RET'
  on conflict (email) do update
     set "iysStatus"      = 'RET',
         "iysConsentDate" = case when r."iysStatus" = 'RET'
                                 then r."iysConsentDate" else '' end,
         "iysStatusAt"    = p_now,
         "updatedAt"      = p_now;

  -- The outbox against the list.
  update public.iys_events v
     set state       = 'registered',
         "settledAt" = p_now,
         "settledBy" = p_by,
         note        = 'İYS izin listesinde ' || l.status
    from pg_temp.iys_listed l
   where l.email = v.email
     and v.state = 'exported'
     and v.status = l.status;
  get diagnostics v_registered = row_count;

  update public.iys_events v
     set state       = 'superseded',
         "settledAt" = p_now,
         "settledBy" = p_by,
         note        = case
                         when v.state = 'exported'
                           then 'İYS izin listesinde RET'
                         else 'İYS''de zaten ' || l.status
                       end
    from pg_temp.iys_listed l
   where l.email = v.email
     and (
       (v.state = 'pending' and v.status = l.status)
       or (v.state = 'exported' and v.status = 'ONAY' and l.status = 'RET')
     );
  get diagnostics v_superseded = row_count;

  v_result := jsonb_build_object(
    'onayListed', v_onay_listed,
    'onayKnown', v_onay_known,
    'retListed', v_ret_listed,
    'registered', v_registered,
    'superseded', v_superseded
  );

  perform public.iys_record_check(
    'import', p_by, p_now, coalesce(p_summary, '{}'::jsonb) || v_result
  );

  return v_result;
end;
$$;

-- ── iys_export_events ─────────────────────────────────────────────────────
-- "İYS dosyasını indir" (src/lib/iys/store.ts exportIysEvents): stamps the
-- oldest open event of each address with the new file's id and returns
-- them; every other open event is pending again. Under the reconcile lock,
-- so a download never interleaves with a reconcile or a settle.
create or replace function public.iys_export_events(
  p_export_id text,
  p_now text
)
returns setof public.iys_events
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(p_export_id, '') = '' then
    raise exception 'iys_export_events: empty export id';
  end if;
  perform pg_advisory_xact_lock(hashtext('laffogato:iys_reconcile'));

  -- Open events that are not the oldest of their address wait for the
  -- next file.
  update public.iys_events v
     set state        = 'pending',
         "exportId"   = '',
         "exportedAt" = ''
   where v.state = 'exported'
     and exists (
       select 1
         from public.iys_events o
        where o.email = v.email
          and o.state in ('pending', 'exported')
          and (o."consentDate", o."createdAt", o.id)
              < (v."consentDate", v."createdAt", v.id)
     );

  return query
  update public.iys_events v
     set state        = 'exported',
         "exportId"   = p_export_id,
         "exportedAt" = p_now
   where v.state in ('pending', 'exported')
     and not exists (
       select 1
         from public.iys_events o
        where o.email = v.email
          and o.state in ('pending', 'exported')
          and (o."consentDate", o."createdAt", o.id)
              < (v."consentDate", v."createdAt", v.id)
     )
  returning v.*;
end;
$$;

-- ── iys_retention ─────────────────────────────────────────────────────────
-- The Veri Saklama period for commercial-mail consent and refusal records:
-- three years from the moment the consent stopped being valid. An address
-- is in scope once we want NONE for it since before p_cutoff and nothing
-- about it is newer: no open event (a RET still to report), no event
-- written or settled at or after p_cutoff. An address İYS still holds as
-- ONAY stays: its refusal is not reported yet. An address that still
-- consents is never in scope, however old its events.
--
-- Returns the rows counted (or deleted): the events, then the address.
-- p_apply false counts only.
create or replace function public.iys_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_events     integer := 0;
  v_recipients integer := 0;
begin
  if p_apply then
    delete from public.iys_events e
     using public.iys_recipients r
     where e.email = r.email
       and r."desiredStatus" = 'NONE'
       and r."desiredAt" <> ''
       and r."desiredAt" < p_cutoff
       and r."iysStatus" <> 'ONAY'
       and not exists (
         select 1
           from public.iys_events n
          where n.email = r.email
            and (n.state in ('pending', 'exported')
                 or n."createdAt" >= p_cutoff
                 or n."settledAt" >= p_cutoff)
       );
    get diagnostics v_events = row_count;
    delete from public.iys_recipients r
     where r."desiredStatus" = 'NONE'
       and r."desiredAt" <> ''
       and r."desiredAt" < p_cutoff
       and r."iysStatus" <> 'ONAY'
       and not exists (
         select 1 from public.iys_events n where n.email = r.email
       );
    get diagnostics v_recipients = row_count;
  else
    select count(*) into v_events
      from public.iys_events e
      join public.iys_recipients r on r.email = e.email
     where r."desiredStatus" = 'NONE'
       and r."desiredAt" <> ''
       and r."desiredAt" < p_cutoff
       and r."iysStatus" <> 'ONAY'
       and not exists (
         select 1
           from public.iys_events n
          where n.email = r.email
            and (n.state in ('pending', 'exported')
                 or n."createdAt" >= p_cutoff
                 or n."settledAt" >= p_cutoff)
       );
    select count(*) into v_recipients
      from public.iys_recipients r
     where r."desiredStatus" = 'NONE'
       and r."desiredAt" <> ''
       and r."desiredAt" < p_cutoff
       and r."iysStatus" <> 'ONAY'
       and not exists (
         select 1
           from public.iys_events n
          where n.email = r.email
            and (n.state in ('pending', 'exported')
                 or n."createdAt" >= p_cutoff
                 or n."settledAt" >= p_cutoff)
       );
  end if;
  return v_events + v_recipients;
end;
$$;
