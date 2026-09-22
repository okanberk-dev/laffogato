-- Orders: where the PARCEL is, as distinct from where the order is.
--
-- The app retired its live-tracking map (lafmobil, 22 Eyl 2026). The map drew
-- a line that came from no feed at all, which promised a position the köşk
-- cannot offer: it runs no couriers whose phones it can read, and it buys
-- carriage from cargo firms through Geliver. What a carrier publishes is a
-- handful of milestones, so that is what the phone now shows — "Yola çıktı →
-- Yolda → Teslim edildi" (docs/API-MOBILE.md §3.1).
--
-- `orders.status` cannot carry it. That column is where the order stands in
-- the köşk's own machine and the shop owner drives it; a parcel is
-- `in_transit` for two days while the order sits at `shipped`, and collapsing
-- the two would make one of them lie. Hence a second, carrier-owned column.
--
-- `shipmentStatus` holds one of:
--   preparing | shipped | in_transit | delivered | returned | failed
-- and "" while no webhook has ever fired for the order. It is left as free
-- text rather than an enum for the same reason `status` is: a new Geliver
-- value must not be able to fail an INSERT. The mapper validates against the
-- contract's list and ignores anything else.
--
-- Until the Geliver account exists every row keeps "" and the mobile mapper
-- derives what it can from the panel's own shipping form (carrier + tracking
-- number + the order's status), so the band works on the day this ships.
--
-- Additive, idempotent, and safe to run before or after the deploy: a row
-- written by the old code simply has the defaults, and the app reads an absent
-- field as "not shipped" rather than as an error.
--
-- Rollback (nothing else reads these columns):
--   alter table public.orders drop column if exists "shipmentStatus";
--   alter table public.orders drop column if exists "trackingUrl";
--   alter table public.orders drop column if exists "shipmentUpdatedAt";

alter table public.orders
  add column if not exists "shipmentStatus"    text not null default '',
  add column if not exists "trackingUrl"       text not null default '',
  add column if not exists "shipmentUpdatedAt" text not null default '';

-- The Geliver webhook finds an order by the carrier's tracking number, which
-- is the only identifier both sides share.
create index if not exists orders_tracking_number_idx
  on public.orders ("trackingNumber")
  where "trackingNumber" <> '';
