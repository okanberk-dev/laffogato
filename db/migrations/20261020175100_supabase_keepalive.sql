-- The daily Supabase keep-alive, made visible (20 Oct 2026).
--
-- /api/cron/daily pings the free-plan Supabase project every morning so it
-- never pauses for inactivity (keepSupabaseAwake, docs/SUPABASE-GECIS.md
-- §0). The result went into the cron's response body and nowhere else, and
-- CRON_SECRET is "sensitive" on Vercel: nobody could see whether the ping
-- still got through. A paused project refuses every sign-in.
--
--   supabase_keepalive
--     One row (id 'supabase'): the latest attempt (its outcome and when)
--     and the latest success. Written by the cron in ONE statement, an
--     upsert that sets "lastSuccessAt" only on an "ok" (CLAUDE.md rule 20:
--     no read-modify-write). Read live by the owner's dashboard
--     (/admin, Genel bakış), never cached.
--
-- A single row rather than a log: the dashboard needs exactly these two
-- facts, a log would grow by a row a day and need a retention rule, and this
-- row holds no personal data, so nothing in the published retention policy
-- applies to it. The checks pin its shape: an outcome word and two
-- ISO-8601 UTC instants. No key, no response body, no member data can be
-- stored here, by mistake or otherwise.
--
-- Row level security on, no policy, like every other table
-- (tests/db-rls.test.ts). Re-runnable. Rollback:
--   drop table if exists public.supabase_keepalive;

create table if not exists public.supabase_keepalive (
  id              text primary key,
  "lastStatus"    text not null,
  "lastAttemptAt" text not null,
  "lastSuccessAt" text not null default '',
  constraint supabase_keepalive_one_row check (id = 'supabase'),
  constraint supabase_keepalive_status
    check ("lastStatus" in ('ok', 'failed', 'skipped')),
  constraint supabase_keepalive_attempt_at
    check ("lastAttemptAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'),
  constraint supabase_keepalive_success_at
    check (
      "lastSuccessAt" = ''
      or "lastSuccessAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    )
);

alter table public.supabase_keepalive enable row level security;
