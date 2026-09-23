-- Milestone gifts (karar 175): 10 lifetime stamps -> a Filtre Kahve, 20 -> an
-- Americano, 30 and 40 -> a drink or dessert picked at random from the menu.
--
-- One row per member and milestone. The primary key is the guard: the grant
-- writes its row FIRST and only then mints the coupon, so two paid orders
-- landing at the same moment cannot both give the tenth-stamp gift. The row
-- then records what was given - the coupon, the item and its value at the
-- time - so a random pick is on the record, not only in a log.
-- Same conventions as the rest of the schema: camelCase-quoted columns,
-- ISO-8601 text dates, integer minor units.
create table if not exists public.customer_milestone_rewards (
  "customerEmail" text    not null,
  milestone       integer not null,
  "couponId"      text    not null default '',
  "menuItemId"    text    not null default '',
  "itemName"      text    not null default '',
  "valueMinor"    integer not null default 0,
  "createdAt"     text    not null default '',
  primary key ("customerEmail", milestone)
);
