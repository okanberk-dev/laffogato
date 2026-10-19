-- Olay kaydı (audit_logs) becomes append-only in the database, not only in
-- the page's words (admin audit SYS-13, operator decision D30).
--
-- The panel called the log "değiştirilemez" and the published Veri Saklama
-- ve İmha Politikası says "Kayıtlar değiştirilemez (append-only) olarak
-- tutulur", but audit_logs was a plain table: the app connects as the owner
-- role, which bypasses RLS, so any UPDATE or DELETE went through. Now:
--
--   * UPDATE is refused (P0001), like customer_consents.
--   * TRUNCATE is refused (P0001).
--   * DELETE is allowed only for a row whose "createdAt" is a written
--     ISO-8601 instant older than ten years: the policy's minimum. The
--     periodic destruction (src/lib/retention.ts, rule "audit-logs") cuts at
--     10 x 366 days, which is always older than ten calendar years, so every
--     row it removes passes; a younger row, or one with no stamp ('' sorts
--     before every instant), is refused.
--
-- "createdAt" stays text written by the app (`new Date().toISOString()`,
-- "2026-10-19T11:00:00.000Z"): the filters and the ordering compare strings,
-- and the cutoff below is printed in the same shape.
--
-- Idempotent: create or replace + drop trigger if exists. No data changes.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create or replace function public.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cutoff text;
begin
  if tg_op = 'DELETE' then
    cutoff := to_char(
      (now() at time zone 'UTC') - interval '10 years',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );
    if old."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
       and old."createdAt" < cutoff then
      return old;
    end if;
    raise exception 'audit_logs rows are kept for ten years (%)', old.id
      using errcode = 'P0001';
  end if;
  raise exception 'audit_logs is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.audit_logs_append_only();

drop trigger if exists audit_logs_retention_delete on public.audit_logs;
create trigger audit_logs_retention_delete
  before delete on public.audit_logs
  for each row execute function public.audit_logs_append_only();

drop trigger if exists audit_logs_no_truncate on public.audit_logs;
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_append_only();
