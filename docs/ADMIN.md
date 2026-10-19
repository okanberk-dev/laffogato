# Admin paneli kılavuzu

Panelin ekran ekran anlatımı değil; vardiyanın bilmesi gereken davranışlar.
Her bölüm kendi özelliğinin sahibidir.

## Yeni sipariş uyarısı (ses + masaüstü bildirimi)

Uygulamadan masaya ya da gel-al için verilen bir kafe siparişi **ödendiği
anda**, paneli Chrome'da açık tutan her bilgisayar çalar: Yemeksepeti / Getir
tabletlerindeki gibi yüksek, tekrar eden bir zil, ekranda bir kart ve bir
masaüstü bildirimi. Biri siparişe bakana kadar susmaz.

**Ne çalar.** Ödenmiş (`paid`, henüz hazırlanmaya alınmamış) kafe siparişleri:
masa siparişleri önce ve en yüksek sesle, gel-al ve kurye siparişleri de.
Çalmayanlar: mağaza kargoları, panelden elle girilen siparişler (`source:
manual`, onu giren zaten tezgâhta) ve ödeneli **4 saatten** eski siparişler
(dünden unutulan bir sipariş panel her açıldığında çalmasın). Kural tek yerde:
`src/lib/admin/order-alerts-core.ts` (`ringsForOrder`).

**Kimde.** Siparişler bölümü olan roller: Sahip, Yönetici, Personel. Kasa
sayfası (`/admin/kasa`) dahil her panel sayfasında üst çubuktaki zil
düğmesiyle gelir. Kasiyer rolünde yoktur (sipariş listesini göremez). Mobil
uygulamadaki baristalar (yalnız damga) panele girmez, bu uyarı onlar için
değildir.

**Ne yapılır.** Kartta üç düğme var:

- **Hazırlamaya başla**: siparişi `preparing`'e alır (sipariş sayfasındaki
  aynı işlem); zil o sipariş için hemen susar.
- **Siparişi aç**: siparişin sayfasına gider ve onu "görüldü" sayar.
- **Gördüm**: yalnız susturur; sipariş `paid` kalır.

Bir başka bilgisayarda ya da sekmede hazırlamaya alınan, iptal edilen sipariş
bir sonraki sorguda (en geç 10 saniye) her yerde susar. "Gördüm" aynı
tarayıcıdaki bütün sekmelere geçer ve bir gün hatırlanır. "Küçült" kart
yığınını başlığa indirir; yeni bir sipariş gelince yeniden açılır. İmleç
kartların üstündeyken yığın yerinden oynamaz: alınan kart yerinde soluk
kalır, yeni gelen sona eklenir (yanlış siparişe tıklanmasın diye).

**Ses.** Tarayıcı, sayfada bir kez tıklanmadan ses çaldırmaz. Panel her
açıldığında (ya da yenilendiğinde) herhangi bir yere bir kez tıklamak yeter;
o zamana kadar gelen siparişte kartın üstünde "Sesi açmak için dokun" çıkar.
Ondan sonra sekme arka plandayken de çalar. Üst çubuktaki zil düğmesi sesi
açıp kapatır (varsayılan açık; sipariş listesinin "Ses" düğmesiyle aynı
ayardır). Yanındaki ok menüyü açar: "Sesi dene" bir kez çalar.

