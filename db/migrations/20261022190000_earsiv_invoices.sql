-- Automatic e-Arşiv invoices through Paraşüt (22 Oct 2026).
--
-- Online orders' e-Arşiv invoices were cut by hand in Paraşüt, and an
-- invoice not cut within 7 days of delivery counts as not cut at all
-- (VUK m.231/5). The site now cuts them itself (src/lib/invoice/,
-- docs/EARSIV.md): shop parcels at dispatch, the app and web cafe orders
-- (gel-al, masa, kurye) after delivery, paid karaoke bookings after the
-- evening. Off by default (EARSIV_MODE=off); in `draft` it only prepares
-- sales invoices for the accountant to check in Paraşüt.
--
--   invoices
--     One row per billable source: an order or a karaoke booking
--     (unique "sourceKind", "sourceId"). The status says where it is:
--       waiting      not yet due (a parcel not shipped, an evening to come,
--                    a karaoke refund still going back)
--       due          due; the next run cuts it
--       working      a run holds it ("claimedAt"); a run that died leaves
--                    it reclaimable after 15 minutes (invoice_claim)
--       draft        the sales invoice is in Paraşüt, not formalised
--                    (EARSIV_MODE=draft; formalised once the mode is live)
--       formalizing  the e-Arşiv job is posted, its result not read yet
--       issued       an e-Arşiv invoice exists ("invoiceNo", "uuid")
--       failed       the last attempt failed; retried at "nextAttemptAt"
--       manual       a person cuts it in Paraşüt ("manualReason" says why)
--       manual_done  a person cut it in Paraşüt ("invoiceNo", "actor")
--       skipped      nothing to invoice (cancelled, refunded in full, 0)
--     Every Paraşüt id is written the moment it is known, so a run that
--     stops halfway resumes from the last one and never creates a second
--     invoice ("createStartedAt" and "jobPostedAt" mark a request whose
--     answer was lost: the next run searches before it creates again).
--     No name, e-mail or phone is kept here: they are read from the order
--     or the booking when the invoice is cut. The billing city, district
--     and address text are kept (prefilled, editable in the panel).
--
--   invoice_state
--     Key/value: the Paraşüt token (sealed with a key derived from the
--     Paraşüt secrets, never readable from the database alone), the
--     Paraşüt product ids, the carriers' legal titles and VKNs, the last
--     run's summary, and a short lease that keeps two refreshes of the
--     token from spending the same refresh token.
--
--   invoice_contacts
--     The Paraşüt contact id per e-mail address, so a contact is created
--     once and never looked up by the 11111111111 placeholder (which every
--     consumer contact shares). A fingerprint of the name and address sent
--     tells when the contact must be updated; the name itself is not kept.
--
--   invoice_claim(now, staleBefore, live, limit)
--     Hands each due row to exactly one run: FOR UPDATE SKIP LOCKED, the
--     row set to `working` in the same statement (CLAUDE.md rule 20).
--     Returns rows, so it is called through rpcRows() (rule 23).
--
--   invoice_state_lease(key, owner, now, until)
--     Takes or renews a lease row in invoice_state, only when it is free or
--     expired or already the caller's. True when the caller holds it.
--
-- Row level security on, no policy, like every other table
-- (tests/db-rls.test.ts). Re-runnable. Rollback:
--   drop function if exists public.invoice_claim(text, text, boolean, integer);
--   drop function if exists public.invoice_state_lease(text, text, text, text);
--   drop table if exists public.invoice_contacts;
--   drop table if exists public.invoice_state;
--   drop table if exists public.invoices;

