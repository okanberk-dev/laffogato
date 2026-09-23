-- Admin authentication hardening (docs/AUDIT.md §8, "Açık" 1).
--
-- A TOTP code stays valid for its whole 30-second step (and, with the ±1 step
-- drift tolerance, for up to 90 seconds). Nothing remembered that a code had
-- already been accepted, so one read over a shoulder — or out of a proxy log —
-- could be replayed within that window. `lastStep` is the time step of the
-- last code this admin used; a code is accepted only for a LATER step, and the
-- check-and-set is one conditional UPDATE, so two concurrent submissions of
-- the same code cannot both pass.
--
-- Additive and idempotent: a nullable-free column with a default every
-- existing row satisfies (0 = no code used yet).
alter table public.admin_2fa
  add column if not exists "lastStep" bigint not null default 0;

-- ── reserve_auth_attempt ────────────────────────────────────────────────
-- Counts an authentication attempt BEFORE the credential is checked and says
-- whether it may go ahead. The old sequence was check (JS) → verify → record
-- a failure (SQL): a burst sent in parallel passed the check all at once, so
-- every guess in it was verified whatever the counter said.
--
-- One statement, one transaction, the key's row locked for its duration:
--   · locked out now            → refused, NOT counted (the lockout does not
--                                  grow while someone hammers it);
--   · window expired / first    → count restarts at 1;
--   · this attempt reaches cap  → allowed (it is the last permitted one), the
--                                  lockout starts and the count resets;
--   · otherwise                 → allowed, count + 1.
-- A success clears the key from the application (`clearLoginLimit`).
--
-- Returns jsonb {allowed, remaining, lockedUntil}: rpc() reads one cell, and
-- `remaining` is how many attempts are left if this one fails.
create or replace function public.reserve_auth_attempt(
  p_key        text,
  p_now        text,
  p_window_ms  bigint,
  p_max_fails  int,
  p_lockout_ms bigint
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  now_ts timestamptz := p_now::timestamptz;
  r      public.auth_attempts%rowtype;
  cnt    int;
  until  text;
begin
  insert into public.auth_attempts (key, "failedCount", "firstFailedAt", "lockedUntil", "updatedAt")
    values (p_key, 0, '', '', p_now)
  on conflict (key) do nothing;

  select * into r from public.auth_attempts where key = p_key for update;

  if r."lockedUntil" <> '' and r."lockedUntil"::timestamptz > now_ts then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'lockedUntil', r."lockedUntil");
  end if;

  if r."firstFailedAt" = ''
     or extract(epoch from (now_ts - r."firstFailedAt"::timestamptz)) * 1000 > p_window_ms then
    cnt := 1;
    update public.auth_attempts
       set "failedCount" = 1, "firstFailedAt" = p_now, "updatedAt" = p_now
     where key = p_key;
  else
    cnt := r."failedCount" + 1;
    update public.auth_attempts
       set "failedCount" = cnt, "updatedAt" = p_now
     where key = p_key;
  end if;

  if cnt >= p_max_fails then
    until := to_char(
      (now_ts + (p_lockout_ms || ' milliseconds')::interval) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    update public.auth_attempts
       set "lockedUntil" = until, "failedCount" = 0, "firstFailedAt" = ''
     where key = p_key;
    return jsonb_build_object('allowed', true, 'remaining', 0, 'lockedUntil', until);
  end if;

  return jsonb_build_object('allowed', true, 'remaining', p_max_fails - cnt, 'lockedUntil', '');
end;
$$;
