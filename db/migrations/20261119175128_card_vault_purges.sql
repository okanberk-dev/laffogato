-- Saved cards a closed account still has at PayNkolay (docs/PAYNKOLAY.md
-- §16.3, src/lib/payment/card-purge.ts).
--
-- Closing an account (src/lib/mobile/me.ts `deleteMe`, web and app) first
-- asks PayNkolay to delete the member's saved cards, then clears
-- `customers."cardUserKey"`. When PayNkolay cannot be reached in time the
-- closure does not wait. Until 19 Kasım 2026 the member key was then
-- written to the log for removal by hand; now it waits here instead, and
-- the daily run (`/api/cron/daily`, step `card-purge`) asks PayNkolay
-- again until the cards are gone.
--
--   card_vault_purges   one row per closed account whose cards are still
--                       at the POS. "sealedKey" is the member key sealed
--                       with AES-256-GCM (src/lib/payment/card-vault.ts),
--                       bound to this row's id: the database never holds
--                       the key in the clear, and a value copied to
--                       another row does not open. No e-mail, no name, no
--                       customer id: once the cards are gone the row is
--                       deleted, and nothing in it names a person.
--
-- New table only; nothing existing changes. Re-runnable.
--
-- Rollback (only card-purge.ts reads it; rows still in it are cards left
-- at the POS, so delete them there first):
--   drop table if exists public.card_vault_purges;

create table if not exists public.card_vault_purges (
  id              text primary key,
  "sealedKey"     text    not null,
  "createdAt"     text    not null,
  attempts        integer not null default 0,
  "lastAttemptAt" text    not null default '',
  "lastError"     text    not null default ''
);

create index if not exists card_vault_purges_created_idx
  on public.card_vault_purges ("createdAt");

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.card_vault_purges enable row level security;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
