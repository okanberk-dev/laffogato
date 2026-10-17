-- Plain btree indexes for the member lookups that compare the stored e-mail
-- exactly.
--
-- Every one of these tables already has an index on lower(<email column>),
-- but the code reads them with `"col" = $1` (the value is normalised to
-- lower case before the query). Postgres only uses an expression index for
-- the same expression, so each of these reads was a sequential scan of the
-- whole table:
--
--   customers.email          - supabase-bridge fetchRaw, on EVERY bearer
--                              request (requireMobileCustomer -> finishLink),
--                              plus the customer store and the invite names
--   loyalty_stamps           - listStamps: /me, /orders, /notifications
--   customer_coupons         - /coupons, checkout redeem/release
--   counter_tokens           - /me/counter-token (open tokens, issue window)
--   invites."inviterEmail"   - /me invite summary (no index at all before)
--   invites."inviteeEmail"   - invite reward on a member's first paid order
--   newsletter_subscribers   - PATCH /me newsletter toggle, unsubscribe
--
-- Measured on a local Postgres 16 with 20k customers, 200k stamps, 60k
-- coupons, 30k invites, 100k counter tokens (EXPLAIN ANALYZE, one member):
-- see the commit body for the before/after plans.
--
-- Why indexes and not `lower(col) = lower($1)` in the queries: the indexes
-- leave every result exactly as it is today. Switching the predicates would
-- also start matching rows stored with upper-case letters, which changes a
-- member's stamp count or coupon list - a behaviour change, not a speed-up.
--
-- Safe on a live table: `if not exists`, additive, no constraint, so it can
-- never fail on existing data. NOT `concurrently`: both scripts/db-migrate.mjs
-- and the app's self-bootstrap (src/lib/db/bootstrap.ts) run each migration
-- inside a transaction, where CREATE INDEX CONCURRENTLY is refused. These
-- tables are small enough (thousands to low hundreds of thousands of rows)
-- that the brief SHARE lock of a plain build is the lesser cost.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create index if not exists customers_email_exact_idx
  on public.customers (email);

create index if not exists loyalty_stamps_owner_created_idx
  on public.loyalty_stamps ("customerEmail", "createdAt");

create index if not exists customer_coupons_owner_created_idx
  on public.customer_coupons ("customerEmail", "createdAt");

create index if not exists counter_tokens_owner_created_idx
  on public.counter_tokens ("customerEmail", "createdAt");

create index if not exists invites_inviter_created_idx
  on public.invites ("inviterEmail", "createdAt");

create index if not exists invites_invitee_exact_idx
  on public.invites ("inviteeEmail");

create index if not exists newsletter_subscribers_email_exact_idx
  on public.newsletter_subscribers (email);
