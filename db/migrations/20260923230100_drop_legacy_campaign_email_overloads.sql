-- Drops the two compatibility overloads 20260908170000_campaign_email_reconsent
-- kept "for one release": the three-argument campaign_email_claim wrapper and
-- the six-argument campaign_email_mark from 20260908150000_campaign_emails.
--
-- They existed only for a runner of the build before 8 Sep 2026 that was still
-- inside after() when the reconsent migration landed. Every build since calls
-- the four-argument claim (p_posted_before) and the seven-argument mark
-- (p_claimed_at) - src/lib/email/campaigns.ts claimBatch / markBatch - so the
-- old signatures have had no caller for many releases.
--
-- The old mark is worse than dead: it settles every 'sending' row of a batch
-- whoever claimed it, so a stalled runner calling it could mark as sent rows
-- another runner is still delivering. Nothing calls it today; dropping it
-- makes sure nothing can.
--
-- Idempotent: `if exists`, and the exact argument types, so the current
-- four- and seven-argument functions are untouched. When the whole bundle is
-- replayed (bootstrap, db/schema.sql by hand) the earlier files re-create the
-- overloads and this file drops them again, so the end state is the same.

drop function if exists public.campaign_email_claim(text, text, text);

drop function if exists public.campaign_email_mark(
  text, integer, text, jsonb, text, text
);
