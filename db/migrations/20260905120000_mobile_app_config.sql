-- Mobile app configuration edited at /admin/mobil/ayarlar (docs/API-MOBILE.md §10).
-- One jsonb document; keys are normalised with defaults in src/lib/mobile/app-config.ts,
-- so an older row that lacks a key reads the default rather than undefined.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "mobileApp" jsonb not null default '{}'::jsonb;
