# Canlı veritabanındaki test kayıtlarını bulma ve temizleme

Repodan test verisi kaldırıldı (16 Kas 2026): `tests/` klasörü, sahte ödeme
sağlayıcısı, demo sipariş seed'i, paketteki ürün / menü kalemi / mağaza hero /
uygulama içeriği seed'leri. Bunların hiçbiri canlı veritabanına dokunmaz;
**Neon'daki satırlar olduğu gibi durur.** Bu belge o satırları bulmak ve
isterseniz silmek için.

> Sorgular canlı veritabanında **çalıştırılmadı** (bağlantı yoktu). Yerelde
> `db/schema.sql` ile kurulmuş boş bir Postgres 16'ya sahte satırlar eklenerek
> denendi: bölüm 1'deki SELECT'ler, bölüm 4'teki keşif sorgusu ve silme şablonu
> (faturalı sipariş koruması dahil) beklenen satırları verdi. Yine de önce
> **yalnız SELECT'leri** çalıştırın, listeyi gözle okuyun, silmeyi
> `begin` ... `rollback` içinde deneyin, doğruysa `commit` yazın. Önce Neon'da
> bir dal (branch) açıp orada deneyin.

## 1. Neye bakılır

Ödeme sağlayıcısı yalnız PayNkolay olduğundan canlıda `mock` ödemesi olmaması
gerekir; olan her satır test kaydıdır. Gerisi sizin tanıdığınız test
hesaplarıdır (kendi e-postalarınız, `example.com`, deneme siparişleri).

```sql
-- A. Sahte sağlayıcıyla "ödenmiş" görünen siparişler
select o.id, o."orderNo", o."customerEmail", o.status, o."totalMinor", o."createdAt"
from public.orders o
join public.payment_transactions p on p."orderId" = o.id
where p.provider = 'mock' or p."providerRef" like 'mock\_%'
order by o."createdAt";

-- B. Test e-postalı siparişler (kendi test adreslerinizi ekleyin)
select id, "orderNo", "customerName", "customerEmail", status, "totalMinor", "createdAt"
from public.orders
where "customerEmail" ilike any (array['%@example.com', '%@laffogato.local', 'test%', '%+test@%'])
order by "createdAt";

-- C. Eski demo seed'in iki siparişi ve üç müşterisi (SEED_DEMO_ORDERS=1 ile
--    yazılmış olabilir; yalnız bir geliştirme veritabanında beklenir)
select id, "orderNo", "customerEmail" from public.orders
where "customerEmail" in ('ali@example.com', 'merve@example.com', 'deniz@example.com');

-- D. Test hesapları ve rezervasyonları
select id, email, name, "createdAt" from public.customers
where email ilike any (array['%@example.com', '%@laffogato.local', 'test%', '%+test@%']);

select id, "customerEmail", date, "startHour", status, "totalMinor"
from public.karaoke_reservations
where "customerEmail" ilike any (array['%@example.com', '%@laffogato.local', 'test%', '%+test@%']);
```

## 2. Silmeden önce bilinmesi gerekenler

- **Olay kaydına (`audit_logs`) dokunmayın.** Tablo yalnız eklemeye açıktır
  (`20261019170000_audit_logs_append_only.sql`); silme zaten reddedilir.
- **Sipariş numaraları geri sarılmaz.** `orders."orderNo"` ve `counters`
  sayaçları, silinen satırın numarasını yeniden vermez; boşluk kalır, normaldir.
- **Stok geri gelmez.** Test siparişi stok düşmüşse (`stock_moves`), siparişi
  silmek stoğu geri yazmaz; `/admin/stok-hareketleri`'nden elle düzeltin.
- **Kesilmiş e-Arşiv faturası** olan sipariş silinmez: fatura Paraşüt'te kalır
  ve satırsız kalan kayıt muhasebeyi bozar. Önce
  `select id, status from public.invoices where "sourceId" in ('ord-0001', ...)`
  ile bakın; kesilmişse siparişi silmeyip panelden iptal edin.
- **Gerçek müşteriyi silmeyin.** `customers` silme, onun siparişlerini
  sahipsiz bırakır; hesabı silmek istiyorsanız panelden ya da üyenin kendi
  "Hesabı sil" akışından geçin (PayNkolay'daki kayıtlı kartlar da oradan
  silinir).

## 3. Silme şablonu

Önce sorgulardaki kimlikleri bir listeye çevirin; `where` hiçbir zaman e-posta
kalıbıyla değil **açık kimlik listesiyle** yazılır.

