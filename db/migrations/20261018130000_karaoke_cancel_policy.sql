-- Karaoke: the cancellation and refund rule is set from the panel, and each
-- booking keeps the rule it was made under.
--
-- Operator, 17 Eki 2026: "para tutarı iade edilir kısmını da panelden ayarla".
-- Until now the rule was code: a member's cancel more than 2 hours before the
-- start refunds the whole payment, a later one (and not turning up) refunds
-- nothing (src/lib/mobile/karaoke-time.ts).
--
-- settings (Ayarlar > Karaoke, owner only):
--   "karaokeFreeCancelHours"    0..72, default 2. 0: free cancellation
--                               until the start (ASK-OTH-3-CFG, 18 Eki 2026;
--                               it read "every cancel is late" before).
--   "karaokeLateRefundPercent"  0..100, default 0: the share of the payment a
--                               cancel INSIDE the window refunds while the
--                               start has not come. 0 = such a cancel is
--                               refused, as before.
--   "karaokeCancelPolicyAt"     when the two numbers last moved (ISO, '' =
--                               never). The karaoke document's version moves
--                               with it (src/lib/legal/karaoke-doc.ts).
--
-- karaoke_reservations, the snapshot (TKHK m.4/2, MSY m.5/2: the
-- pre-information a consumer confirmed is part of the contract, and the panel
-- must not change it afterwards). Written by createReservation, never later:
--   "freeCancelHours" "lateRefundPercent"  the policy of the booking
--   "cancelDeadline"                       its last full-refund instant (ISO)
--   "cancellationRules"                    the two sentences shown at booking
--   "refundMinor"                          kuruş owed back / refunded when it
--                                          is NOT the whole payment (a late
--                                          cancel's share); NULL = the whole
-- All NULL on every row written before this: such a row reads 2 hours / 0 %,
-- its deadline is computed from the start, its sentences are the defaults,
-- and its refunds are whole.
--
-- Safe on a live table: nullable columns and checks every existing row
-- satisfies; the settings columns have defaults equal to the old rule.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "karaokeFreeCancelHours"   integer not null default 2;
alter table public.settings add column if not exists "karaokeLateRefundPercent" integer not null default 0;
alter table public.settings add column if not exists "karaokeCancelPolicyAt"    text    not null default '';

alter table public.karaoke_reservations add column if not exists "freeCancelHours"   integer;
alter table public.karaoke_reservations add column if not exists "lateRefundPercent" integer;
alter table public.karaoke_reservations add column if not exists "cancelDeadline"    text;
alter table public.karaoke_reservations add column if not exists "cancellationRules" jsonb;
alter table public.karaoke_reservations add column if not exists "refundMinor"       integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'settings_karaoke_cancel_policy_check'
       and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_karaoke_cancel_policy_check
      check ("karaokeFreeCancelHours" between 0 and 72
             and "karaokeLateRefundPercent" between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_cancel_policy_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_cancel_policy_check
      check (("freeCancelHours" is null or "freeCancelHours" between 0 and 72)
             and ("lateRefundPercent" is null
                  or "lateRefundPercent" between 0 and 100));
  end if;
  -- A partial refund is a share of what was collected: never more, never
  -- negative.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_refund_minor_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_refund_minor_check
      check ("refundMinor" is null
             or ("refundMinor" >= 0 and "refundMinor" <= "paidMinor"));
  end if;
end $$;
