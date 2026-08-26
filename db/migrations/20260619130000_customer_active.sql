-- Customer account activation flag: admins can deactivate a member account so
-- it can no longer sign in or place orders, without deleting their data. Existing
-- rows default to active.
alter table public.customers
  add column if not exists "isActive" boolean not null default true;

create index if not exists customers_active_idx on public.customers ("isActive");
