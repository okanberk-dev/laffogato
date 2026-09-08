-- Transactional e-mail sender, edited at /admin/ayarlar → E-posta.
--
-- Resend delivers only from a domain verified on its account, and that
-- verification lives in DNS — outside this codebase, moved by someone adding a
-- record. So the sender is a settings row rather than a constant, and the
-- panel can follow it without a deploy (docs/EMAIL-RESEND.md §2).
--
-- These three arrived in the AdminSettings type and in defaultSettings()
-- without this file, which made `updateSettings` compile an INSERT naming
-- columns Postgres does not have (42703) — so pressing Kaydet threw, and on an
-- empty database ensureSeed() threw with it, taking the first request that
-- touched the store.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "emailFromName"    text not null default '';
alter table public.settings add column if not exists "emailFromAddress" text not null default '';
alter table public.settings add column if not exists "emailReplyTo"     text not null default '';

-- ── customers."passwordMirroredAt" ────────────────────────────────────────
--
-- Site and app share one membership but keep two copies of the password: this
-- database's bcrypt hash and the Supabase identity. Both can now change - the
-- app grew a reset screen - so a login that finds them disagreeing has to know
-- WHICH is stale, and that is not derivable from the two values.
--
-- This is the answer. It holds the instant a password written HERE was
-- confirmed written to Supabase, and is emptied when that mirror did not
-- happen. Non-empty therefore means "Supabase is at least as new as this row",
-- which is what makes it safe to take Supabase's word on a disagreement - and
-- what makes it unsafe to fall back to the bcrypt copy for a password Supabase
-- has just refused.
alter table public.customers add column if not exists "passwordMirroredAt" text not null default '';
