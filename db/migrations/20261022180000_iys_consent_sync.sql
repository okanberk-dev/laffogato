-- İYS (İleti Yönetim Sistemi): the outbox that registers commercial e-mail
-- consents and refusals in İYS, with a manual transport (22 Oct 2026).
--
-- The legal texts said consents are registered in İYS, refusals are
-- reported to it and İYS is checked before a campaign; nothing in the code
-- did any of it (docs/AUDIT.md, "Kampanya e-postası İYS'ye bağlı değil").
-- Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik, as
-- amended in 2020: a consent obtained outside İYS is registered in İYS
-- within three business days or it cannot be relied on; a refusal that
-- reaches the sender stops the mail and is reported to İYS within three
-- business days; a refusal made on İYS itself is honoured too.
--
-- A sender with fewer than 250,000 addresses cannot call the İYS API; it
-- needs a paid integrator or uploads by hand on İYS Web (hs.iys.org.tr).
-- The operator has no integrator, so the transport is MANUAL: /admin/iys
-- says what to upload and by when, and hands over a file in İYS's own
-- column order. Every row below already carries exactly the fields of
-- İYS's `POST /sps/{iysCode}/brands/{brandCode}/consents`, so an integrator
-- adapter only posts the pending rows and marks them (docs/IYS.md).
--
--   iys_recipients   one row per address (lower-cased) that has, or had,
--                    a commercial consent here: what we want İYS to hold
--                    (desired ONAY or NONE, from when, from which channel)
--                    and what we know İYS holds ('' unknown, ONAY, RET).
--                    The campaign audience requires "iysStatus" = 'ONAY'
--                    (20261022180100_iys_send_gate.sql).
--   iys_events       the outbox. One row per thing to tell İYS: status
--                    ONAY or RET, the İYS `source`, the `consentDate` the
--                    upload carries and the deadline ("dueAt", consentDate
--                    plus three business days). state:
--                      pending     not in a file yet
--                      exported    in a downloaded file, not confirmed
--                      registered  the operator confirmed the upload
--                      rejected    İYS refused it (note: the İYS code)
--                      superseded  nothing to upload any more
--                    At most one OPEN (pending or exported) event per
--                    address and status: a partial unique index, so two
--                    reconciles at once cannot both add one.
--                    `legacy`: the consent instant predates this file
--                    (iys_state."launchedAt"); İYS's three-business-day
--                    window has closed and it may answer H467.
--   iys_state        one row (id 'iys'): when this went live, and the last
--                    İYS refusal check (an import of İYS's consent list, or
--                    the operator's "İYS'de yeni ret yok" attestation): a
--                    commercial send needs one within three business days.
--
-- Business days are counted CONSERVATIVELY on the köşk's clock (UTC+3 all
-- year, CLAUDE.md rule 22): Monday to Friday, public holidays NOT skipped.
-- A holiday only lengthens the legal deadline, so ignoring holidays makes
-- ours earlier or equal, never later. iys_add_business_days mirrors
-- src/lib/iys/iys-core.ts addIstanbulBusinessDays; the integration test
-- holds the two together.
--
-- iys_reconcile(p_now, p_sources) recomputes the desired state from the
-- consent stores (customers, newsletter_subscribers, the customer_consents
-- ledger) and adds or supersedes events. `p_sources` maps where a consent
-- or a refusal came from to İYS's `source` value; the map lives in
-- iys-core.ts (IYS_SOURCE_MAP) and is passed in, so the rule has one home.
-- It never emits ONAY over ONAY or RET over RET (İYS refuses both), never a
-- second event for a consent İYS already registered or refused, and never
-- an ONAY while a RET for the same address may be on its way to İYS.
--
-- The rows keep the address after an account is closed, like the consent
-- ledger: they are the record of the refusal and of its report to İYS.
--
-- Row level security on, no policy, like every other table. Re-runnable.
-- Rollback:
--   drop function if exists public.iys_apply_list(jsonb, jsonb, text, text, jsonb);
--   drop function if exists public.iys_settle_export(text, text, text);
--   drop function if exists public.iys_record_check(text, text, text, jsonb);
--   drop function if exists public.iys_reconcile(text, jsonb);
--   drop function if exists public.iys_add_business_days(text, integer);
--   drop table if exists public.iys_events;
--   drop table if exists public.iys_recipients;
--   drop table if exists public.iys_state;
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── iys_recipients ────────────────────────────────────────────────────────
create table if not exists public.iys_recipients (
  email            text primary key,
  "desiredStatus"  text not null default 'NONE',
  "desiredAt"      text not null default '',
  "desiredSource"  text not null default '',
  "iysStatus"      text not null default '',
  "iysConsentDate" text not null default '',
  "iysStatusAt"    text not null default '',
  "createdAt"      text not null,
  "updatedAt"      text not null,
  constraint iys_recipients_email
    check (email <> '' and email = lower(email)),
  constraint iys_recipients_desired
    check ("desiredStatus" in ('ONAY', 'NONE')),
  constraint iys_recipients_iys_status
    check ("iysStatus" in ('', 'ONAY', 'RET'))
);

