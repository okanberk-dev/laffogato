-- Take the four placeholder press quotes off the site and the app.
--
-- "Monocle", "Cereal", "Time Out İstanbul" and "Condé Nast Traveler" were
-- written into `data.ts` on 26 May 2026 by the first design implementation
-- (33635fd) - mock-up copy, later seeded into `press` by the panel resource
-- (cfc6ac5). Nothing shows any of them was ever said: they attribute praise
-- to real publications, and one quotes a price ("130₺") the menu no longer
-- charges. A quote from a publication that never gave it is a false
-- endorsement, on the page and in the app's story screen alike.
--
-- DEACTIVATED, NOT DELETED. The rows stay in /admin/basin, switched off, so
-- the operator can switch a genuine one back on (with its source) in one
-- click. Deleting them would also empty the table, and the panel resource
-- re-seeds an empty table on first read. `data.ts` no longer seeds them.
--
-- IDEMPOTENT and SAFE: only the seeded ids, only while they still carry the
-- seeded outlet name - a row the operator replaced is left alone.
--
-- Rollback: set "isActive" = true on the same ids.

update public.press
   set "isActive" = false,
       "updatedAt" = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 where id in ('press-001', 'press-002', 'press-003', 'press-004')
   and name in ('Monocle', 'Cereal', 'Time Out İstanbul', 'Condé Nast Traveler')
   and "isActive" = true;
