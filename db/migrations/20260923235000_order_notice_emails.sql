-- Order notices: the one-per-event log behind the shipping, cancellation and
-- refund mails.
--
-- The legal texts promise three transactional mails nothing sent: the
-- tracking number when the parcel is handed to the carrier (Teslimat ve
-- Kargo Politikası m.15, Mesafeli Satış Sözleşmesi), word when the seller
-- cancels an order, and word when money goes back. Each of them can be
-- triggered more than once: the Geliver webhook is retried and replayed, a
-- shop owner saves the tracking form twice, a refund is recorded by the
-- panel and reported again by the provider. A mail that says "your parcel
-- left" must still leave once.
--
-- So every notice first CLAIMS its row here - (order, kind) is the primary
-- key, a second claim is a 23505 and sends nothing - and settles it after
-- the provider answers. A failed delivery releases the claim, so the next
-- trigger may try again; a sent one stays for good.
--
-- `kind` is the event: 'cancelled', 'shipped:<hash>' (the tracking number's
-- SHA-256 prefix, so a corrected number is a new notice while the number
-- itself is not stored twice), 'refund:<refund id>' (each partial refund is
-- its own notice). No address and no message body: the order row already
-- holds who, and the template holds what.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.order_notice_emails (
  "orderId"   text not null,
  kind        text not null,
  status      text not null default 'sending',
  error       text not null default '',
  "createdAt" text not null default '',
  "sentAt"    text not null default '',
  primary key ("orderId", kind)
);

alter table public.order_notice_emails enable row level security;
