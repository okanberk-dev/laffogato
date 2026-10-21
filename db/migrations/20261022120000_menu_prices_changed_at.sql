-- The instant a cafe menu price last changed (22 Oct 2026).
--
-- The köşk's back-office panel (ladmin.laffogato.net) may now change a
-- linked menu item's price through POST /api/panel/menu (docs/PANEL-MENU.md),
-- beside this panel's own menu form. The price list's day under the menu
-- (settings."menuPricesEffectiveDate", Fiyat Etiketi Yönetmeliği m.5/2-d)
-- stays the operator's to set (decision OP-PRICE-LISTS: the printed lists at
-- the kiosk carry the same day, nothing guesses it). What this adds is the
-- other half of the comparison: every price change, from either panel,
-- writes the instant here, and Kafe menüsü says when the day is older.
--
--   settings."menuPricesChangedAt"  text, ISO instant; '' = none recorded
--
-- Never printed on the site; no price is read from it. Safe on the live
-- table: a constant default changes only the catalogue. Re-runnable.
--
-- Rollback (nothing else reads the column):
--   alter table public.settings drop column if exists "menuPricesChangedAt";

alter table public.settings add column if not exists "menuPricesChangedAt" text not null default '';
