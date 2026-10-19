-- Karaoke alerts leave the consumer Gmail inbox (OP-KARAOKE-MAILBOX,
-- 19 Ekim 2026).
--
-- 20260926090000_karaoke_price_and_notify.sql pointed "karaokeNotifyEmail"
-- at a personal Gmail address. Every karaoke alert carries the guest's name,
-- e-mail, phone and note, so that inbox kept customer data on Google's
-- servers abroad with no processor agreement and no KVKK m.9/4 safeguard
-- (KVKK m.9/1, m.12/2; Yurt Dışına Aktarım Rehberi s.16: storage in a
-- provider's cloud abroad is a transfer). Alerts now go to the company's own
-- mailbox, hosted in Türkiye: empty falls back to the contact address
-- (`settings.email`, `karaokeNoticeRecipient` in src/lib/email/send.ts), and
-- the operator may enter a dedicated company address in Ayarlar -> Karaoke.
--
-- Only that literal is cleared; an address the operator typed later stays.
-- Once only, like every data step the bundle replays (the 26 Eyl update is
-- guarded the same way since this day, so a replay no longer writes the
-- Gmail address back).
--
-- Undo: none wanted. The old address must not come back.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.settings
   set "karaokeNotifyEmail" = ''
 where lower(trim("karaokeNotifyEmail")) = 'bizimfutbol9@gmail.com'
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019160000_karaoke_notify_company_mailbox.sql'
   );
