-- A refund after an issued invoice, handled (review of #231, 23 Oct 2026).
-- The runner notes such a refund (refundNotedAt) and nothing cleared it:
-- the Faturalar "Dikkat" tab, the dashboard and the sidebar badge counted
-- the row for good, after the return document (iade faturası / gider
-- pusulası) had been cut in Paraşüt. A person now marks it handled with
-- that document's number; clearing the order's "Faturalı siparişte iade"
-- mark does too. A later refund notes the row again (src/lib/invoice/run.ts):
-- open while "refundNotedAt" > "refundHandledAt".
--
--   "refundHandledAt"  when a person said the return document was cut
--   "refundHandledBy"  who
--   "refundDocNo"      the return document's number ('' when cleared from
--                      the order without one)
--
-- Re-runnable. Rollback:
--   alter table public.invoices drop column if exists "refundDocNo",
--     drop column if exists "refundHandledBy",
--     drop column if exists "refundHandledAt";

alter table public.invoices
  add column if not exists "refundHandledAt" text not null default '',
  add column if not exists "refundHandledBy" text not null default '',
  add column if not exists "refundDocNo"     text not null default '';
