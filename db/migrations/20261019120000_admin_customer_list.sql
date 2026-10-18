-- Müşteriler as one paged query (admin audit PEO-13, PEO-05; 18 Oct 2026).
--
-- The list read every member row (`select *`, addresses and all) and every
-- order, merged them in JavaScript and wrote the whole result into the page
-- twice (phone cards and the desktop table). With a few thousand members
-- that was one endless, heavy page; and its search lower-cased without the
-- Turkish rules, so "ismail" never found "İsmail".
--
-- Now the database does the merge, the search, the sort and the paging, and
-- the page receives one page of rows plus the tab counts:
--
--   admin_fold_tr(text)       The panel's Turkish search fold, the same
--                             letters as TR_FOLD_SQL_FROM / TR_FOLD_SQL_TO in
--                             src/lib/admin/text-fold.ts (U+0307 written as
--                             chr(775)): İ, I and ı meet as i, the other
--                             Turkish capitals are lowered by translate()
--                             itself, so the "C" collation folds them too.
--                             The search pattern arrives already folded by
--                             foldTr() in TypeScript.
--   admin_sort_tr(text)       A sort key in Turkish alphabet order under the
--                             "C" collation: ç after c, ğ after g, ı between
--                             h and i, ö after o, ş after s, ü after u.
--   admin_customer_rows(...)  One row per customer: a member account and the
--                             roll-up of the orders under the same address,
--                             or the roll-up alone for a guest. The rule is
--                             summarizeCustomers / customerLifetime in
--                             src/lib/admin/store.ts: order count, spend and
--                             refunds leave out abandoned checkouts and
--                             cancelled orders (the reports' rule), the last
--                             order of any status dates the activity, the
--                             newest order's name and phone stand in for a
--                             member's empty ones. A closed account
--                             (`deleted-…@anon.local`, decision D13) and the
--                             till's `guest@laffogato.local` are left out.
--                             Filters: search (folded substring of address,
--                             name or phone, or the phone's digits), the
--                             member's commercial consent and verification.
--   admin_customer_page(...)  One page of those rows for a tab (all,
--                             members, guests, inactive), sorted by last
--                             activity, name, order count or spend; the
--                             address breaks ties so a page boundary never
--                             splits or repeats a customer.
--   admin_customer_counts(...) Per tab: customers, paid orders, spend and
--                             refunds under the same filters, for the tab
--                             badges and the summary tiles.
--
-- A new tab or column (the account deletion request, for one) is a new
-- migration that drops and recreates these: RETURNS TABLE cannot change its
-- columns in place.
--
-- Read-only, additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

create or replace function public.admin_fold_tr(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(p_text, ''),
                         'İIıÇŞĞÖÜÂÎÛ' || chr(775),
                         'iiiçşğöüâîû'))
$$;

create or replace function public.admin_sort_tr(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(replace(
           lower(translate(coalesce(p_text, ''),
                           'İIÇĞÖŞÜÂÎÛâîû',
                           'iıçğöşüaiuaiu')),
           'ç', 'c~'), 'ğ', 'g~'), 'ı', 'h~'), 'ö', 'o~'), 'ş', 's~'), 'ü', 'u~')
$$;

