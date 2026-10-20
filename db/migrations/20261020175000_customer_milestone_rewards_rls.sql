-- Row level security on customer_milestone_rewards (20 Oct 2026).
--
-- Every other table in the schema has RLS on and no policy;
-- customer_milestone_rewards (20260923200000) was the one table created
-- without it. On Neon nothing changes: the app connects as the table's
-- owner, and an owner is not subject to RLS. On a Supabase database the
-- difference is real: every table in `public` is exposed through PostgREST,
-- and without RLS the anon and authenticated roles could read which member
-- got which gift, and write rows that stop a milestone from ever being
-- granted (its primary key is the grant's guard). RLS without a policy
-- closes the table to those roles, as for every other table.
--
-- No policy on purpose, and no grant: the roles above do not exist on Neon,
-- and the app never needs one (docs/SUPABASE-GECIS.md §1).
-- tests/db-rls.test.ts holds RLS on for every table the schema creates.
--
-- Re-runnable (enabling RLS twice is a no-op). Rollback:
--   alter table public.customer_milestone_rewards disable row level security;

alter table public.customer_milestone_rewards enable row level security;
