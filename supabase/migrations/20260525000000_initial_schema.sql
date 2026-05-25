-- Laffogato initial schema
-- Convention: snake_case identifiers, integer minor units for money, RLS on for every table.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Reference: admin role membership
-- ============================================================================
create type public.admin_role as enum ('owner', 'manager', 'staff');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role admin_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Catalog
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  -- Price stored as minor units (kuruş) to avoid float rounding.
  price_minor int not null check (price_minor >= 0),
  currency text not null default 'TRY',
  image_url text,
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_active_idx on public.products (is_active) where is_active;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price_delta_minor int not null default 0,
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id);

-- ============================================================================
-- Cart (anonim + login)
-- ============================================================================
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  -- Cookie token (anonim sepet için) ya da auth user_id'si.
  token text unique,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_has_owner check (token is not null or user_id is not null)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id, variant_id)
);

-- ============================================================================
-- Orders
-- ============================================================================
create type public.order_status as enum (
  'pending_payment',
  'paid',
  'preparing',
  'shipped',
  'completed',
  'cancelled',
  'refunded'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigserial unique,
  user_id uuid references auth.users(id) on delete set null,
  status order_status not null default 'pending_payment',
  subtotal_minor int not null check (subtotal_minor >= 0),
  shipping_minor int not null default 0 check (shipping_minor >= 0),
  total_minor int not null check (total_minor >= 0),
  currency text not null default 'TRY',
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  billing_address jsonb not null,
  shipping_address jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name text not null,
  variant_name text,
  unit_price_minor int not null check (unit_price_minor >= 0),
  quantity int not null check (quantity > 0),
  line_total_minor int not null check (line_total_minor >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- ============================================================================
-- Payment transactions (idempotent)
-- ============================================================================
create type public.payment_status as enum (
  'initiated',
  'succeeded',
  'failed',
  'refunded'
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  status payment_status not null,
  amount_minor int not null check (amount_minor >= 0),
  currency text not null default 'TRY',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- ============================================================================
-- Cafe settings (singleton)
-- ============================================================================
create table public.cafe_settings (
  id int primary key default 1,
  name text not null default 'Laffogato',
  tagline text,
  phone text,
  email text,
  address text,
  opening_hours jsonb,
  hero_image_url text,
  is_shop_open boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint cafe_settings_singleton check (id = 1)
);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger cafe_settings_set_updated_at
  before update on public.cafe_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.admin_users          enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.carts                enable row level security;
alter table public.cart_items           enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.cafe_settings        enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;

-- Public read: aktif katalog
create policy "categories_public_read"
  on public.categories for select
  using (is_active or public.is_admin(auth.uid()));

create policy "products_public_read"
  on public.products for select
  using (is_active or public.is_admin(auth.uid()));

create policy "product_variants_public_read"
  on public.product_variants for select
  using (is_active or public.is_admin(auth.uid()));

create policy "cafe_settings_public_read"
  on public.cafe_settings for select
  using (true);

-- Admin writes (RLS düzeyinde — service role zaten by-pass eder)
create policy "categories_admin_write"
  on public.categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "products_admin_write"
  on public.products for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "product_variants_admin_write"
  on public.product_variants for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "cafe_settings_admin_write"
  on public.cafe_settings for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Carts: kullanıcı kendi sepetini görür/yönetir. Anonim cookie token'lı sepetler
-- yalnızca service role üzerinden erişilir (token client'a hiç gönderilmez).
create policy "carts_owner_select"
  on public.carts for select
  using (user_id = auth.uid());

create policy "carts_owner_write"
  on public.carts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cart_items_owner_select"
  on public.cart_items for select
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

create policy "cart_items_owner_write"
  on public.cart_items for all
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid()
    )
  );

-- Orders: kullanıcı kendi siparişini görür; admin hepsini görür.
create policy "orders_owner_select"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "orders_admin_write"
  on public.orders for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "order_items_select"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Payment transactions: yalnızca admin doğrudan okur. Insert/update service role.
create policy "payment_transactions_admin_select"
  on public.payment_transactions for select
  using (public.is_admin(auth.uid()));

-- Admin users: kendi satırını görebilir, ekleme/silme owner rolüne ait.
create policy "admin_users_self_select"
  on public.admin_users for select
  using (user_id = auth.uid());

create policy "admin_users_owner_write"
  on public.admin_users for all
  using (
    exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.role = 'owner'
    )
  );
