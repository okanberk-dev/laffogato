-- ── orders."legalConsent" ─────────────────────────────────────────────────
-- Distance-selling consent evidence.
--
-- Mesafeli Sözleşmeler Yönetmeliği requires the seller to prove the consumer
-- was presented with — and confirmed — the Ön Bilgilendirme Formu and the
-- Mesafeli Satış Sözleşmesi *before* the order was placed, and to keep that
-- confirmation on a durable medium. Acquiring banks and payment institutions
-- ask for the same record during a virtual-POS (sanal POS) review and when a
-- chargeback is disputed.
--
-- Shape (JSONB, same nested-document convention as `items` / `refunds`):
--   {
--     "acceptedAt": "2026-09-01T10:15:00.000Z",   -- ISO-8601
--     "documents":  ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"],
--     "version":    "1 Eylül 2026",               -- doc revision shown
--     "ip":         "203.0.113.7",                -- proof of origin
--     "userAgent":  "Mozilla/5.0 …"
--   }
--
-- '{}' = legacy order placed before this column existed (no consent captured).
-- `ip` and `userAgent` are personal data: they exist solely as consent evidence,
-- are disclosed in the KVKK aydınlatma metni, and follow the order's own
-- retention period (see the saklama ve imha politikası).
alter table public.orders
  add column if not exists "legalConsent" jsonb not null default '{}'::jsonb;

comment on column public.orders."legalConsent" is
  'Mesafeli satış onay kanıtı: {acceptedAt, documents[], version, ip, userAgent}. Boş nesne = onay kaydı olmayan eski sipariş.';

-- Orders *with* recorded consent, newest first — the shape an audit or a
-- chargeback dispute queries. Partial so legacy rows cost nothing.
create index if not exists orders_legal_consent_idx
  on public.orders (("legalConsent" ->> 'acceptedAt') desc)
  where "legalConsent" ? 'acceptedAt';

-- RLS is already enabled on public.orders by db/schema.sql; a new column
-- inherits it, so only the server-side data layer can read or write this
-- evidence.
