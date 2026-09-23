-- An append-only ledger of a member's commercial-message consent.
--
-- `customers."notificationPrefs"` (+ `marketingConsentAt`) is the READ model:
-- what the member wants now, and what the campaign audience reads. It keeps
-- no history. Switching `marketing` off cleared `marketingConsentAt`, so a
-- withdrawal left no record at all, and a grant recorded neither where it
-- came from nor the request's IP. The published Veri Saklama ve İmha
-- Politikası promises both: the consent record for three years after it
-- stops being valid, and the "ret kaydı" (withdrawal record) for as long, so
-- the same address is not mailed again.
--
-- One row per change of one purpose ('marketing' | 'newsletter'): who (the
-- member's address), what (granted true/false), from where (`source`: the
-- surface that made the change), the request's IP and browser/app string
-- when the member made it, the version of the text the grant refers to, and
-- when - the fields the Ticari Elektronik İleti ve İYS Aydınlatması says are
-- recorded for every consent. Nothing reads it
-- to decide who gets mail - the read model stays the only input to the
-- audience, so no mobile contract changes.
--
-- Rows are never updated (a trigger refuses it). The only delete is the
-- retention sweep, through customer_consents_retention() below.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.customer_consents (
  id              bigint generated always as identity primary key,
  "customerEmail" text    not null,
  purpose         text    not null,
  granted         boolean not null,
  source          text    not null default '',
  ip              text    not null default '',
  "userAgent"     text    not null default '',
  "textVersion"   text    not null default '',
  "createdAt"     text    not null default ''
);

create index if not exists customer_consents_member_idx
  on public.customer_consents ("customerEmail", purpose, id);

alter table public.customer_consents enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.customer_consents_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'customer_consents is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists customer_consents_no_update on public.customer_consents;
create trigger customer_consents_no_update
  before update on public.customer_consents
  for each row execute function public.customer_consents_append_only();

-- ── customer_consents_retention ─────────────────────────────────────────
-- The published period, as a query: "onayın geçerliliğinin sona erdiği
-- tarihten itibaren 3 yıl; onayın geri alınması hâlinde ret kaydı ... bu
-- süre boyunca tutulur". A row's consent ended when a withdrawal for the same
-- address and purpose was appended at or after it (the withdrawal itself
-- included), so a row goes once such a withdrawal is older than p_cutoff.
-- A consent that still stands (no withdrawal after it) is never in scope,
-- however old it is: it is the proof the member's mail rests on.
--
-- `id` orders the ledger (identity, append-only), not `createdAt`: two rows
-- written in the same millisecond still have an order. A withdrawal with no
-- stamp ('' sorts first) never ends anything.
--
-- p_apply false counts only; true deletes and returns how many went.
create or replace function public.customer_consents_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if p_apply then
    delete from public.customer_consents c
     where exists (
       select 1
         from public.customer_consents w
        where w."customerEmail" = c."customerEmail"
          and w.purpose = c.purpose
          and not w.granted
          and w.id >= c.id
          and w."createdAt" <> ''
          and w."createdAt" < p_cutoff
     );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.customer_consents c
     where exists (
       select 1
         from public.customer_consents w
        where w."customerEmail" = c."customerEmail"
          and w.purpose = c.purpose
          and not w.granted
          and w.id >= c.id
          and w."createdAt" <> ''
          and w."createdAt" < p_cutoff
     );
  end if;
  return affected;
end;
$$;
