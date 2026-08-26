-- ── Editorial content tables (admin-managed) ──────────────────────────────
-- Reels, Press, Story timeline, Franchise packages + process. Mirrors the
-- shop_hero_slides convention: text PK, quoted camelCase columns, RLS on
-- (service role bypasses). Seeded from code on first read when empty.

-- ── reels ──────────────────────────────────────────────────────────────────
create table if not exists public.reels (
  id          text primary key,
  caption     text    not null default '',
  meta        text    not null default '',
  accent      text    not null default 'caramel',
  "videoUrl"  text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists reels_order_idx on public.reels ("sortOrder");

-- ── press ────────────────────────────────────────────────────────────────--
create table if not exists public.press (
  id          text primary key,
  name        text    not null default '',
  quote       text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists press_order_idx on public.press ("sortOrder");

-- ── story_timeline ──────────────────────────────────────────────────────--
create table if not exists public.story_timeline (
  id          text primary key,
  year        text    not null default '',
  title       text    not null default '',
  body        text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists story_timeline_order_idx on public.story_timeline ("sortOrder");

-- ── franchise_packages ────────────────────────────────────────────────────
create table if not exists public.franchise_packages (
  id          text primary key,
  name        text    not null default '',
  area        text    not null default '',
  seats       text    not null default '',
  invest      text    not null default '',
  monthly     text    not null default '',
  ideal       text    not null default '',
  includes    jsonb   not null default '[]'::jsonb,
  featured    boolean not null default false,
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists franchise_packages_order_idx on public.franchise_packages ("sortOrder");

-- ── franchise_process ──────────────────────────────────────────────────────
create table if not exists public.franchise_process (
  id          text primary key,
  step        text    not null default '',
  title       text    not null default '',
  body        text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists franchise_process_order_idx on public.franchise_process ("sortOrder");

-- ── RLS: enabled, no public policies (service role bypasses) ────────────────
alter table public.reels              enable row level security;
alter table public.press              enable row level security;
alter table public.story_timeline     enable row level security;
alter table public.franchise_packages enable row level security;
alter table public.franchise_process  enable row level security;
