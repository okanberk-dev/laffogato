-- Card storage never went live: clear the member keys minted for it.
--
-- `customers."cardUserKey"` is the key PayNkolay files a member's saved cards
-- under (docs/PAYNKOLAY.md §16). Card storage was never turned on (rule 28),
-- yet the app order (src/lib/mobile/orders.ts) and the member's karaoke
-- payment (src/lib/mobile/karaoke-payment.ts) minted one for every member
-- who paid there. No card sits under any of them: the key reaches PayNkolay
-- only while card storage is on (`cardStorageEnabled`, paynkolay.ts), and
-- Vercel's environment list (read 18 Ekim 2026) has no PAYNKOLAY_CARD_STORAGE
-- in any environment, so storage was never on in production (OP-28). Since 18 Ekim 2026 the legal texts name no
-- saved card and no path mints a key while storage is off, so a stored key is
-- personal data no notice names (KVKK m.4/2-ç, m.10; Aydınlatma Tebliği
-- m.5/1-j). Cleared here, once.
--
-- Only the key moves; "updatedAt" stays (the code wrote the key, not the
-- member). Once only, like every data step the bundle replays: a key minted
-- after this ran, with card storage and its texts on, must stay.
--
-- Undo: nothing to restore. The key is random; ensureCardUserKey mints a new
-- one at the member's next payment while card storage is on.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.customers
   set "cardUserKey" = ''
 where "cardUserKey" <> ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018200000_clear_unused_card_user_keys.sql'
   );
