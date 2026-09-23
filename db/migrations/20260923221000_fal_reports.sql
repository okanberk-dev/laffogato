-- fA'L: "Bu yorumu bildir" - a member reports an AI reading (Google Play's
-- AI-generated content policy wants an in-app way to flag one before the
-- feature is switched on).
--
-- One row per report: the member (for the daily cap and the account-deletion
-- sweep), the Istanbul day, the reason from a closed list, the reading's own
-- words as the member saw them, and the model that wrote it. NEVER the photo:
-- the photo is not kept anywhere, and a report does not change that.
--
-- Swept ninety days after it is made (src/lib/retention.ts, rule
-- `fal-reports`), as the Veri Saklama ve İmha Politikası publishes. On
-- DELETE /me the member's address is replaced with the closed account's
-- placeholder (ANON_SWEEPS); the report itself stays until the sweep.
--
-- Same conventions as fal_readings: camelCase-quoted columns, ISO-8601 text
-- dates, RLS on with no policies (the server's own role bypasses it).
create table if not exists public.fal_reports (
  id              bigserial primary key,
  "customerEmail" text not null,
  day             text not null,
  reason          text not null default 'other',
  text            text not null default '',
  model           text not null default '',
  "createdAt"     text not null default ''
);
create index if not exists fal_reports_member_day on public.fal_reports ("customerEmail", day);
create index if not exists fal_reports_created on public.fal_reports ("createdAt");
alter table public.fal_reports enable row level security;
