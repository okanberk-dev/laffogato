-- Authentication state that must survive a process.
--
-- Both of these lived in module-scoped Maps. On a single long-lived VM that
-- works; on Vercel every serverless instance gets its own empty Map, so:
--
--   * an admin who enrolled in 2FA was asked for a code on one instance and
--     waved straight through on the next — the second factor was, in effect,
--     optional;
--   * the login lockout counted to five per instance, so an attacker got five
--     attempts per cold start rather than five in total.

-- ── admin_2fa ─────────────────────────────────────────────────────────────
-- One enrolled authenticator per admin. `secret` is the TOTP shared secret;
-- it never leaves the server (the QR is rendered from it during enrollment).
create table if not exists public.admin_2fa (
  email        text primary key,
  secret       text not null,
  enabled      boolean not null default false,
  "enrolledAt" text not null default '',
  "updatedAt"  text not null default ''
);

alter table public.admin_2fa enable row level security;

-- ── auth_attempts ─────────────────────────────────────────────────────────
-- Shared failure counter for every credential check: admin login, customer
-- login and TOTP verification. The key is scoped by purpose so the three do
-- not share a budget.
--
-- `firstFailedAt` anchors the sliding window; `lockedUntil` is the instant the
-- key is allowed to try again. Both are ISO-8601 text, like every other
-- timestamp in this schema.
create table if not exists public.auth_attempts (
  key             text primary key,
  "failedCount"   int  not null default 0,
  "firstFailedAt" text not null default '',
  "lockedUntil"   text not null default '',
  "updatedAt"     text not null default ''
);

alter table public.auth_attempts enable row level security;

create index if not exists auth_attempts_locked_idx
  on public.auth_attempts ("lockedUntil");

-- ── record_auth_failure ───────────────────────────────────────────────────
-- Counts one failure and returns the row that resulted, atomically.
--
-- A read-modify-write would lose concurrent failures — exactly the traffic
-- pattern a brute-force attempt produces, so the lost updates would be the
-- attacker's. The window resets when it has expired; reaching the cap sets the
-- lockout and clears the count so it starts fresh afterwards.
create or replace function public.record_auth_failure(
  p_key         text,
  p_now         text,
  p_window_ms   bigint,
  p_max_fails   int,
  p_lockout_ms  bigint
)
returns table ("failedCount" int, "lockedUntil" text)
language plpgsql
set search_path = ''
as $$
declare
  now_ms bigint := (extract(epoch from p_now::timestamptz) * 1000)::bigint;
begin
  insert into public.auth_attempts (key, "failedCount", "firstFailedAt", "lockedUntil", "updatedAt")
    values (p_key, 1, p_now, '', p_now)
  on conflict (key) do update set
    -- Outside the window? Start a new one at 1.
    "failedCount" = case
      when public.auth_attempts."firstFailedAt" = ''
        or (extract(epoch from p_now::timestamptz) * 1000)::bigint
           - (extract(epoch from public.auth_attempts."firstFailedAt"::timestamptz) * 1000)::bigint
           > p_window_ms
      then 1
      else public.auth_attempts."failedCount" + 1
    end,
    "firstFailedAt" = case
      when public.auth_attempts."firstFailedAt" = ''
        or (extract(epoch from p_now::timestamptz) * 1000)::bigint
           - (extract(epoch from public.auth_attempts."firstFailedAt"::timestamptz) * 1000)::bigint
           > p_window_ms
      then p_now
      else public.auth_attempts."firstFailedAt"
    end,
    "updatedAt" = p_now;

  -- Cap reached: lock out and reset the window.
  update public.auth_attempts a
    set "lockedUntil" = to_char(
          (p_now::timestamptz + (p_lockout_ms || ' milliseconds')::interval) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        "failedCount"  = 0,
        "firstFailedAt" = ''
    where a.key = p_key and a."failedCount" >= p_max_fails;

  return query
    select a."failedCount", a."lockedUntil"
    from public.auth_attempts a
    where a.key = p_key;
end;
$$;