create index if not exists iys_recipients_iys_status_idx
  on public.iys_recipients ("iysStatus");

alter table public.iys_recipients enable row level security;

-- ── iys_events ────────────────────────────────────────────────────────────
create table if not exists public.iys_events (
  id            bigint generated always as identity primary key,
  email         text    not null,
  status        text    not null,
  source        text    not null,
  "consentDate" text    not null,
  "dueAt"       text    not null default '',
  state         text    not null default 'pending',
  "exportId"    text    not null default '',
  "exportedAt"  text    not null default '',
  "settledAt"   text    not null default '',
  "settledBy"   text    not null default '',
  note          text    not null default '',
  legacy        boolean not null default false,
  "createdAt"   text    not null,
  constraint iys_events_email check (email <> '' and email = lower(email)),
  constraint iys_events_status check (status in ('ONAY', 'RET')),
  constraint iys_events_state
    check (state in ('pending', 'exported', 'registered', 'rejected',
                     'superseded')),
  constraint iys_events_note check (length(note) <= 300)
);

create unique index if not exists iys_events_one_open_idx
  on public.iys_events (email, status)
  where state in ('pending', 'exported');

create index if not exists iys_events_email_idx
  on public.iys_events (email, id);

create index if not exists iys_events_open_due_idx
  on public.iys_events ("dueAt")
  where state in ('pending', 'exported');

create index if not exists iys_events_export_idx
  on public.iys_events ("exportId")
  where "exportId" <> '';

alter table public.iys_events enable row level security;

-- ── iys_state ─────────────────────────────────────────────────────────────
create table if not exists public.iys_state (
  id                text primary key,
  "launchedAt"      text  not null,
  "lastCheckAt"     text  not null default '',
  "lastCheckBy"     text  not null default '',
  "lastCheckKind"   text  not null default '',
  "lastImport"      jsonb not null default '{}'::jsonb,
  "lastReconcileAt" text  not null default '',
  "lastReconcile"   jsonb not null default '{}'::jsonb,
  constraint iys_state_one_row check (id = 'iys'),
  constraint iys_state_check_kind
    check ("lastCheckKind" in ('', 'import', 'attest'))
);

alter table public.iys_state enable row level security;