create table if not exists public.invoices (
  id                 text primary key,
  "sourceKind"       text not null,
  "sourceId"         text not null,
  "sourceLabel"      text not null default '',
  route              text not null default '',
  status             text not null default 'waiting',
  "dueAt"            text not null default '',
  "deadlineAt"       text not null default '',
  "amountMinor"      integer not null default 0,
  "kdvRows"          jsonb not null default '[]'::jsonb,
  "billingCity"      text not null default '',
  "billingDistrict"  text not null default '',
  "billingAddress"   text not null default '',
  "billingEditedBy"  text not null default '',
  "contactId"        text not null default '',
  "salesInvoiceId"   text not null default '',
  "createStartedAt"  text not null default '',
  "jobId"            text not null default '',
  "jobPostedAt"      text not null default '',
  "formalizePosts"   integer not null default 0,
  "eDocumentId"      text not null default '',
  "eDocumentType"    text not null default '',
  "invoiceNo"        text not null default '',
  uuid               text not null default '',
  "issuedAt"         text not null default '',
  "emailedAt"        text not null default '',
  "emailError"       text not null default '',
  "emailAttempts"    integer not null default 0,
  attempts           integer not null default 0,
  "lastError"        text not null default '',
  "nextAttemptAt"    text not null default '',
  "claimedAt"        text not null default '',
  "manualReason"     text not null default '',
  "manualCode"       text not null default '',
  actor              text not null default '',
  "refundNotedAt"    text not null default '',
  "createdAt"        text not null,
  "updatedAt"        text not null,
  constraint invoices_source_kind check ("sourceKind" in ('order', 'karaoke')),
  constraint invoices_status check (status in (
    'waiting', 'due', 'working', 'draft', 'formalizing', 'issued',
    'failed', 'manual', 'manual_done', 'skipped'
  )),
  constraint invoices_amount check ("amountMinor" >= 0),
  constraint invoices_attempts check (
    attempts >= 0 and "emailAttempts" >= 0 and "formalizePosts" >= 0
  ),
  constraint invoices_kdv_rows check (jsonb_typeof("kdvRows") = 'array'),
  constraint invoices_source_unique unique ("sourceKind", "sourceId")
);

create index if not exists invoices_status_due_idx
  on public.invoices (status, "dueAt");

alter table public.invoices enable row level security;

create table if not exists public.invoice_state (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  "updatedAt" text not null
);

alter table public.invoice_state enable row level security;

create table if not exists public.invoice_contacts (
  "companyId"  text not null,
  email        text not null,
  "contactId"  text not null,
  fingerprint  text not null default '',
  "updatedAt"  text not null,
  primary key ("companyId", email),
  constraint invoice_contacts_email_lower check (email = lower(email))
);

alter table public.invoice_contacts enable row level security;

create or replace function public.invoice_claim(
  p_now          text,
  p_stale_before text,
  p_live         boolean,
  p_limit        integer
)
returns setof public.invoices
language sql
set search_path = ''
as $$
  with picked as (
    select i.id
      from public.invoices i
     where (
             i.status in ('waiting', 'due', 'failed', 'formalizing')
             and i."dueAt" <> ''
             and i."dueAt" <= p_now
             and (i."nextAttemptAt" = '' or i."nextAttemptAt" <= p_now)
           )
        or (
             i.status = 'draft'
             and p_live
             and (i."nextAttemptAt" = '' or i."nextAttemptAt" <= p_now)
           )
        or (
             i.status = 'issued'
             and i."emailedAt" = ''
             and i."nextAttemptAt" <> ''
             and i."nextAttemptAt" <= p_now
           )
        or (
             i.status = 'working'
             and i."claimedAt" <> ''
             and i."claimedAt" < p_stale_before
           )
     order by i."deadlineAt", i."dueAt", i.id
     limit greatest(0, least(coalesce(p_limit, 1), 50))
       for update skip locked
  )
  update public.invoices i
     set status = 'working',
         "claimedAt" = p_now,
         "updatedAt" = p_now
    from picked
   where i.id = picked.id
  returning i.*;
$$;

create or replace function public.invoice_state_lease(
  p_key   text,
  p_owner text,
  p_now   text,
  p_until text
)
returns boolean
language sql
set search_path = ''
as $$
  with taken as (
    insert into public.invoice_state as s (key, value, "updatedAt")
    values (
      p_key,
      jsonb_build_object('owner', p_owner, 'until', p_until),
      p_now
    )
    on conflict (key) do update
       set value = excluded.value,
           "updatedAt" = excluded."updatedAt"
     where coalesce(s.value ->> 'until', '') <= p_now
        or s.value ->> 'owner' = p_owner
    returning 1
  )
  select exists (select 1 from taken);
$$;
