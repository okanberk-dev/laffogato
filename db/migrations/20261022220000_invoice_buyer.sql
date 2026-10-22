-- The buyer of an invoice a person prepared in the order's invoice wizard
-- (22 Oct 2026, docs/EARSIV.md "Siparişten fatura"). Until now every
-- automatic invoice went to a final consumer (TCKN placeholder
-- 11111111111). The wizard lets a person name a company buyer instead:
-- its legal title, 10-digit VKN and tax office (company data, not a
-- natural person's: a sole proprietor's TCKN is not taken here), and an
-- invoice e-mail. A company registered at GİB as an e-Fatura user gets an
-- e-Fatura, any other buyer an e-Arşiv (src/lib/invoice/run.ts).
--
--   "buyerKind"       consumer | company
--   "buyerTitle"      the company's legal title ('' for a consumer)
--   "buyerTaxNumber"  its VKN ('' for a consumer)
--   "buyerTaxOffice"  its tax office ('' for a consumer)
--   "buyerEmail"      where the PDF goes; '' = the order's e-mail
--   "requestedBy"     who asked for this invoice in the wizard ('' for the
--                     automation). Such a row is planned without
--                     EARSIV_START_AT and without the café's waiting time.
--
-- Re-runnable. Rollback:
--   alter table public.invoices drop constraint if exists invoices_buyer_kind;
--   alter table public.invoices drop column if exists "requestedBy",
--     drop column if exists "buyerEmail", drop column if exists "buyerTaxOffice",
--     drop column if exists "buyerTaxNumber", drop column if exists "buyerTitle",
--     drop column if exists "buyerKind";

alter table public.invoices
  add column if not exists "buyerKind"      text not null default 'consumer',
  add column if not exists "buyerTitle"     text not null default '',
  add column if not exists "buyerTaxNumber" text not null default '',
  add column if not exists "buyerTaxOffice" text not null default '',
  add column if not exists "buyerEmail"     text not null default '',
  add column if not exists "requestedBy"    text not null default '';

do $$
begin
  alter table public.invoices
    add constraint invoices_buyer_kind
    check ("buyerKind" in ('consumer', 'company'));
exception
  when duplicate_object then null;
end
$$;
