-- Every legal text the site has shown, kept by the SHA-256 of the text itself
-- (decisions D-VERSIONS-TABLE and ASK-DURABLE, 20 Oct 2026; LEGAL-REDLINES
-- §25).
--
-- A consent recorded only a version label (`legalConsent.version`, "20 Ekim
-- 2026"), and two different texts could carry the same label: a panel
-- override and the coded text, or two changes merged on one Istanbul day
-- (the D-SAME-DAY rule existed for that). Now every consent also records the
-- hash of each text it confirmed (`legalConsent.textHashes`, { slug: sha256 })
-- and the text behind each hash lives here:
--
--   hash        sha256 (lowercase hex) of `body`, its UTF-8 bytes exactly.
--               The CHECK below makes the database refuse a row whose hash
--               is not the hash of its text: a row is its own proof.
--               Collation "C" so a hex prefix is a plain byte range.
--   slug        the document (`/hukuk/<slug>`).
--   body        the document as /hukuk/<slug> showed it, in the one form its
--               hash is taken of: canonical JSON written by
--               src/lib/legal/version-core.ts (title, summary, date, then the
--               coded sections with their tokens filled, or the panel's
--               Markdown). The database never parses it.
--   "createdAt" when the text was first stored (ISO-8601 UTC, written by the
--               database's own clock).
--
-- Writers (INSERT ... ON CONFLICT (hash) DO NOTHING in one statement, never a
-- read-modify-write): the checkout and karaoke consents (the texts they
-- record), the panel's save, reset and restore (the text shown before and
-- after, written before the change), the daily cron (every document as shown
-- that day). No public page view writes here.
--
-- Readers: /hukuk/<slug>?surum=<prefix> (only with that parameter), the
-- confirmation e-mails' attachment and the member's download.
--
-- Append-only: UPDATE and TRUNCATE are refused (P0001). DELETE passes only
-- for a row whose "createdAt" is a written instant older than eleven years:
-- the periodic destruction (src/lib/retention.ts, rule "legal-doc-versions")
-- cuts at 11 x 366 days through legal_doc_versions_retention below, which
-- also keeps every text a consent of the last eleven years names and every
-- text that was not replaced before the cutoff.
--
-- Idempotent: create if not exists, create or replace, drop trigger if
-- exists. No `insert into public._migrations`: scripts/db-migrate.mjs records
-- the file itself.
--
-- Rollback (loses every stored text; only before the first consent records a
-- hash):
--   drop function if exists public.legal_doc_versions_retention(text, boolean);
--   drop table if exists public.legal_doc_versions;
--   drop function if exists public.legal_doc_versions_append_only();

create table if not exists public.legal_doc_versions (
  hash        text collate "C" primary key,
  slug        text not null,
  body        text not null,
  "createdAt" text not null
              default to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  constraint legal_doc_versions_hash_shape
    check (hash ~ '^[0-9a-f]{64}$'),
  constraint legal_doc_versions_hash_of_body
    check (hash = encode(sha256(convert_to(body, 'UTF8')), 'hex')),
  constraint legal_doc_versions_slug_shape
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists legal_doc_versions_slug_idx
  on public.legal_doc_versions (slug, "createdAt");

alter table public.legal_doc_versions enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.legal_doc_versions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cutoff text;
begin
  if tg_op = 'DELETE' then
    cutoff := to_char(
      (now() at time zone 'UTC') - interval '11 years',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );
    if old."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
       and old."createdAt" < cutoff then
      return old;
    end if;
    raise exception 'legal_doc_versions rows are kept for eleven years (%)', old.hash
      using errcode = 'P0001';
  end if;
  raise exception 'legal_doc_versions is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists legal_doc_versions_no_update on public.legal_doc_versions;
create trigger legal_doc_versions_no_update
  before update on public.legal_doc_versions
  for each row execute function public.legal_doc_versions_append_only();

drop trigger if exists legal_doc_versions_retention_delete on public.legal_doc_versions;
create trigger legal_doc_versions_retention_delete
  before delete on public.legal_doc_versions
  for each row execute function public.legal_doc_versions_append_only();

drop trigger if exists legal_doc_versions_no_truncate on public.legal_doc_versions;
create trigger legal_doc_versions_no_truncate
  before truncate on public.legal_doc_versions
  for each statement execute function public.legal_doc_versions_append_only();

-- ── legal_doc_versions_retention ────────────────────────────────────────
-- The period as a query. A row is in scope only when ALL of these hold:
--   - it was first stored before p_cutoff;
--   - a later text of the same document was first stored, also before
--     p_cutoff (the text stopped being the newest more than eleven years ago:
--     the newest text of a document is never in scope, however old);
--   - no order and no karaoke booking whose consent was accepted at or after
--     p_cutoff names it in `legalConsent.textHashes`.
-- A text first stored twelve years ago and confirmed by an order last year
-- stays; the contract it proves is still inside its ten years.
--
-- p_apply false counts only; true deletes and returns how many went.
create or replace function public.legal_doc_versions_retention(
  p_cutoff text,
  p_apply  boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if p_apply then
    delete from public.legal_doc_versions v
     where v."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
       and v."createdAt" < p_cutoff
       and exists (
         select 1
           from public.legal_doc_versions w
          where w.slug = v.slug
            and w."createdAt" > v."createdAt"
            and w."createdAt" < p_cutoff
       )
       and not exists (
         select 1
           from public.orders o
          where o."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(o."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       )
       and not exists (
         select 1
           from public.karaoke_reservations k
          where k."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(k."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.legal_doc_versions v
     where v."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
       and v."createdAt" < p_cutoff
       and exists (
         select 1
           from public.legal_doc_versions w
          where w.slug = v.slug
            and w."createdAt" > v."createdAt"
            and w."createdAt" < p_cutoff
       )
       and not exists (
         select 1
           from public.orders o
          where o."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(o."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       )
       and not exists (
         select 1
           from public.karaoke_reservations k
          where k."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(k."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       );
  end if;
  return affected;
end;
$$;
