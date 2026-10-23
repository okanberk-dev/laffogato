-- Who is in the panel now (Kullanıcılar: "Şu an aktif", Innex recipe §3.9;
-- 23 Oct 2026). One row per panel address: the last time a signed-in
-- request of theirs was answered. Written after the response (`after()`),
-- at most once a minute per address and server instance
-- (src/lib/admin/activity.ts), overwritten in place; never a history.
-- Deleting a panel user deletes its row. Read live by the owner's
-- Kullanıcılar page only; nothing caches it.
--
-- Re-runnable. Rollback:
--   drop table if exists public.admin_activity;

create table if not exists public.admin_activity (
  email        text primary key,
  "lastSeenAt" text not null
);

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.admin_activity enable row level security;
