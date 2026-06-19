-- Backend completion: newsletter subscribers, franchise applications, customer
-- consent timestamps, and admin-editable legal documents. All tables RLS-on /
-- deny-all (service-role only), mirroring the rest of the schema.

-- ── Newsletter subscribers (anonymous footer signup + opt-ins) ──────────────
create table if not exists public.newsletter_subscribers (
  id               text    primary key,
  email            text    not null,
  name             text    not null default '',
  -- Where the subscription came from: footer | register | account.
  source           text    not null default 'footer',
  "isActive"       boolean not null default true,
  "createdAt"      text    not null default '',
  "unsubscribedAt" text    not null default ''
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
alter table public.newsletter_subscribers enable row level security;

-- ── Franchise applications (lead capture from the franchise page form) ──────
create table if not exists public.franchise_applications (
  id           text primary key,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  city         text not null default '',
  experience   text not null default '',
  budget       text not null default '',
  package      text not null default '',
  message      text not null default '',
  -- Pipeline: new | contacted | qualified | rejected | closed.
  status       text not null default 'new',
  "createdAt"  text not null default ''
);
create index if not exists franchise_applications_created_idx
  on public.franchise_applications ("createdAt");
alter table public.franchise_applications enable row level security;

-- ── Customer consent timestamps (KVKK terms + marketing opt-in) ─────────────
alter table public.customers
  add column if not exists "termsAcceptedAt"    text not null default '',
  add column if not exists "marketingConsentAt" text not null default '';

-- ── Admin-editable legal documents (override the code defaults per slug) ────
-- When a row is published with a bodyMarkdown, the public /hukuk/<slug> page
-- renders the override; otherwise it falls back to the rich coded default.
create table if not exists public.legal_docs (
  slug            text    primary key,
  title           text    not null default '',
  summary         text    not null default '',
  "effectiveDate" text    not null default '',
  "bodyMarkdown"  text    not null default '',
  "isPublished"   boolean not null default false,
  "updatedAt"     text    not null default ''
);
alter table public.legal_docs enable row level security;
