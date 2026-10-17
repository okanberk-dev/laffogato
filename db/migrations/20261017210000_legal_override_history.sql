-- Earlier texts of the panel's legal overrides (admin audit CON-02, 17 Oct
-- 2026).
--
-- `legal_docs` holds one override per document and nothing else: "Varsayılana
-- döndür" deleted it on one click, and every save overwrote the text before
-- it. A lawyer-reviewed KVKK or Mesafeli Satış text was then gone for good,
-- and so was the answer to "which text did this order's customer accept":
-- the order records the version label (`legalConsent.version`), the text
-- behind an old label lived nowhere.
--
-- Now every write that replaces or removes an override first copies the row
-- it replaces here, in the same transaction:
--   - legal_doc_save:  a save (or a restore) over a row that differs from
--     what is being written ('replaced');
--   - legal_doc_reset: "Varsayılana döndür" ('reset').
-- The panel lists these rows, previews them and puts one back (a restore is
-- a legal_doc_save of the archived text, so the text it replaces is archived
-- in turn). `updatedAt` is when that text was saved; `archivedAt` and
-- `archivedBy` when and by whom it was replaced.
--
-- Rows are never updated (a trigger refuses it). Nothing deletes them.
-- Both functions take a per-document advisory lock, so two saves of one
-- document cannot both archive the same row and lose the one in between.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

create table if not exists public.legal_override_history (
  id              bigint  generated always as identity primary key,
  slug            text    not null,
  title           text    not null default '',
  summary         text    not null default '',
  "effectiveDate" text    not null default '',
  "bodyMarkdown"  text    not null default '',
  "isPublished"   boolean not null default false,
  "updatedAt"     text    not null default '',
  "archivedAt"    text    not null default '',
  "archivedBy"    text    not null default '',
  reason          text    not null default ''
);

create index if not exists legal_override_history_slug_idx
  on public.legal_override_history (slug, id);

alter table public.legal_override_history enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.legal_override_history_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'legal_override_history is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists legal_override_history_no_update on public.legal_override_history;
create trigger legal_override_history_no_update
  before update on public.legal_override_history
  for each row execute function public.legal_override_history_append_only();

-- ── legal_doc_save ──────────────────────────────────────────────────────
-- Writes the override of p_slug. When a row is already there and any of its
-- text fields or its published flag differ from what is written, that row is
-- archived first ('replaced'). Returns the archive row's id, or null when
-- nothing was archived (a new override, or a save that changed nothing).
--
-- A save that changes nothing writes nothing, so "updatedAt" stays the
-- moment the text went up: with the archive's "archivedAt" that gives the
-- exact span each text was shown, which is what tells the text behind an
-- order's consent (and the version rule dates an undated live text by it).
create or replace function public.legal_doc_save(
  p_slug           text,
  p_title          text,
  p_summary        text,
  p_effective_date text,
  p_body           text,
  p_published      boolean,
  p_at             text,
  p_by             text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  prev public.legal_docs%rowtype;
  archived bigint;
begin
  perform pg_advisory_xact_lock(hashtext('legal_doc:' || p_slug));

  select * into prev from public.legal_docs where slug = p_slug for update;
  if found and (prev.title, prev.summary, prev."effectiveDate",
                prev."bodyMarkdown", prev."isPublished")
       is not distinct from (p_title, p_summary, p_effective_date, p_body, p_published)
  then
    return null;
  end if;

  if found then
    insert into public.legal_override_history
      (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished",
       "updatedAt", "archivedAt", "archivedBy", reason)
    values
      (prev.slug, prev.title, prev.summary, prev."effectiveDate",
       prev."bodyMarkdown", prev."isPublished", prev."updatedAt",
       p_at, p_by, 'replaced')
    returning id into archived;
  end if;

  insert into public.legal_docs
    (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished", "updatedAt")
  values
    (p_slug, p_title, p_summary, p_effective_date, p_body, p_published, p_at)
  on conflict (slug) do update set
    title           = excluded.title,
    summary         = excluded.summary,
    "effectiveDate" = excluded."effectiveDate",
    "bodyMarkdown"  = excluded."bodyMarkdown",
    "isPublished"   = excluded."isPublished",
    "updatedAt"     = excluded."updatedAt";

  return archived;
end;
$$;

-- ── legal_doc_reset ─────────────────────────────────────────────────────
-- "Varsayılana döndür": archives the override of p_slug ('reset') and
-- deletes it, so /hukuk/<slug> shows the coded text again. Returns the
-- archive row's id, or null when the document had no override.
create or replace function public.legal_doc_reset(
  p_slug text,
  p_at   text,
  p_by   text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  prev public.legal_docs%rowtype;
  archived bigint;
begin
  perform pg_advisory_xact_lock(hashtext('legal_doc:' || p_slug));

  delete from public.legal_docs where slug = p_slug returning * into prev;
  if not found then
    return null;
  end if;

  insert into public.legal_override_history
    (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished",
     "updatedAt", "archivedAt", "archivedBy", reason)
  values
    (prev.slug, prev.title, prev.summary, prev."effectiveDate",
     prev."bodyMarkdown", prev."isPublished", prev."updatedAt",
     p_at, p_by, 'reset')
  returning id into archived;

  return archived;
end;
$$;
