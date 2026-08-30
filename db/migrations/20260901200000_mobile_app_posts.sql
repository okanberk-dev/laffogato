-- Mobile app home "posts": campaigns, collaborations and events.
--
-- The hero carousel is the brand's own voice — a handful of editorial panels in
-- the house tones. This is the other thing a coffee app's home screen carries:
-- a horizontally scrollable strip of image-first cards for a campaign, a
-- collaboration with another brand, or a one-off event.
--
-- Separate from app_hero_slides on purpose. A hero slide has a `tone` and a
-- route KEY and no image; a post is image-first and may point OUTWARD (an
-- Instagram collaboration, a ticket page). Folding both into one table would
-- have meant a nullable half on every row and — worse — one navigation path
-- shared by two very different trust levels.
--
-- `linkUrl` is the only place in the mobile content model where panel-authored
-- text becomes a destination. It is constrained to https at write time by
-- normalizeAppPost(), and the app opens it in an in-app browser rather than
-- resolving it as a native route. See src/lib/admin/store.ts.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, with no `on conflict`, inside the same transaction — a
-- duplicate from this file would roll the whole migration back.

create table if not exists public.app_posts (
  id           text    primary key,
  -- 'campaign' | 'collab' | 'event'
  kind         text    not null default 'campaign',
  title        text    not null default '',
  body         text    not null default '',
  -- Absolute https URL. Empty means the card is drawn on the brand ground.
  image        text    not null default '',
  -- Optional outward link. https only; anything else is stored as ''.
  "linkUrl"    text    not null default '',
  "linkLabel"  text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  -- ISO-8601; empty string means unbounded, matching the house convention.
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_posts_active_idx
  on public.app_posts ("isActive", "sortOrder");

alter table public.app_posts enable row level security;
