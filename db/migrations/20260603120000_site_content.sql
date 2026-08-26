-- ── site_content (admin-managed editorial copy) ────────────────────────────
-- Simple key → value store for editable marketing/section text (hero,
-- founder bio, franchise pitch & stats, …). Defaults live in code; only
-- overridden keys are persisted here. RLS on (service role bypasses).
create table if not exists public.site_content (
  key         text primary key,
  value       text not null default '',
  "updatedAt" text not null default ''
);
alter table public.site_content enable row level security;
