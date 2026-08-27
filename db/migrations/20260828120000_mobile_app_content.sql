-- Mobile app home content, owned by the admin panel at /admin/mobil.
--
-- The mobile app's home screen shows a hero carousel and an announcements
-- strip. Both are editorial and change on a human timescale, so they belong in
-- the panel rather than in a release: swapping a seasonal slide must not need
-- an app store submission.
--
-- These tables are deliberately separate from `shop_hero_slides`. That table
-- drives the website's shop header and carries web-shaped fields (a full-width
-- imageUrl, an absolute ctaHref). The app needs a brand `tone` instead of an
-- image, and a route key the app resolves through an allow-list rather than an
-- arbitrary URL — a CMS-authored URL cannot be allowed to drive native
-- navigation.
--
-- NOTE: no `insert into public._migrations` line here. scripts/db-migrate.mjs
-- performs that insert itself, with no `on conflict`, inside the same
-- transaction — a duplicate from this file would roll the whole migration back.

create table if not exists public.app_hero_slides (
  id           text    primary key,
  eyebrow      text    not null default '',
  title        text    not null default '',
  body         text    not null default '',
  "ctaLabel"   text    not null default '',
  -- Route KEY, not a URL. The app maps it through an allow-list; an unknown
  -- value is a no-op rather than a crash.
  "ctaRoute"   text    not null default '',
  -- 'premium' | 'inverse' | 'brand' | 'paper' — see docs/THEME.md.
  tone         text    not null default 'paper',
  image        text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  -- ISO-8601; empty string means unbounded, matching the house convention.
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_hero_slides_active_idx
  on public.app_hero_slides ("isActive", "sortOrder");

create table if not exists public.app_announcements (
  id           text    primary key,
  -- 'info' | 'campaign' | 'hours'
  kind         text    not null default 'info',
  title        text    not null default '',
  body         text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_announcements_active_idx
  on public.app_announcements ("isActive", "sortOrder");

alter table public.app_hero_slides  enable row level security;
alter table public.app_announcements enable row level security;
