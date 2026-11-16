# Canlı veritabanındaki test kayıtlarını bulma ve temizleme

Repodan test verisi kaldırıldı (16 Kas 2026): `tests/` klasörü, sahte ödeme
sağlayıcısı, demo sipariş seed'i, paketteki ürün / menü kalemi / mağaza hero /
uygulama içeriği seed'leri. Bunların hiçbiri canlı veritabanına dokunmaz;
**Neon'daki satırlar olduğu gibi durur.** Bu belge o satırları bulmak ve
isterseniz silmek için.

> Bu belgedeki hiçbir sorgu bir oturumda çalıştırılmadı (veritabanı bağlantısı
> yoktu). Önce **yalnız SELECT'leri** çalıştırın, listeyi gözle okuyun, silmeyi
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
