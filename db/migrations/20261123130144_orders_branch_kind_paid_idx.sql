-- A branch's café orders by payment (23 Nov 2026).
--
-- `GET /api/panel/orders` names the orders that left the bar screen in the
-- last 48 hours and why (`closed`: completed, cancelled, refunded;
-- src/lib/admin/store.ts `listPanelClosedOrderRows`), for LafPOS to keep
-- the outcome with the order it closes. Those orders are in statuses every
-- past order is in too, so `orders_status_idx` does not narrow the read:
-- without this index it reads every completed order of every day. With it
-- the read is the branch's café orders of the screen's eight days
-- (branch and kind equal, "paidAt" a range), newest first.
--
-- Additive only; re-runnable. The table is small (one row per order), so
-- the plain (locking) build takes moments.
--
-- Rollback (nothing depends on it but the read's speed):
--   drop index if exists public.orders_branch_kind_paid_idx;

create index if not exists orders_branch_kind_paid_idx
  on public.orders (branch, kind, "paidAt");

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