-- The moment this went live: every consent older than it is `legacy`.
insert into public.iys_state (id, "launchedAt")
values (
  'iys',
  to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
on conflict (id) do nothing;

-- ── iys_add_business_days ─────────────────────────────────────────────────
-- p_at plus p_days business days, on the köşk's wall clock (UTC+3): step a
-- day at a time, count only Monday to Friday, keep the time of day. A
-- Saturday 10:00 consent is due Wednesday 10:00; a Friday 20:00 one,
-- Wednesday 20:00. Holidays are not skipped (see the header). '' for an
-- empty or unreadable instant.
create or replace function public.iys_add_business_days(
  p_at text,
  p_days integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  wall timestamp;
  n    integer := 0;
begin
  if p_at is null or p_at = '' then
    return '';
  end if;
  begin
    wall := (p_at::timestamptz at time zone 'UTC') + interval '3 hours';
  exception when others then
    return '';
  end;
  while n < p_days loop
    wall := wall + interval '1 day';
    if extract(isodow from wall) < 6 then
      n := n + 1;
    end if;
  end loop;
  return to_char(wall - interval '3 hours', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
end;
$$;

-- ── iys_reconcile ─────────────────────────────────────────────────────────
-- One run at a time (a transaction-scoped advisory lock), in five steps:
--
--   1. The addresses with an active commercial consent NOW, each with its
--      LATEST active consent instant and the channel it came from:
--        - a member's `marketing`: on, "marketingConsentAt" set, active,
--          verified, no deletion request. The instant is the later of the
--          consent and the e-mail verification (the address was not proven
--          to be the member's before it, as the bulletin's double opt-in
--          dates its consent at the confirmation); the channel is the
--          ledger's latest grant.
--        - an active bulletin row with "consentAt" (members' `newsletter`
--          lives on this row too), no deletion request on the address.
--      Same exclusions as the campaign audience: @laffogato.local and
--      @anon.local are never registered.
--   2. iys_recipients follows: those addresses want ONAY; an address that
--      wanted ONAY and is no longer listed wants NONE from its withdrawal:
--      the latest refusal after the consent (the ledger, a deletion
--      request, a bulletin unsubscribe; a panel deactivation only when
--      nothing else says), else p_now. An address already at NONE keeps
--      the instant it got then.
--   3. A pending (never exported) ONAY of an address that wants NONE is
--      superseded: nothing to upload. A pending RET of an address that
--      wants ONAY again is superseded: İYS was never told.
--   4. ONAY event: wants ONAY, İYS not known to hold ONAY, no open ONAY, no
--      RET in a downloaded file (İYS may hold RET: the new ONAY waits until
--      that settles), no registered or rejected ONAY for this consent or a
--      later one, and, when İYS holds a RET with a date, a consent after it.
--   5. RET event: wants NONE, İYS holds ONAY (or an ONAY is in a
--      downloaded file and may be there), no open RET, no registered or
--      rejected RET for this withdrawal or a later one. A refusal İYS
--      reported to us (an import) has already set "iysStatus" = 'RET', so
--      it produces no event.
--
-- Returns the counts as jsonb; the run is recorded on iys_state.
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
            or (v.state in ('registered', 'rejected')
                and v."consentDate" >= r."desiredAt")
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

-- ── iys_record_check ──────────────────────────────────────────────────────
-- The last İYS refusal check: an import of İYS's consent list ('import',
-- with its counts) or the operator's attestation that İYS shows no refusal
-- the site has not applied ('attest'). A commercial send needs one within
-- three business days (src/lib/iys/gate.ts).
create or replace function public.iys_record_check(
  p_kind text,
  p_by text,
  p_now text,
  p_summary jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_kind not in ('import', 'attest') then
    raise exception 'iys_record_check: unknown kind %', p_kind;
  end if;
  insert into public.iys_state as s
    (id, "launchedAt", "lastCheckAt", "lastCheckBy", "lastCheckKind",
     "lastImport")
  values (
    'iys', p_now, p_now, p_by, p_kind,
    case when p_kind = 'import' then coalesce(p_summary, '{}'::jsonb)
         else '{}'::jsonb end
  )
  on conflict (id) do update
     set "lastCheckAt"   = p_now,
         "lastCheckBy"   = p_by,
         "lastCheckKind" = p_kind,
         "lastImport"    = case when p_kind = 'import'
                                then coalesce(p_summary, '{}'::jsonb)
                                else s."lastImport" end;
end;
$$;

-- ── iys_settle_export ─────────────────────────────────────────────────────
-- "İYS'ye yüklendi" for one downloaded file: its events still 'exported'
-- become 'registered', and each address's İYS record becomes the latest of
-- them (an ONAY and a later RET in one file leave RET). Returns how many
-- events it settled; a file settled twice settles nothing the second time.
create or replace function public.iys_settle_export(
  p_export_id text,
  p_by text,
  p_now text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if coalesce(p_export_id, '') = '' then
    return 0;
  end if;
  perform pg_advisory_xact_lock(hashtext('laffogato:iys_reconcile'));

  with settled as (
    update public.iys_events v
       set state       = 'registered',
           "settledAt" = p_now,
           "settledBy" = p_by
     where v."exportId" = p_export_id
       and v.state = 'exported'
    returning v.id, v.email, v.status, v."consentDate"
  ),
  latest as (
    select distinct on (s.email) s.email, s.status, s."consentDate"
      from settled s
     order by s.email, s."consentDate" desc, s.id desc
  ),
  known as (
    insert into public.iys_recipients as r
      (email, "iysStatus", "iysConsentDate", "iysStatusAt", "createdAt",
       "updatedAt")
    select l.email, l.status, l."consentDate", p_now, p_now, p_now
      from latest l
    on conflict (email) do update
       set "iysStatus"      = excluded."iysStatus",
           "iysConsentDate" = excluded."iysConsentDate",
           "iysStatusAt"    = p_now,
           "updatedAt"      = p_now
    returning r.email
  )
  select count(*) into n from settled;
  return n;
end;
$$;

-- ── iys_apply_list ────────────────────────────────────────────────────────
-- An import of İYS's consent list (İYS Web's export, read by
-- src/lib/iys/iys-core.ts parseIysConsentList): what İYS holds for each
-- listed address. The application has already applied every NEW refusal to
-- the consent stores through the existing consent functions (ledger source
-- 'iys') before this runs; this only records what İYS holds and settles the
-- outbox against it:
--   ONAY  "iysStatus" = 'ONAY' for an address we have a commercial-consent
--         trace for (an iys_recipients row, a bulletin row, a ledger row);
--         a stranger's ONAY is counted and ignored. A downloaded ONAY is
--         registered; a pending one is superseded (İYS already holds ONAY).
--         No local consent is ever created from it: consent comes from the
--         person, through our own forms.
--   RET   "iysStatus" = 'RET' for every listed address. A downloaded ONAY
--         is superseded (İYS shows RET), a downloaded RET registered, a
--         pending RET superseded.
-- Then the check is recorded (iys_record_check, kind 'import'). Returns the
-- counts.
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
         "updatedAt"      = p_now;
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
