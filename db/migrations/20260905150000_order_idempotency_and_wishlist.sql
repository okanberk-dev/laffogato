-- Two writes that had no protection against being done twice.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── orders."clientOrderId" ────────────────────────────────────────────────
-- The app's own id for ONE checkout attempt (docs/API-MOBILE.md §3).
--
-- POST /orders could not tell a retry from a second order: the phone gives up
-- on a slow response while the server is still mailing the confirmation and
-- opening the checkout session, and the member taps "Tekrar dene". That left
-- two pending orders, two e-mails, two held stock claims — and, after three
-- tries, a 429 lock-out for the rest of the expiry window.
--
-- The index is partial and per member: '' (web, admin, older app builds) is
-- exempt, and one client's id can never collide with another member's.
alter table public.orders
  add column if not exists "clientOrderId" text not null default '';

create unique index if not exists orders_client_order_id_key
  on public.orders (lower("customerEmail"), "clientOrderId")
  where "clientOrderId" <> '';

-- ── toggle_wishlist ───────────────────────────────────────────────────────
-- Adds or drops one product id in customers.wishlist, in one statement.
--
-- The site and the app edit the same list, and the toggle used to be a
-- read-modify-write in JavaScript: two surfaces toggling at the same moment
-- each wrote a whole array computed from the state before the other's write,
-- so one of the two toggles was lost. The row is locked here instead.
--
-- An id that names no product is refused rather than stored: /me/favorites
-- validated nothing, so any 64-character string ended up in the list and the
-- app had to filter it out on every render. Removal is never refused, so a
-- product deleted from the catalogue can still be taken off the list.
--
-- Returns 'added' | 'removed' | 'full' | 'not_found' (no such product) |
-- 'no_customer'.
create or replace function public.toggle_wishlist(
  p_email text,
  p_product_id text,
  p_now text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  current  jsonb;
  next_val jsonb;
  outcome  text;
begin
  select wishlist into current
    from public.customers
    where email = p_email
    for update;

  if current is null then
    return 'no_customer';
  end if;

  if current ? p_product_id then
    next_val := current - p_product_id;
    outcome := 'removed';
  elsif not exists (
    select 1 from public.products where id = p_product_id
  ) then
    return 'not_found';
  elsif jsonb_array_length(current) >= 200 then
    return 'full';
  else
    next_val := current || to_jsonb(p_product_id);
    outcome := 'added';
  end if;

  update public.customers
    set wishlist = next_val,
        "updatedAt" = p_now
    where email = p_email;

  return outcome;
end;
$$;
