-- _migrations tablosunu istemci rollerinden kapat.
--
-- Şemadaki 27 tablonun hepsi RLS açar; _migrations TEK istisnaydı, çünkü onu
-- uygulama şeması değil migration çalıştırıcısı yaratır ve kimse dönüp ona RLS
-- vermedi. Neon'da bunun önemi yok — istemci rolleri diye bir şey yok. Supabase'de
-- ise public şemadaki her tablo PostgREST üzerinden anon anahtarına görünür ve
-- varsayılan yetkiler anon/authenticated'a verilmiş gelir: yani geçişten sonra
-- uygulanmış migration listesi (sürüm parmak izi) herkese okunur, kötüsü
-- YAZILIR olurdu — _migrations'a eklenen sahte bir satır, o migration'ın bir
-- daha hiç uygulanmamasını sağlar.
--
-- İki katman: RLS (policy'siz = istemci rollerine kapalı) + yetki iptali.
-- Çalıştırıcıyı iki şey birden korur: tabloyu yaratan rol SAHİBİDİR (sahip,
-- kendi tablosunda RLS'ten muaftır) ve Supabase'de postgres/service_role
-- ayrıca bypassrls taşır (pg_roles'tan ölçüldü). Yani bootstrap/migrate hiçbir
-- poolda bu tabloyu "sessiz boş" görmez. Revoke, rol
-- mevcutsa yapılır — Neon'da anon/authenticated YOKTUR ve korumasız bir revoke
-- bugünkü üretimde bu migration'ı patlatırdı.
--
-- NOT: public._migrations'a insert satırı yok; scripts/db-migrate.mjs onu
-- kendisi, aynı işlem içinde ekler.

alter table public._migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public._migrations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public._migrations from authenticated;
  end if;
end $$;