**Masaüstü bildirimi.** Menüden "Masaüstü bildirimlerini aç" düğmesine bas ve
Chrome'un sorusuna "İzin ver" de. Engellendiyse: adres çubuğunun solundaki
site ayarları simgesi (Chrome 117'den beri kilit değil, iki sürgülü simge),
sonra Bildirimler, sonra İzin ver. Mac'te ayrıca "Sistem Ayarları >
Bildirimler > Google Chrome" açık olmalı. Bildirime tıklamak siparişi açar.

**Bir tarayıcıda bir sekme çalar.** Aynı Chrome'da panel birkaç sekmede açıksa
yalnız biri sorgular ve çalar; yeni açılan bir sekmeye ilk tıklandığında
çalan sekme o olur. Kartlar ve başlıktaki "(2) Yeni sipariş" sayısı hepsinde
görünür. O sekme kapanınca bir diğeri devralır.

**Sınırlar.** Chrome açık ve panel bir sekmede açık olmalı: tarayıcı
kapalıyken bildirim gelmez (bunun için service worker + Web Push gerekir;
ileride istenirse ayrı iş). Chrome'un Bellek Tasarrufu uzun süre dokunulmayan
bir sekmeyi uyutabilir: tezgâh bilgisayarında Ayarlar > Performans'ta site
adresini "Bu siteleri her zaman etkin tut" listesine ekle. Android Chrome
sayfadan masaüstü bildirimi göstermez; orada ses, kart ve sekme başlığı
çalışır.

**Teknik.** `GET /admin/siparisler/uyari` (oturum + Siparişler bölümü her
istekte, `no-store`, müşteri bilgisi yok: yalnız sipariş no, "Masa 4" /
"Gel-al", ürün adları ve adetleri, tutar, ödeme zamanı). Sorgu köşk açıkken
(ve açılıştan bir saat önce, kapanıştan yarım saat sonraya kadar ya da bekleyen
bir sipariş varken) 10 saniyede bir, köşk kapalıyken saatte bir yapılır:
cevaptaki `pollAfterMs`. Veritabanı (Neon, ücretsiz plan) beş dakika boşta
kalınca uyur; gece açık kalan bir panel sekmesi onu sabaha kadar uyanık
tutmasın. Saatlere ve Canlı durum'daki elle açık/kapalı ayarına bakılır.
Sorgu gizli sekmede kısılmasın diye bir Web Worker'dan yapılır; Worker
açılamazsa ana iş parçacığında zamanlayıcı. Tek sekme Web Locks ile seçilir,
liste diğer sekmelere BroadcastChannel ile gider, "Gördüm" localStorage'da
(`laffogato.admin.orderAlerts.acks.v1`). Zil Web Audio ile üretilir (dosya
yok); sesin ayarı `laffogato.admin.orders.sound`.

## Gün sonu sayfası (Raporlar > Gün sonu)

Günü kapatırken beş ekran yerine tek sayfa: `/admin/raporlar/gun-sonu`.
Raporlar başlığındaki **Gün sonu** düğmesiyle açılır. Yalnız Sahip ve
Yönetici görür (Raporlar ile aynı yetki, `reports`): sayfada günün cirosu
var. Salt okunur; hiçbir şeyi değiştirmez.

**Hangi gün.** Köşkün takvim günü, 00:00 ile 24:00 arası (İstanbul saati).
Gece yarısından sonra kapanıyorsan sayfa yeni günü açar: **Önceki gün**
düğmesine bas (`?gun=YYYY-AA-GG`, en çok bir yıl geri; ileri bir gün
açılmaz).

**Ne yazar.**

- **Ciro kutuları** Raporlar'ın o günkü çubuğunun aynısıdır: ödemesi alınmış
  siparişler, ödeme bekleyen ve iptal edilen sayılmaz, iade siparişin
  verildiği günden düşülür. Aynı fonksiyonlar sayar (`headlineFrom`,
  `reportPeriodFilter`), bir test ikisini eşit tutar.
- **Siparişler**: kanala (Web, Uygulama, Panelden) ve duruma göre.
- **İadeler**: o gün yapılan iadeler, sipariş hangi gün verilmiş olursa
  olsun, saatiyle ve nereye gittiğiyle. "Kayıt: para hareket etmez" satırının
  parasını POS değil, kasadaki kişi verdi (nakit ya da havale).
- **Karaoke**: yapılan, sıradaki, onay bekleyen, gelmeyen (saati geçtikten
  sonra iptal edilen köşkte ödemeli rezervasyon, karar D7), iptal edilen ve
  günün ön ödeme neti (Raporlar'daki karaoke kartının o günü).
- **Kasa damgaları**: kasadan ve üye sayfasından verilenler, "−1 düzeltme"
  ile geri alınanlar ayrı.
- **Stokta biten**: o gün stoğu 0'a inen ürün ve varyantlar, saatiyle; gün
  içinde yeniden doldurulduysa "Dolduruldu".

**Yazdır.** Kâğıda yalnız sayfanın gövdesi çıkar (menü, üst çubuk ve
düğmeler çıkmaz; panelin `[data-print-receipt]` kuralı). Müşterinin adı,
e-postası ya da telefonu yoktur: sipariş numarayla, rezervasyon koduyla,
damga sayıyla geçer. Sayfa iç kullanım içindir, **mali belge değildir**:
ÖKC'nin gün sonu (Z) raporunun ya da faturanın yerine geçmez.
