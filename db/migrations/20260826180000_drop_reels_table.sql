-- Drop the reels table.
--
-- The Reels section (customer page, home teaser, admin management) was
-- removed from the app; nothing in src/ references this table any more, so
-- it is schema for a feature that no longer exists.
--
-- `if exists` so the migration is safe on a database created after this
-- point, and `cascade` to take the index and RLS policy with it.

drop table if exists public.reels cascade;
