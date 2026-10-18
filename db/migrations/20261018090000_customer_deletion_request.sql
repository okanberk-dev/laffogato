-- A member's request to have their account deleted (operator, 18 Oct 2026).
--
-- On the web an account is no longer deleted by the member's own click:
-- /uye/hesap/sil sends a request, the team is mailed, and an owner or
-- manager closes the account from the panel ("Hesabı sil", the same
-- `deleteMe` the app's DELETE /me runs). KVKK m.13/2 and the application
-- Tebliğ m.6/5 give the controller thirty days to answer; the panel counts
-- them from this stamp.
--
--   "deletionRequestedAt"  ISO-8601 instant of the open request; NULL when
--                          there is none. Set only while it is NULL (one
--                          open request per member, a second press keeps
--                          the first date), cleared when the member takes
--                          the request back and when the account is closed.
--   "deletionReason"       the member's optional words, capped in the app
--                          (500 characters); '' when none. Blanked with the
--                          rest of the row when the account is closed.
--
-- The app's in-app deletion (Apple 5.1.1(v), Google Play) is unchanged and
-- never reads these columns.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

alter table public.customers
  add column if not exists "deletionRequestedAt" text;

alter table public.customers
  add column if not exists "deletionReason" text not null default '';

-- The panel lists and counts the open requests; almost every row is NULL.
create index if not exists customers_deletion_requested_idx
  on public.customers ("deletionRequestedAt")
  where "deletionRequestedAt" is not null;
