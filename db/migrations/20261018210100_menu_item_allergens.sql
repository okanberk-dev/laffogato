-- The fourteen allergen groups per cafe menu item (18 Oct 2026).
--
-- Decision OP-ALLERGEN-BOARD (operator, 18 Oct 2026: "avukata sorma, sen
-- karar ver"): a place serving unpackaged food shows, for every item, which
-- of the fourteen groups of TGK Gıda Etiketleme Yönetmeliği Ek-1 it contains,
-- on the menu or a board (m.15/5), and before the purchase when it sells at
-- a distance, as the app does (m.17/3). The menu had a general cross-contact
-- line and, in the app, only the `nuts` tag. Keys and labels:
-- src/lib/menu/allergens.ts.
--
--   menu_items.allergens  jsonb, nullable, no default.
--     NULL      not entered yet: nothing is shown next to the item and
--               GET /api/mobile/v1/menu leaves the field out (§1).
--     []        entered: the item contains none of the fourteen.
--     ["sut"]   the groups it contains, keys from the closed list below.
--
-- Every existing row starts NULL: the operator enters the items in
-- /admin/menu from the table of the kiosk's allergen board. Nothing is
-- guessed from the item's name or from the `nuts` tag.
--
-- The check refuses anything that is not an array of known keys, whatever
-- writes it. Added NOT VALID: every existing value is NULL, which passes, and
-- the table is not scanned under the lock. Re-runnable: the bundle replays
-- every migration when a deploy adds one.
--
-- Rollback (nothing else reads the column):
--   alter table public.menu_items drop column if exists allergens;

alter table public.menu_items add column if not exists allergens jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'menu_items_allergens_check'
       and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_allergens_check
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
