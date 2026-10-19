-- The label of a packaged food in the shop (19 Oct 2026, X-TGK-SHOP).
--
-- Packaged food sold at a distance carries every mandatory label item but
-- the date before the purchase is completed, and all of them at delivery
-- (TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği m.17/2-a,
-- b): the items of m.9/1 are the name, the ingredients, the Ek-1 allergens,
-- the net quantity, special storage or use conditions, the food business
-- operator's name and address, the business registration number, the
-- country of origin, the instructions where needed and the nutrition
-- declaration. The product had a description, a shipping weight and the
-- `nuts` tag; the distance sales pre-information already says the product
-- page carries the rest.
--
--   allergens          jsonb, nullable, no default. The menu's three states
--                      (20261018210100_menu_item_allergens.sql): NULL not
--                      entered, [] none of the fourteen, keys the groups.
--   ingredients        the ingredient list as the label prints it (with
--                      the quantity of a named ingredient, m.9/1-ç)
--   netQuantity        "250 g", "6 adet"
--   storageConditions  special storage conditions
--   usageInstructions  how to use it, where it cannot be used properly
--                      without them
--   producer           the operator's name or trade name and address
--   businessRegNo      işletme kayıt numarası or approval mark (m.12)
--   origin             country of origin
--   nutrition          the nutrition declaration as written on the label
--
-- '' and NULL mean "not entered": nothing is shown on the product page or
-- sent to the app, and a food page keeps naming the free means (ask the
-- shop before the order). Nothing is guessed: every row starts empty and
-- the operator copies the label.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
--
-- Rollback (nothing else reads the columns):
--   alter table public.products drop column if exists allergens,
--     drop column if exists ingredients, drop column if exists "netQuantity",
--     drop column if exists "storageConditions",
--     drop column if exists "usageInstructions", drop column if exists producer,
--     drop column if exists "businessRegNo", drop column if exists origin,
--     drop column if exists nutrition;

alter table public.products
  add column if not exists allergens jsonb,
  add column if not exists ingredients text not null default '',
  add column if not exists "netQuantity" text not null default '',
  add column if not exists "storageConditions" text not null default '',
  add column if not exists "usageInstructions" text not null default '',
  add column if not exists producer text not null default '',
  add column if not exists "businessRegNo" text not null default '',
  add column if not exists origin text not null default '',
  add column if not exists nutrition text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_allergens_check'
       and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_allergens_check
      check (
        allergens is null
        or (
          jsonb_typeof(allergens) = 'array'
          and allergens <@ '["gluten", "kabuklular", "yumurta", "balik",
            "yer_fistigi", "soya", "sut", "sert_kabuklu", "kereviz", "hardal",
            "susam", "sulfit", "aci_bakla", "yumusakcalar"]'::jsonb
        )
      ) not valid;
  end if;
end $$;
