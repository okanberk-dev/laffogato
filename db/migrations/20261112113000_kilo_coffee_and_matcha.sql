-- Four shop products: three one-kilo coffees and a 250 g matcha.
--
-- Operator, 12 Nov 2026: "çekirdek kahvede de kiloluk kahve ekle ve fiyatını
-- kargo dahil 2000 TL yap filtre ekle 1800 TL yap cold brew ekle 2250 TL yap,
-- ve matcha ekle 250 gr fiyatını 6.000 TL yap".
--
-- The ordinary way to add a product is the wizard at /admin/urunler. These
-- four are written here because the instruction came with the prices and
-- nobody was at the panel; from now on they are ordinary rows, edited and
-- removed there like any other product.
--
--   name                       cat     price (TRY)   pack
--   Çekirdek Kahve - 1 kg      beans   2.000         1 kg
--   Filtre Kahve - 1 kg        beans   1.800         1 kg
--   Cold Brew Kahvesi - 1 kg   beans   2.250         1 kg
--   Matcha - 250 g             pantry  6.000         250 g
--
-- "Kargo dahil": every price is above the free-shipping threshold of the
-- day (settings."shippingFreeThresholdMinor", 500 TRY), so checkout adds no
-- shipping line to an order that carries one of them. The tag says so. If
-- the threshold is ever raised above one of these prices, the tag is edited
-- in the panel with it; nothing here pins the threshold.
--
-- Only the instruction is written down: the name, the pack, the price. No
-- origin, roast, grade or tasting note is claimed, no photograph is attached
-- (the card draws its own picture from `img`, a hue name), and the food
-- label carries the net quantity only. Stock is a starting figure the
-- operator corrects in the panel (25, like the seed; 10 for the matcha).
-- `taxRatePct` stays null: beans and pantry are food, 10% by the category
-- default (20261019150000_cafe_food_rate_10.sql).
--
-- RUNS ONCE. The bundle (db/schema.sql) re-applies every file whenever a
-- newer migration ships, so without the `_migrations` check a product the
-- operator deleted or renamed in the panel would come back on the next
-- deploy. scripts/db-migrate.mjs and the bundle both record the file right
-- after it runs.
--
-- NOT ON A NEW DATABASE. A fresh database is seeded by the app after its
-- schema is applied, and `seedOnce` fills a table only while it is empty: a
-- row inserted here would leave a new installation with these four products
-- and nothing else. "New" is an empty `products` table that the store has
-- not yet decided about (no `seed:products` marker in `counters`; every
-- database in use has one since 20261017200100_seed_markers.sql). A shelf
-- the operator emptied has the marker, so it does get the four.
--
-- CANNOT FAIL THE SCHEMA APPLY. The application applies the bundle in one
-- transaction ahead of its first query (src/lib/db/bootstrap.ts); an error
-- here would keep every later migration from applying. So the `prd` counter
-- is first raised to the highest id on the shelf (a counter that fell behind
-- its rows would hand out an id that is taken), a slug that already exists
-- is skipped, and the insert itself yields on any conflict. Whatever is
-- left is caught: the block is undone as a whole (its handler makes it a
-- subtransaction), a warning is logged and the apply goes on. The file is
-- recorded either way, so after a warning the four are added in the panel;
-- GET /api/mobile/v1/shop shows at once whether they arrived.
--
-- Rollback: delete the four rows by slug (or pause them in the panel); the
-- counter is not rewound.

do $$
declare
  item record;
  seq  bigint;
begin
  if exists (
    select 1
      from public._migrations
     where name = '20261112113000_kilo_coffee_and_matcha.sql'
  ) then
    return;
  end if;

  if not exists (select 1 from public.products)
     and not exists (select 1 from public.counters where id = 'seed:products')
  then
    return;
  end if;

  perform public.raise_counter(
    'prd',
    coalesce(
      (
        -- Nine digits at most: a hand-written id longer than a bigint
        -- must not be cast.
        select max(substring(id from '^prd-([0-9]{1,9})$')::bigint)
          from public.products
         where id ~ '^prd-[0-9]{1,9}$'
      ),
      0
    )
  );

  for item in
    select *
      from (
        values
          (
            'Çekirdek Kahve - 1 kg', 'cekirdek-kahve-1-kg', 'CEKI',
            'Çekirdek · 1 kg · Kargo dahil', 200000,
            'Bir kiloluk pakette çekirdek kahve. Kargo fiyata dahil.',
            'beans', 'caramel', 25, 1000, '1 kg'
          ),
          (
            'Filtre Kahve - 1 kg', 'filtre-kahve-1-kg', 'FILT',
            'Çekirdek · 1 kg · Kargo dahil', 180000,
            'Filtre demleme için bir kiloluk pakette çekirdek kahve. Kargo fiyata dahil.',
            'beans', 'cream', 25, 1000, '1 kg'
          ),
          (
            'Cold Brew Kahvesi - 1 kg', 'cold-brew-kahvesi-1-kg', 'COLD',
            'Çekirdek · 1 kg · Kargo dahil', 225000,
            'Soğuk demleme için bir kiloluk pakette çekirdek kahve. Kargo fiyata dahil.',
            'beans', 'espresso', 25, 1000, '1 kg'
          ),
          (
            'Matcha - 250 g', 'matcha-250-g', 'MATC',
            'Paket · 250 g · Kargo dahil', 600000,
            '250 gramlık pakette matcha. Kargo fiyata dahil.',
            'pantry', 'matcha', 10, 250, '250 g'
          )
      ) as v (
        name, slug, sku_prefix, tag, price_minor, body, cat, hue, stock,
        weight_grams, net_quantity
      )
  loop
    continue when exists (
      select 1 from public.products as p where p.slug = item.slug
    );

    seq := public.next_seq('prd');

    insert into public.products (
      id, name, slug, sku, tag, "priceMinor", "desc", cat, img, stock,
      "lowStockThreshold", "weightGrams", "isNew", "isActive", "netQuantity",
      "updatedAt"
    )
    values (
      -- Padded, never cut: lpad shortens a longer string (10000 -> 1000).
      'prd-' || lpad(seq::text, greatest(4, length(seq::text)), '0'),
      item.name,
      item.slug,
      item.sku_prefix || '-' || lpad(seq::text, greatest(5, length(seq::text)), '0'),
      item.tag,
      item.price_minor,
      item.body,
      item.cat,
      item.hue,
      item.stock,
      5,
      item.weight_grams,
      true,
      true,
      item.net_quantity,
      to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
    on conflict do nothing;
  end loop;
exception
  when others then
    raise warning 'kilo_coffee_and_matcha: nothing added (%)', sqlerrm;
end;
$$;