create or replace function public.admin_customer_rows(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text
)
returns table (
  email                text,
  name                 text,
  phone                text,
  "isMember"           boolean,
  "isActive"           boolean,
  "emailVerified"      boolean,
  "memberSince"        text,
  "marketingConsent"   boolean,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint,
  "lastOrderAt"        text,
  "lastActivity"       text
)
language sql
stable
set search_path = ''
as $$
  with ord as (
    select lower(btrim(o."customerEmail")) as key,
           o.status not in ('pending_payment', 'cancelled') as counts,
           o."totalMinor"::bigint as total,
           coalesce((
             select sum(case when jsonb_typeof(r -> 'amountMinor') = 'number'
                             then (r ->> 'amountMinor')::numeric
                             else 0 end)
               from jsonb_array_elements(
                      case when jsonb_typeof(o.refunds) = 'array'
                           then o.refunds
                           else '[]'::jsonb end) as r
           ), 0)::bigint as refunded,
           o."createdAt" as at,
           o."orderNo" as no,
           o."customerName" as cname,
           o."customerPhone" as cphone
      from public.orders o
     where btrim(o."customerEmail") <> ''
       and lower(btrim(o."customerEmail")) <> 'guest@laffogato.local'
       and lower(btrim(o."customerEmail")) not like '%@anon.local'
  ),
  rolled as (
    select ord.key,
           count(*) filter (where ord.counts) as n,
           coalesce(sum(ord.total) filter (where ord.counts), 0)::bigint as v,
           coalesce(sum(ord.refunded) filter (where ord.counts), 0)::bigint
             as refunded,
           max(ord.at) as last_at,
           (array_agg(ord.cname order by ord.at desc, ord.no desc)
              filter (where ord.cname <> ''))[1] as cname,
           (array_agg(ord.cphone order by ord.at desc, ord.no desc)
              filter (where ord.cphone <> ''))[1] as cphone
      from ord
     group by ord.key
  ),
  members as (
    select lower(btrim(c.email)) as key,
           c.email,
           c.name,
           c.phone,
           c."isActive",
           c."emailVerified",
           c."createdAt",
           (coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
            and c."marketingConsentAt" <> '') as consent
      from public.customers c
     where lower(btrim(c.email)) not like '%@anon.local'
  ),
  merged as (
    select coalesce(m.email, r.key) as email,
           coalesce(nullif(m.name, ''), r.cname, '') as name,
           coalesce(nullif(m.phone, ''), r.cphone, '') as phone,
           m.key is not null as is_member,
           coalesce(m."isActive", true) as is_active,
           coalesce(m."emailVerified", false) as verified,
           coalesce(m."createdAt", '') as member_since,
           coalesce(m.consent, false) as consent,
           coalesce(r.n, 0)::bigint as n,
           coalesce(r.v, 0)::bigint as v,
           coalesce(r.refunded, 0)::bigint as refunded,
           coalesce(r.last_at, '') as last_at,
           coalesce(nullif(r.last_at, ''), m."createdAt", '') as activity
      from members m
      full outer join rolled r on r.key = m.key
  )
  select x.email,
         x.name,
         x.phone,
         x.is_member,
         x.is_active,
         x.verified,
         x.member_since,
         x.consent,
         x.n,
         x.v,
         x.refunded,
         x.last_at,
         x.activity
    from merged x
   where (coalesce(p_search, '') = ''
          or public.admin_fold_tr(x.email) like '%' || p_search || '%'
          or public.admin_fold_tr(x.name) like '%' || p_search || '%'
          or public.admin_fold_tr(x.phone) like '%' || p_search || '%'
          or (coalesce(p_digits, '') <> ''
              and regexp_replace(x.phone, '[^0-9]', '', 'g')
                    like '%' || p_digits || '%'))
     and (coalesce(p_consent, '') = ''
          or (x.is_member and x.consent = (p_consent = 'yes')))
     and (coalesce(p_verified, '') = ''
          or (x.is_member and x.verified = (p_verified = 'yes')))
$$;

create or replace function public.admin_customer_page(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text,
  p_kind     text,
  p_sort     text,
  p_desc     boolean,
  p_limit    integer,
  p_offset   integer
)
returns table (
  email                text,
  name                 text,
  phone                text,
  "isMember"           boolean,
  "isActive"           boolean,
  "emailVerified"      boolean,
  "memberSince"        text,
  "marketingConsent"   boolean,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint,
  "lastOrderAt"        text,
  "lastActivity"       text
)
language sql
stable
set search_path = ''
as $$
  select r.email,
         r.name,
         r.phone,
         r."isMember",
         r."isActive",
         r."emailVerified",
         r."memberSince",
         r."marketingConsent",
         r."orderCount",
         r."lifetimeValueMinor",
         r."refundedMinor",
         r."lastOrderAt",
         r."lastActivity"
    from public.admin_customer_rows(p_search, p_digits, p_consent, p_verified) r
   -- The same tabs as admin_customer_counts.
   where case coalesce(p_kind, '')
           when 'members'  then r."isMember"
           when 'guests'   then not r."isMember"
           when 'inactive' then r."isMember" and not r."isActive"
           else true
         end
   order by
     -- A row without a name sorts after the named ones, either way.
     case when p_sort = 'name' then r.name = '' end,
     -- In Turkish alphabet order, whatever the database's collation.
     case when p_sort = 'name' and not p_desc
          then public.admin_sort_tr(r.name) collate pg_catalog."C"
     end asc,
     case when p_sort = 'name' and p_desc
          then public.admin_sort_tr(r.name) collate pg_catalog."C"
     end desc,
     case when p_sort = 'orders' and not p_desc then r."orderCount" end asc,
     case when p_sort = 'orders' and p_desc then r."orderCount" end desc,
     case when p_sort = 'value' and not p_desc
          then r."lifetimeValueMinor" end asc,
     case when p_sort = 'value' and p_desc
          then r."lifetimeValueMinor" end desc,
     case when coalesce(p_sort, '') not in ('name', 'orders', 'value')
               and not p_desc
          then r."lastActivity" end asc,
     r."lastActivity" desc,
     lower(r.email) asc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
   offset greatest(0, coalesce(p_offset, 0))
$$;

create or replace function public.admin_customer_counts(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text
)
returns table (
  kind                 text,
  customers            bigint,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint
)
language sql
stable
set search_path = ''
as $$
  with r as (
    select *
      from public.admin_customer_rows(p_search, p_digits, p_consent, p_verified)
  )
  select k.kind,
         count(r.email)::bigint,
         coalesce(sum(r."orderCount"), 0)::bigint,
         coalesce(sum(r."lifetimeValueMinor"), 0)::bigint,
         coalesce(sum(r."refundedMinor"), 0)::bigint
    from (values ('all'), ('members'), ('guests'), ('inactive')) as k(kind)
    -- The same tabs as admin_customer_page.
    left join r
      on case k.kind
           when 'members'  then r."isMember"
           when 'guests'   then not r."isMember"
           when 'inactive' then r."isMember" and not r."isActive"
           else true
         end
   group by k.kind
$$;
