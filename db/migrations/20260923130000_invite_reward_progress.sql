-- Which of an invite's two free-drink coupons were already granted
-- (docs/AUDIT.md §8, "Açık" 10).
--
-- rewardInviteOnFirstPaidOrder grants the invitee's coupon, then the
-- inviter's. When the second grant threw, the invite went back to `pending`
-- so that a retry would settle it — and the retry granted the invitee a
-- SECOND coupon. Each grant now records the coupon it produced on the invite;
-- a retry grants only what is still missing.
-- Additive: two text columns with '' defaults every existing row satisfies.
alter table public.invites
  add column if not exists "inviteeCouponId" text not null default '',
  add column if not exists "inviterCouponId" text not null default '';
