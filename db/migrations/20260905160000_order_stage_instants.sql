-- Per-stage instants for an order.
--
-- `orders` recorded when a row was created, paid and shipped. "Hazırlanıyor"
-- and "Teslim edildi" had no instant of their own, so both the app's timeline
-- and the notification inbox fell back to `paidAt` for them: a gift box paid
-- on the 1st and delivered on the 20th told the member it was delivered on the
-- 1st, and — because the inbox only keeps 30 days per stage — a stage reached
-- today could be filtered out as if it were a month old.
--
-- `shippedAt` already existed but was written only by the shipping form, which
-- asks for a carrier and a tracking number. A pickup or courier order never
-- goes through that form, so its third timeline step stayed blank; the same
-- transition now stamps it.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.orders add column if not exists "preparingAt" text not null default '';
alter table public.orders add column if not exists "completedAt" text not null default '';
