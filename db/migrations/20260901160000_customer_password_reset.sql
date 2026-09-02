-- Password reset.
--
-- Four of the published documents promise it — the Gizlilik Politikası says
-- outright that a forgotten password can only be recovered by "sıfırlama
-- bağlantısı" — and there was no such flow, no column, no page. A member who
-- forgot their password had no way back into their own order history.
--
-- Kept separate from the e-mail verification token: reusing that one would let
-- a pending verification link double as a password reset, and issuing a reset
-- would silently invalidate a verification the member had not finished.
alter table public.customers
  add column if not exists "resetToken"   text not null default '',
  add column if not exists "resetExpires" text not null default '';

-- Partial: only the handful of rows with a live token, and the lookup is
-- always by the token itself.
create unique index if not exists customers_reset_token_idx
  on public.customers ("resetToken")
  where "resetToken" <> '';