```sql
begin;

-- ödeme kayıtları, sonra siparişler (örnek kimlikler, kendi listenizi yazın)
delete from public.payment_transactions where "orderId" in ('ord-0001', 'ord-0002');
delete from public.order_notice_emails  where "orderId" in ('ord-0001', 'ord-0002');
delete from public.order_push_notices   where "orderId" in ('ord-0001', 'ord-0002');
delete from public.orders               where id        in ('ord-0001', 'ord-0002');

-- silinen satır sayılarını okuyun; beklediğiniz sayı değilse:
rollback;
-- beklediğiniz sayıysa rollback yerine:
-- commit;
```

## 4. Yalnız `@example.com` ile biten kayıtlar

Adres hangi tabloda geçiyor? Aşağıdaki sorgu e-posta tutan her metin kolonunda
`@example.com` ile biten satırları sayar (yalnız okur):

```sql
select table_name, column_name,
  (xpath('/row/c/text()', query_to_xml(
     format('select count(*) as c from public.%I where %I ilike %L',
            table_name, column_name, '%@example.com'),
     false, true, '')))[1]::text::int as adet
from information_schema.columns
where table_schema = 'public' and data_type = 'text' and column_name ilike '%email%'
order by adet desc, table_name;
```

Sayı yalnız `customers`, `orders`, `karaoke_reservations` gibi müşteri
tablolarında çıkıyorsa aşağıdaki şablon hepsini tek işlemde siler. Şablon
`@example.com` ile biten adreslerin kayıtlarını siler. Adresi `example.com`
olan gerçek bir müşteriniz varsa onun kayıtları da gider; bu yüzden önce
bölüm 1'deki D sorgusuyla listeyi okuyun.

Bilerek **silinmeyenler**: `wallet_transactions` (para defteri),
`customer_consents` (rıza kanıtı), `audit_logs`, `invoices`, `iys_*`,
`campaign_email_sends`, `email_suppressions` ve ayar tabloları. Keşif sorgusu
bunlarda sayı veriyorsa her biri ayrı bir karardır. Siparişlerden birinin
faturası kesilmişse şablon hata verip durur (`ERROR: ... faturası var`), hiçbir
şey silinmez.

```sql
begin;

create temp table _ex_orders on commit drop as
  select id from public.orders where "customerEmail" ilike '%@example.com';

-- Faturası kesilmiş sipariş varsa dur (Paraşüt'te kalan fatura sahipsiz kalır).
do $$
begin
  if exists (select 1 from public.invoices
             where "sourceId" in (select id from _ex_orders)) then
    raise exception 'example.com siparişlerinin faturası var; silme, önce muhasebeyle konuş';
  end if;
end $$;

with
  a as (delete from public.payment_transactions where "orderId" in (select id from _ex_orders) returning 1),
  b as (delete from public.order_notice_emails  where "orderId" in (select id from _ex_orders) returning 1),
  c as (delete from public.order_push_notices   where "orderId" in (select id from _ex_orders) returning 1),
  d as (delete from public.orders               where id        in (select id from _ex_orders) returning 1),
  e as (delete from public.karaoke_reservations where "customerEmail" ilike '%@example.com' or "contactEmail" ilike '%@example.com' returning 1),
  f as (delete from public.customer_coupons     where "customerEmail" ilike '%@example.com' returning 1),
  g as (delete from public.customer_devices     where "customerEmail" ilike '%@example.com' returning 1),
  h as (delete from public.loyalty_stamps       where "customerEmail" ilike '%@example.com' returning 1),
  i as (delete from public.customer_milestone_rewards where "customerEmail" ilike '%@example.com' returning 1),
  j as (delete from public.table_calls          where "customerEmail" ilike '%@example.com' returning 1),
  k as (delete from public.counter_tokens       where "customerEmail" ilike '%@example.com' returning 1),
  l as (delete from public.feature_consents     where "customerEmail" ilike '%@example.com' returning 1),
  m as (delete from public.newsletter_subscribers where email ilike '%@example.com' returning 1),
  n as (delete from public.customers            where email ilike '%@example.com' returning 1)
select (select count(*) from a) as odeme,       (select count(*) from b) as siparis_eposta,
       (select count(*) from c) as siparis_push, (select count(*) from d) as siparis,
       (select count(*) from e) as karaoke,      (select count(*) from f) as kupon,
       (select count(*) from g) as cihaz,        (select count(*) from h) as damga,
       (select count(*) from i) as odul,         (select count(*) from j) as masa_cagri,
       (select count(*) from k) as sayac_jeton,  (select count(*) from l) as ozellik_riza,
       (select count(*) from m) as bulten,       (select count(*) from n) as musteri;

rollback;   -- sayılar beklediğiniz gibiyse bu satırı "commit;" yapın
```

Son `select` her tablodan kaç satır sildiğini tek satırda gösterir; `rollback`
satırıyla bırakırsanız hiçbir şey kalıcı olmaz.
