-- Phone notifications for an order's stages (22 Oct 2026; docs/API-MOBILE.md
-- §23, src/lib/push/*).
--
-- The app asks for notification permission only after the member places an
-- order and taps "Bildirim aç". If they allow it, the app sends its Expo push
-- token here (POST /api/mobile/v1/devices) and the server tells that phone
-- when a café order is being made, is ready at the counter, left with the
-- courier, when a parcel is handed to the carrier, and when a paid order is
-- cancelled. Transactional only: no marketing push (6563; açık rıza R8).
--
--   customer_devices     one row per token: whose it is (the member's e-mail,
--                        lower case), the platform read from the request,
--                        when it was registered and last refreshed. Deleted
--                        on sign-out, account closure, when Expo says the
--                        token reaches no device, and by retention after 180
--                        days without a refresh (src/lib/retention.ts).
--   order_push_notices   one row per (order, kind): the "once" of each push,
--                        and the accepted tickets (token + ticket id) until
--                        the daily job reads Expo's receipts; then cleared.
--
-- `register_customer_device` upserts a token and drops the member's oldest
-- devices beyond the cap in one statement (CLAUDE.md rule 20): a token moves
-- to whoever registers it last, so a shared phone follows its current member.
--
-- New tables only; nothing existing changes. Re-runnable.
--
-- Rollback (nothing else reads them):
--   drop function if exists public.register_customer_device(text, text, text, text, integer);
--   drop table if exists public.order_push_notices;
--   drop table if exists public.customer_devices;

create table if not exists public.customer_devices (
  token text primary key,
  "customerEmail" text not null,
  platform text not null default '',
  "createdAt" text not null,
  "updatedAt" text not null,
  constraint customer_devices_platform_check
    check (platform in ('', 'ios', 'android')),
  constraint customer_devices_email_lower
    check ("customerEmail" = lower("customerEmail"))
);

create index if not exists customer_devices_member_idx
  on public.customer_devices ("customerEmail", "updatedAt");

alter table public.customer_devices enable row level security;

create table if not exists public.order_push_notices (
  "orderId" text not null,
  kind text not null,
  status text not null default 'sending',
  tickets jsonb not null default '[]'::jsonb,
  error text not null default '',
  "createdAt" text not null,
  "sentAt" text not null default '',
  "receiptsCheckedAt" text not null default '',
  primary key ("orderId", kind),
  constraint order_push_notices_status_check
    check (status in ('sending', 'sent', 'none', 'failed'))
);

create index if not exists order_push_notices_receipts_idx
  on public.order_push_notices ("sentAt")
  where status = 'sent' and "receiptsCheckedAt" = '';

alter table public.order_push_notices enable row level security;

create or replace function public.register_customer_device(
  p_token text,
  p_email text,
  p_platform text,
  p_now text,
  p_cap integer
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_dropped integer := 0;
begin
  insert into public.customer_devices as d
    (token, "customerEmail", platform, "createdAt", "updatedAt")
  values (p_token, v_email, coalesce(p_platform, ''), p_now, p_now)
  on conflict (token) do update
    set "customerEmail" = excluded."customerEmail",
        platform = case
          when excluded.platform <> '' then excluded.platform
          else d.platform
        end,
        "updatedAt" = excluded."updatedAt";

  delete from public.customer_devices d
   using (
     select token,
            row_number() over (order by "updatedAt" desc, token) as rn
       from public.customer_devices
      where "customerEmail" = v_email
   ) ranked
   where d.token = ranked.token
     and ranked.rn > greatest(p_cap, 1);
  get diagnostics v_dropped = row_count;
  return v_dropped;
end;
$$;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
