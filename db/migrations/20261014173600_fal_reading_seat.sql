-- fA'L daily quota: the seat is taken in SQL, under a per-member lock.
--
-- POST /api/mobile/v1/fal counted today's readings, asked the model (a paid
-- OpenAI call, seconds long) and wrote the reading's row only after the
-- answer, so a burst of parallel requests all read "2 of 3" and every one of
-- them was paid for. Ranking an inserted row among the member's rows by id
-- narrowed that window but did not close it: an earlier id can still be
-- uncommitted when a later one ranks itself, and six parallel requests
-- against a real Postgres let a fourth through about once in twenty runs
-- (tests/db-integration-fal-seat.test.ts).
--
-- reserve_fal_reading takes a transaction-level advisory lock on the member
-- and the Istanbul day, counts, and inserts only under the limit, in one
-- statement (CLAUDE.md rules 20 and 30): the next caller for the same member
-- waits for the lock, and its count sees the row this one committed.
-- Returns jsonb {id, used} (rpc() reads one cell; `used` is how many seats
-- were taken before this one), or null when the day's seats are gone.
--
-- Additive and idempotent: a new function, no table change.
create or replace function public.reserve_fal_reading(
  p_email      text,
  p_day        text,
  p_limit      integer,
  p_created_at text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_used integer;
  v_id   bigint;
begin
  perform pg_advisory_xact_lock(hashtext('fal-seat:' || p_email || ':' || p_day));
  select count(*) into v_used
    from public.fal_readings
   where "customerEmail" = p_email
     and day = p_day;
  if v_used >= p_limit then
    return null;
  end if;
  insert into public.fal_readings ("customerEmail", day, "createdAt", model, "cupSeen")
  values (p_email, p_day, p_created_at, '', false)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'used', v_used);
end;
$$;
