-- The POS's own calendar day for a payment, on the payment row.
--
-- PayNkolay's cancel/refund service requires the transaction date (trxDate,
-- docs/PAYNKOLAY.md §3) and nothing stored it, so every refund first searched
-- the reporting service month by month, up to 13 windows back, for the
-- REFERENCE_CODE (§14.5). The verification query that settles a payment
-- already returns TRX_DATE; applyPaymentSucceeded now writes it here as
-- `YYYY-MM-DD` and the refund reads it first. '' means "not known": rows
-- written before this file, and providers that report no date. The refund
-- falls back to the search for those, exactly as before.
--
-- Additive and idempotent: a constant default makes the column add a catalog
-- change only, and `if not exists` makes a replay a no-op.

alter table public.payment_transactions
  add column if not exists "trxDate" text not null default '';
