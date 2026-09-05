-- Karaoke room: one booking per hour, enforced by the database.
--
-- `createReservation` reads the day's bookings, checks the overlap in JS and
-- then inserts. Two members tapping the same free hour in the same second both
-- got through that window and the staff had to cancel one by hand. An
-- exclusion constraint closes it; the insert path maps SQLSTATE 23P01 back to
-- the 409 `slot_taken` the app already shows.
--
-- A cancelled booking does not hold its hour, so it stays out of the index.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'karaoke_reservations_no_overlap'
      and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    -- If this fails with 23P01 the table already holds a double booking made
    -- before the guard existed: cancel one of the two rows and re-run.
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_no_overlap
      exclude using gist (
        date with =,
        int4range("startHour", "startHour" + hours) with &&
      ) where (status <> 'cancelled');
  end if;
end $$;
