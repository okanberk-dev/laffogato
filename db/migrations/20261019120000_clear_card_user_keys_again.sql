-- Card storage never went live: clear the member keys a second time.
--
-- 20261018200000_clear_unused_card_user_keys.sql cleared every
-- `customers."cardUserKey"` once (18 Ekim 2026). From about 22:38 that night
-- until 08:05 on 19 Ekim, laffogato.net was served by an older deployment
-- (feat/home-hero-panel 014d51b, promoted to production by hand) whose app
-- order and member karaoke payment still minted a key for every member who
-- paid. Card storage was never on: Vercel's environment list (read 18 Ekim
-- 2026) has no PAYNKOLAY_CARD_STORAGE in any environment, so no card sits
-- under any key. Current main mints no key while storage is off (#150).
--
-- Only the key moves; "updatedAt" stays. Once only, like every data step the
-- bundle replays: a key minted later, with card storage and its texts on,
-- must stay.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.customers
   set "cardUserKey" = ''
 where "cardUserKey" <> ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019120000_clear_card_user_keys_again.sql'
   );
