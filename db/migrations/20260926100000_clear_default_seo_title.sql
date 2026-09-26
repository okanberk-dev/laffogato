-- The home page reads settings."seoTitle" first and falls back to its own
-- keyword title ("Tuzla'da İtalyan Kahve, Affogato & Gelato - L'Affogato").
-- The seeded default was the short "L'Affogato - Tuzla", so the fallback was
-- never reached and the home page ranked on an 18-character title. Clear the
-- value only where it is still that untouched default; an operator's own
-- title stays.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.settings
   set "seoTitle" = ''
 where "seoTitle" = 'L''Affogato - Tuzla';
