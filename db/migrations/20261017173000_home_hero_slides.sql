-- The home page hero, editable from the panel (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "site slider alanı, 3-4 kampanya slaytı, panelden
-- tamamen düzenlenebilir olsun". Until now the hero on / was the fixed
-- HOME_SLIDES list in src/components/laffogato/data.ts. One row is one slide,
-- edited at /admin/anasayfa-hero (src/lib/admin/home-hero.ts).
--
-- - Empty table, or no row live right now: the site keeps drawing the bundled
--   HOME_SLIDES, so this migration changes nothing on its own. The panel's
--   "Varsayılanları içe aktar" copies those slides in as editable rows.
-- - "startsAt" / "endsAt": an optional publish window, ISO-8601 UTC text like
--   the app's slides ('' = unbounded; src/lib/admin/publish-window.ts).
-- - image: one of the site's own pictures in public/ (the panel's list in
--   home-hero-core.ts), an uploaded data:image/... (served from
--   /gorsel/ana-hero/<id>), or an https URL.
-- - Each of the two buttons is a label plus EITHER a known action code
--   ("menu", "karaoke", ...) OR a link (a same-site path or an https URL).
--   The panel validates both; the site drops a button whose target does not
--   pass the same check on read.
--
-- Additive and idempotent: the bundle re-runs every migration on a deploy
-- that adds one. No `insert into public._migrations`: scripts/db-migrate.mjs
-- records the file itself.

create table if not exists public.home_hero_slides (
  id                text    primary key,
  "sortOrder"       integer not null default 0,
  "isActive"        boolean not null default true,
  "startsAt"        text    not null default '',
  "endsAt"          text    not null default '',
  kicker            text    not null default '',
  "titleLine1"      text    not null default '',
  "titleLine2"      text    not null default '',
  body              text    not null default '',
  image             text    not null default '',
  alt               text    not null default '',
  scene             text    not null default 'latte',
  "primaryLabel"    text    not null default '',
  "primaryAction"   text    not null default '',
  "primaryHref"     text    not null default '',
  "secondaryLabel"  text    not null default '',
  "secondaryAction" text    not null default '',
  "secondaryHref"   text    not null default '',
  "createdAt"       text    not null default '',
  "updatedAt"       text    not null default ''
);
create index if not exists home_hero_slides_order_idx
  on public.home_hero_slides ("sortOrder");
alter table public.home_hero_slides enable row level security;
