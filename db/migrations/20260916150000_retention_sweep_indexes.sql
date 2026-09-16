-- Periodic destruction (KVKK) — the indexes the retention sweep needs.
--
-- The published Veri Saklama ve İmha Politikası promises periodic destruction
-- and a retention period per data category; src/lib/retention.ts is the job
-- that finally carries it out, and /api/cron/retention runs it daily. Each
-- rule is `where <timestamp column> < cutoff`, and two of the four tables had
-- no index on that column, so the sweep would have been a sequential scan of
-- the two tables most likely to be large.
--
-- Nothing here changes a row, a column or a constraint: two indexes, both
-- `if not exists`, both droppable. Rolling back is
--   drop index if exists public.auth_attempts_updated_idx;
--   drop index if exists public.campaign_email_sends_created_idx;
-- and the application keeps working — the sweep merely gets slow again.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── auth_attempts."updatedAt" ─────────────────────────────────────────────
-- The retention rule with the shortest period (a week) and the table with the
-- most personal key: `<purpose>::<IP>::<e-mail>`. It is also the only rule
-- expected to match rows on an ordinary day.
create index if not exists auth_attempts_updated_idx
  on public.auth_attempts ("updatedAt");

-- ── campaign_email_sends."createdAt" ──────────────────────────────────────
-- One row per (campaign, recipient) and it never shrank: the three-year
-- commercial-mail record from the Ticari İletişim Yönetmeliği is the biggest
-- table the sweep touches. Existing indexes are on ("campaignId", email) and
-- ("campaignId", status, "batchNo"); neither helps an age cutoff.
create index if not exists campaign_email_sends_created_idx
  on public.campaign_email_sends ("createdAt");
