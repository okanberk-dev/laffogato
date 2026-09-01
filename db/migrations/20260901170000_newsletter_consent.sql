-- Explicit consent for commercial e-mail, and a way out of it.
--
-- 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun requires prior
-- explicit consent before commercial electronic messages, a record of when and
-- how it was given, and a free, always-available way to withdraw it. The
-- footer form took an address and subscribed it, with no consent checkbox, no
-- record, and no unsubscribe route anywhere on the site.
alter table public.newsletter_subscribers
  add column if not exists "consentAt"     text not null default '',
  add column if not exists "consentIp"     text not null default '',
  add column if not exists "consentText"   text not null default '',
  -- Bearer token for the one-click unsubscribe link in every message. Not a
  -- secret worth protecting beyond its purpose: the worst it can do is
  -- unsubscribe an address that asked to be unsubscribed.
  add column if not exists "unsubToken"    text not null default '';

create unique index if not exists newsletter_unsub_token_idx
  on public.newsletter_subscribers ("unsubToken")
  where "unsubToken" <> '';
