-- Şubelerden önce LafPOS'un ve panelin yazdığı veri (22 Nov 2026;
-- tests/sube/pre-branch-data.test.ts).
--
-- 20261121150719_branches.sql wrote every existing row as Tuzla's. Two
-- kinds of row were not Tuzla's, or did not fit the new rule:
--
-- 1. Table codes LafPOS (Marina's till) sent before branches
--    (PUT /api/panel/tables, audit `create` with `via: "lafpos"` and no
--    `branch`) stayed at Tuzla: a QR order or a waiter call from such a
--    card went to Tuzla's panel, and the till's next list was refused whole
--    (409 wrong_branch, tables-link-core.ts). They move to Marina, with the
--    open orders and unanswered calls made at them. Tuzla's own tables (the
--    admin form's, no `via`) and closed orders stay where they are.
--
-- 2. A "Tükendi" the köşk's panel or LafPOS wrote with the one flag before
--    branches is still menu_items."isActive" = false, which now means "off
--    the menu everywhere": Marina was closed by Tuzla's mark and LafPOS could
--    not reopen it (409 site_closed). Only items whose last isActive change
--    was such a write (`via` panel / lafpos, no `branch`) move to the branch
--    row; the site's own form (no `via`) is left alone:
--      via panel  -> Tuzla's row false (Tuzla as it was; Marina on sale);
--      via lafpos -> Marina's row false, and Tuzla's row false too, so
--                    Tuzla does not change (its own panel can reopen it).
--    The row's "updatedAt" is the item's own stamp, and the item's stamp is
--    not moved: lafmaliyet's sold-out marker keys on it (laterStamp).
--
-- Re-runnable: every step only touches rows still in the old state.
--
-- Rollback: none needed for the code; the moved rows can be read back from
-- the audit rows this file keys on.

-- Each step is one statement (data-modifying CTEs see one snapshot), so
-- the file also runs from db/schema.sql in a console that commits every
-- statement.

-- 1. LafPOS's table codes from before branches.
with codes as (
  select distinct t.code
  from public.cafe_tables t
  join public.audit_logs a
    on a.entity = 'cafe_table'
   and a.action = 'create'
   and a.payload ->> 'via' = 'lafpos'
   and not (a.payload ? 'branch')
   and a.payload ->> 'code' = t.code
  where t.branch = 'tuzla'
),
moved_tables as (
  update public.cafe_tables
     set branch = 'marina'
   where branch = 'tuzla'
     and code in (select code from codes)
  returning code
),
moved_orders as (
  update public.orders
     set branch = 'marina'
   where branch = 'tuzla'
     and "tableCode" in (select code from codes)
     and status in ('pending_payment', 'paid', 'preparing', 'shipped')
  returning id
)
update public.table_calls
   set branch = 'marina'
 where branch = 'tuzla'
   and "ackedAt" = ''
   and "tableCode" in (select code from codes);

-- 2. Sold-out marks from before branches.
with sold_out as (
  select m.id, m."updatedAt", l.via, l.actor
  from public.menu_items m
  join lateral (
    select a.payload ->> 'via' as via,
           a.payload ->> 'isActive' as is_active,
           a.payload ? 'branch' as has_branch,
           a.actor
    from public.audit_logs a
    where a.entity = 'menu_item'
      and a."entityId" = m.id
      and a.payload ? 'isActive'
    order by a."createdAt" desc, a.id desc
    limit 1
  ) l on true
  where m."isActive" = false
    and l.is_active = 'false'
    and not l.has_branch
    and l.via in ('panel', 'lafpos')
),
rows_added as (
  insert into public.menu_item_availability
    ("menuItemId", branch, "isActive", "updatedAt", "updatedBy")
  select s.id, b.branch, false, s."updatedAt", s.actor
  from sold_out s
  cross join lateral (
    select 'tuzla' as branch
    union all
    select 'marina' where s.via = 'lafpos'
  ) b
  on conflict ("menuItemId", branch) do nothing
  returning "menuItemId"
)
update public.menu_items
   set "isActive" = true
 where "isActive" = false
   and id in (select id from sold_out);

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
