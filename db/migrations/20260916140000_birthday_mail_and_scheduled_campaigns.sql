-- Doğum günü maili ve zamanlanmış kampanya — iki eksik tetikleyicinin şeması.
--
-- 1) `campaign_emails."scheduledAt"` — kampanya maili bugüne kadar yalnız
--    operatör panelde "Gönder"e bastığında gidiyordu: Anneler Günü, yılbaşı,
--    köşkün yıldönümü hep o sabah masa başında olmayı gerektiriyordu. Tek
--    kolon yetiyor; ayrı bir "özel günler" tablosu icat edilmiyor — eksik
--    olan kampanya değil, ZAMANLAMA idi.
--
-- 2) `birthday_greeting_audience` — o günün doğum günü sahiplerini tek
--    sorguda veren kural. Kampanya kitlesinde olduğu gibi jsonb bir tercih
--    alanının üstünde süzme gerekiyor; JavaScript sorgu katmanı ne jsonb
--    anahtarına göre süzebiliyor ne de `right(birthday, 5)` hesaplayabiliyor,
--    yoksa her üye satırı Node'dan geçerdi.
--
-- Kupon ile MAİL aynı şey değildir, bu yüzden fonksiyon ikisini ayırır:
--   • kupon bir hesap hakkıdır, ileti değildir → izin süzgeci YOK,
--     aktif + e-postası doğrulanmış her üye alır;
--   • kutlama maili kupon teklifi taşır → 6563 anlamında TİCARİ'dir →
--     `marketing` sütunu true olanlara gider (pazarlama tercihi açık VE
--     `marketingConsentAt` kayıtlı), `List-Unsubscribe` ile.
-- Satır başına tek `marketing` bayrağı, iki ayrı sorgu yerine.
--
-- NOT: burada `insert into public._migrations` YOK. scripts/db-migrate.mjs
-- onu aynı işlemin içinde kendisi yazar.
--
-- Geri alma (ikisi de bağımsız):
--   drop function if exists public.birthday_greeting_audience(jsonb);
--   drop index if exists public.campaign_emails_scheduled_idx;
--   alter table public.campaign_emails drop column if exists "scheduledAt";

-- ── campaign_emails."scheduledAt" ─────────────────────────────────────────
-- Boş dize = zamanlama yok (bugüne kadarki tek davranış). Dolu olduğunda
-- ISO-8601 UTC bir an: saatlik cron, zamanı gelmiş TASLAK kampanyaları
-- `queueCampaignEmail` ile kuyruğa alır ve gerisi kurulu boru hattıdır.
-- Kuyruğa alındıktan sonra alan olduğu gibi kalır — kampanyanın ne zaman
-- gitmesinin istendiği kaydıdır, bir daha okunmaz (durum artık 'draft'
-- değildir, kısmi indeks de onu düşürür).
alter table public.campaign_emails
  add column if not exists "scheduledAt" text not null default '';

-- Cron'un her saat sorduğu tek soru: zamanı gelmiş taslak var mı? Kısmi
-- indeks yalnız onları tutar, gönderilmiş yüzlerce kampanyayı değil.
create index if not exists campaign_emails_scheduled_idx
  on public.campaign_emails ("scheduledAt")
  where status = 'draft' and "scheduledAt" <> '';

-- ── birthday_greeting_audience ────────────────────────────────────────────
-- p_month_days: ["AA-GG", …] — İstanbul takvimine göre bugünün ay-günü.
-- Neredeyse her zaman tek eleman; artık olmayan bir yılın 1 Mart'ında
-- ["03-01", "02-29"] gelir, 29 Şubat doğumlular yılda bir kez kutlansın diye
-- (çağıran taraf karar verir, tarih bilgisi orada).
--
-- `right(birthday, 5)` iki biçimi de karşılar: "YYYY-AA-GG" ve "AA-GG"
-- (`birthdayMonth` de ikisini kabul ediyor). Doğum günü hiç girilmemiş üye
-- (boş dize) hiçbir zaman eşleşmez.
--
-- Misafir siparişi (@laffogato.local) ve kapatılmış hesap (@anon.local)
-- kitlenin dışındadır — campaign_email_audience ile aynı iki satır.
create or replace function public.birthday_greeting_audience(
  p_month_days jsonb
)
returns table (email text, name text, marketing boolean)
language plpgsql
set search_path = ''
as $$
begin
  return query
    select lower(c.email) as email,
           c.name         as name,
           (coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
            and c."marketingConsentAt" <> '') as marketing
      from public.customers c
     where c."isActive"
       and c."emailVerified"
       and length(c.birthday) >= 5
       and right(c.birthday, 5) in (
             select jsonb_array_elements_text(p_month_days)
           )
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local'
     order by lower(c.email);
end;
$$;
