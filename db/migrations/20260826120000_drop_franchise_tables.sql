-- Drop the franchise tables.
--
-- The franchise page and its admin screens were removed from the app; nothing
-- in src/ references these tables any more, so they are schema for a feature
-- that no longer exists. Dropping them keeps the database honest about what
-- the product actually is.
--
-- `if exists` so the migration is safe on a database created after this point,
-- and `cascade` to take the indexes and constraints with them.

drop table if exists public.franchise_applications cascade;
drop table if exists public.franchise_process cascade;
drop table if exists public.franchise_packages cascade;
