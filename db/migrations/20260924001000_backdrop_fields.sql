-- Menu items and shop products: the scene family behind the product, whether
-- its photo is a cutout, and the drawn vessel shape (glass round, 24 Sep 2026).
--
-- The app draws every product on a lit scene whose colour comes from the
-- drink itself (lafmobil docs/DESIGN-GLASS.md §6). Today it can only guess
-- that colour from `hue` and the category. When the operator uploads a photo,
-- the panel now reads the drink's body colour from the pixels and stores the
-- nearest of twelve families here, so the app draws the scene the photo
-- actually shows. The operator can override the pick by hand.
--
-- backdrop          text     - one of the twelve product families
--                              (src/lib/backdrop/families.ts); null = no pick,
--                              the app falls back to `hue`, then the category.
-- "backdropSource"  text     - 'auto' (recomputed on every new photo) or
--                              'manual' (the operator's choice, kept across
--                              uploads).
-- "backdropHex"     text     - the colour the pick was made from (#RRGGBB), for
--                              the panel swatch; null when nothing was read.
-- "photoCutout"     boolean  - the stored photo has transparency (a cutout);
--                              the app then draws it on the scene, not in a tile.
-- vessel            text     - the drawn vessel shape the operator chose for a
--                              photo-less item (tumbler, cup, tulip, cloche,
--                              shot, pack); null = from the category.
--
-- On `products` the fields describe `images[0]`, the photo the app shows.
--
-- No enum or check on `backdrop` and `vessel`: both lists may grow, and the
-- mobile mapper already publishes null for any value it does not know.
--
-- Additive and idempotent: existing rows get null / 'auto' / false, which the
-- app reads as "as today". `scripts/backfill-backdrops.mjs` fills existing
-- photos (dry run by default).
--
-- Rollback (only GET /menu, GET /shop and the panel read them):
--   alter table public.menu_items drop column if exists backdrop;
--   alter table public.menu_items drop column if exists "backdropSource";
--   alter table public.menu_items drop column if exists "backdropHex";
--   alter table public.menu_items drop column if exists "photoCutout";
--   alter table public.menu_items drop column if exists vessel;
--   (the same five for public.products)
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.menu_items
  add column if not exists backdrop text;

alter table public.menu_items
  add column if not exists "backdropSource" text not null default 'auto'
    check ("backdropSource" in ('auto', 'manual'));

alter table public.menu_items
  add column if not exists "backdropHex" text;

alter table public.menu_items
  add column if not exists "photoCutout" boolean not null default false;

alter table public.menu_items
  add column if not exists vessel text;

alter table public.products
  add column if not exists backdrop text;

alter table public.products
  add column if not exists "backdropSource" text not null default 'auto'
    check ("backdropSource" in ('auto', 'manual'));

alter table public.products
  add column if not exists "backdropHex" text;

alter table public.products
  add column if not exists "photoCutout" boolean not null default false;

alter table public.products
  add column if not exists vessel text;
