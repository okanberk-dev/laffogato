-- Order fulfillment tracking: carrier name, tracking number, and shipped
-- timestamp so the shop owner can record a shipment and the customer can see it.
alter table public.orders add column if not exists "trackingNumber" text not null default '';
alter table public.orders add column if not exists "carrier"        text not null default '';
alter table public.orders add column if not exists "shippedAt"      text not null default '';
