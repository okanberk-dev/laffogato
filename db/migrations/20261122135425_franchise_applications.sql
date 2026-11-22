-- Franchise applications from the site's /franchise form (operator, 22 Kas
-- 2026: "franchise bölümü ekle form doldurulan ve açılır sectionlar dahil
-- tasarım metriklerine uyumlu olsun estetik yap").
--
--   franchise_applications   one row per application: who (name, e-mail,
--                            phone), where (il, ilçe), the five answers the
--                            form asks (location, budget band, experience,
--                            timeline, free note), what the panel did with
--                            it (status) and the KVKK notice the applicant
--                            ticked (consent: {at, ip, userAgent, version}).
--
-- Ids are `frn-0001` (next_seq('frn')). The answers are the option keys of
-- src/lib/franchise/franchise-core.ts; the panel prints their labels.
-- Written by the site's form (src/app/franchise/actions.ts), read and
-- changed only by the panel (/admin/franchise, section `leads`). Deleted 12
-- months after the application by the daily retention run
-- (src/lib/retention.ts, rule `franchise-applications`), as the form's
-- notice says.
--
-- New table only; nothing existing changes. Re-runnable.
--
-- Rollback (nothing else reads it):
--   drop table if exists public.franchise_applications;

create table if not exists public.franchise_applications (
  id                 text primary key,
  name               text not null,
  email              text not null,
  phone              text not null,
  city               text not null,
  district           text not null default '',
  "locationStatus"   text not null,
  budget             text not null,
  experience         text not null,
  timeline           text not null,
  message            text not null default '',
  status             text not null default 'new',
  consent            jsonb not null default '{}'::jsonb,
  "createdAt"        text not null,
  "updatedAt"        text not null,
  constraint franchise_applications_status_check
    check (status in ('new', 'contacted', 'archived')),
  constraint franchise_applications_location_check
    check ("locationStatus" in ('ready', 'searching', 'none')),
  constraint franchise_applications_budget_check
    check (budget in ('under-3m', '3m-6m', 'over-6m', 'undecided')),
  constraint franchise_applications_experience_check
    check (experience in ('none', 'food', 'retail', 'franchise')),
  constraint franchise_applications_timeline_check
    check (timeline in ('0-3', '3-6', '6-12', '12+'))
);

-- The panel's list: newest first, per status tab.
create index if not exists franchise_applications_status_idx
  on public.franchise_applications (status, "createdAt");
-- The retention sweep.
create index if not exists franchise_applications_created_idx
  on public.franchise_applications ("createdAt");

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.franchise_applications enable row level security;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
