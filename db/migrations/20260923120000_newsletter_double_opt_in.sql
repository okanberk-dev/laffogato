-- Bulletin double opt-in (6563; docs/AUDIT.md §8, "Açık" 3).
--
-- The footer form wrote an ACTIVE subscriber for whatever address was typed:
-- anyone could sign anyone up, including someone who had opted out, and the
-- "consent" record then carried the stranger's IP. A request from an address
-- whose owner has not proven it is now stored inactive with a confirmation
-- token; it becomes a subscriber (isActive, consentAt) only when the owner
-- confirms — from the mail (footer) or by verifying their account (register /
-- account toggle). The campaign audience already requires isActive AND
-- consentAt, so a pending row is never mailed.
--
-- `confirmRequestedAt` / `confirmRequestIp` keep the REQUEST half of the
-- evidence; `consentAt` / `consentIp` are written at confirmation.
-- Additive: three text columns with '' defaults every existing row satisfies.
alter table public.newsletter_subscribers
  add column if not exists "confirmToken"       text not null default '',
  add column if not exists "confirmRequestedAt" text not null default '',
  add column if not exists "confirmRequestIp"   text not null default '';

create index if not exists newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers ("confirmToken")
  where "confirmToken" <> '';
