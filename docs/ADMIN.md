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

**Masadan garson çağrısı (6 Kas 2026).** Uygulamadaki "Garson çağır"
(garson, su ya da peçete; `docs/API-MOBILE.md` §22.1) aynı zille çalar,
yığında en üstte: "Masa 4 · Su istiyor". Kartta tek düğme var, **Gördüm**:
çağrıyı yanıtlar (yalnız bu tarayıcıyı susturmaz), çağrı köşkün bar
ekranından ve öbür panellerden de düşer, üyenin uygulaması "gördük" der.
Yanıtlanmayan çağrı 15 dakika sonra kendiliğinden susar. Açık çağrılar
Siparişler sayfasının üstünde "Masa çağrıları" listesinde de durur, satır
satır "Gördüm" ile. Anahtar: Mobil › Uygulama ayarları › Sipariş ›
"Masadan garson çağırma açık" (masaya sipariş de açık olmalı). Kural:
`src/lib/admin/table-calls-core.ts`, eylem
`src/app/admin/siparisler/call-actions.ts`.

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

**Değişiklik yokken veritabanı yok (19 Eki 2026).** Sıklık aynı kaldı, ama
10 saniyelik soru artık çoğu zaman Neon'a gitmiyor. Her tam cevap bir imleç
(`cursor`) taşır; Worker onu bir sonraki soruda `?c=` olarak geri yollar.
`orders` tablosuna her yazma (ödendi, durum değişikliği, iptal, iade, yeni
sipariş) Data Cache'teki değişiklik işaretini yeniler
(`src/lib/admin/change-marker.ts`, `src/lib/cache/tags.ts`). İşaret
imleçtekiyle aynıysa cevap yalnız `{ unchanged: true }` olur: sipariş yok,
hesap okuması yok, veritabanı yok; yalnız çerezin imzası ve rolü (Siparişler)
bakılır. İşaret değiştiyse, okunamadıysa, imleç yoksa ya da bozuksa,
çerezdeki rol Siparişler'e erişemiyorsa eski tam cevap gelir (hesap yeniden
okunur, 401/403/503 aynı). Köşk açıkken en az saatte bir cevap yine tamdır.
İşaret hesaptan ve siparişlerden önce okunur, arada ödenen sipariş onu
mutlaka değiştirir; ödenen bir masa siparişi bir sonraki 10 saniyelik soruda
çalar.

Yetkisi alınan oturum (kural 30): işaret `admin_users`'a her yazmada da
yenilenir (`live:access` etiketi: kullanıcı pasifleşti, rolü değişti,
parolası sıfırlandı, silindi), yani "değişmedi" cevabı yalnız bu oturumun
hesabını yeniden okuyan son tam cevaptan beri hiçbir hesap değişmediyse
verilir. İmleç onu alan oturuma bağlıdır (oturum çerezinin SHA-256 özetinin
ilk 12 hanesi, `src/lib/admin/poll-binding.ts`; adres ya da kimlik
taşımaz): başka bir çerez, imzası geçerli olsa da, bu imleçle "değişmedi"
alamaz, hesabı okunur. Yetkisi alınan oturum bir sonraki soruda 401 ya da
403 alır; ilk siparişin ne zaman yazıldığını ve köşkün açık olup olmadığını
bu yoldan öğrenemez. Kalan tek fark: Neon konsolunda elle yapılan bir hesap
değişikliği etiket düşürmez (`docs/DATABASE.md` "Etiket düşürmeyen
yazmalar"); hesabı panelden değiştir ya da bütün etiketleri düşür.
"Hazırlamaya başla" ve başka sekmenin istediği soru imleçsiz gider (tam
cevap); yeni lider sekme de imleçsiz başlar. Değişiklik yokken liste olduğu
gibi kalır, 4 saatlik pencereden çıkan kart sunucunun saatine göre düşer.
Her yazma işareti iki kez düşürür: hemen, ve cevap çıktıktan sonra
`after()` ile ayrı bir istekle; siparişi ödendi yapıp sonra hata fırlatan
bir route handler'da Next ilkini hiç göndermez, ikincisi yine gider
(`docs/DATABASE.md` madde 1). İkisi de kaybolursa (önbellek hatası) zil en
geç bir sonraki tam cevapta (açıkken en geç bir saat) çalar; personel
e-postası bundan bağımsız gider. Önbellek çalışmazsa her soru tam cevap olur: eski
maliyet, kaçan sipariş yok. Deploy'dan önce açılmış sekmeler yenilenene kadar
eski Worker'la (imleçsiz, her 10 sn tam cevap) çalışır: tezgâh
bilgisayarında paneli bir kez yenile.

**Rozetler ve sipariş listesinin sayacı da aynı yolla (19 Eki 2026).** Kenar
çubuğundaki açık sipariş ve bugünkü karaoke rozetleri (60 sn) ve sipariş
listesinin "yeni sipariş" sayacı (30 sn) aynı sıklıkta sorar, ama her cevap
bir imleç taşır (`src/lib/admin/panel-signal.ts`,
`src/lib/admin/panel-signal-core.ts`). `orders` (rozet ve liste) ya da
`karaoke_reservations` (karaoke rozeti) yazılmadıysa ve aynı şey sayılıyorsa
(karaokede Tuzla'nın bugünü, gece yarısı yeni gün; listede son sipariş no ve
sekme) cevap `{ unchanged: true }`: sayı yok, hesap okuması yok, veritabanı
yok, rozet sayısını korur. Sayı taşıyan her cevap hesabı yeniden okur. İmleç
zilinki gibi oturuma bağlıdır ve işaret hesap yazmalarında da yenilenir:
yetkisi alınan oturum bir sonraki soruda rozetsiz kalır. Bir
işlem (`admin:changed`) ve sayfa değişimi imleci düşürür, sonraki okuma
tamdır; liste yenilenince (`latestOrderNo`) yeniden imleçsiz başlar. Bir
yazmanın düşürme isteği kaybolursa rozet bir sonraki işleme ya da sayfa
değişimine kadar eski sayıyı gösterir; listenin kendisi her zaman sunucuda
taze çizilir.

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
- **Stokta biten**: o gün stoğu 0'a inen ürünler, saatiyle; gün içinde
  yeniden doldurulduysa "Dolduruldu". Stok defteri ürünün toplam stoğunu
  yazar: varyantlı ürün, son varyantı da bitince o satışın adıyla
  ("Ürün · Varyant") görünür; başka varyantta stok varken biten tek varyant
  burada görünmez, ürünün sayfasında görünür.

**Yazdır.** Kâğıda yalnız sayfanın gövdesi çıkar (menü, üst çubuk ve
düğmeler çıkmaz; panelin `[data-print-receipt]` kuralı). Müşterinin adı,
e-postası ya da telefonu yoktur: sipariş numarayla, rezervasyon koduyla,
damga sayıyla geçer. Sayfa iç kullanım içindir, **mali belge değildir**:
ÖKC'nin gün sonu (Z) raporunun ya da faturanın yerine geçmez.

## Listelerde arama

Siparişler, Müşteriler, Ürünler, Kafe menüsü, Karaoke, Bülten (ve bir
kampanyanın gönderim defteri), Promosyon, Masalar ve Olay kaydındaki arama
kutusuna yazılan **adrese yazılmaz**. Kutu bir e-posta ya da telefon alır;
adres çubuğundaki metin tarayıcı geçmişine, vekil sunuculara ve Vercel'in
istek kaydına düşerdi. Metin o listenin kendi tarayıcı çerezinde **10
dakika** durur (`adm_q_<liste>`, yalnız o listenin ve altındaki sayfaların
yolunda); sekme, açılır listeler, tarih, sıralama ve sayfa yine adreste.

- Bir siparişe girip listeye dönünce arama yerindedir; 10 dakika sonra ya da
  **Sıfırla**, çipin × düğmesi, boş listenin "Filtreleri temizle"si ve
  **Çıkış** ile gider.
- Bir listenin bağlantısını paylaşırsan arama gitmez: karşı taraf süzgeçleri
  görür, aramayı kendi yazar.
- Çerez tarayıcı başınadır: aynı listede iki sekmede ayrı arama yaparsan son
  yazılan geçer. Hangisinin uygulandığını kutunun altındaki çip söyler.
- Müşteri satırındaki "Siparişleri", üye sayfasındaki "Tümünü gör" ve Olay
  kaydındaki "Geçmişi" aynı yoldan gider: adres gönderinin içindedir.
- Eski bir yer imi `?q=` ile açılırsa metin çereze taşınır ve sayfa onsuz
  yeniden açılır. Kural tek yerde: `src/lib/admin/list-search-core.ts`.

## Palet (arama)

Üst çubuktaki arama alanı ("Sipariş, müşteri ya da sayfa ara") paleti
açar: geniş ekranda sonuçlar alanın kendisinden aşağı açılır, telefonda
büyüteç düğmesi ekranın üstünde açar (22 Eki 2026, operatör: aramanın
"Ctrl K" kutusundan farklı ve güzel olması). Kenar çubuğunda arama kutusu
yok; tuş da ekranda yazmaz, ama klavyeden Mac'te ⌘K, Windows'ta Ctrl K
çalışmaya devam eder (bir alanın içindeyken de). Kasiyerde palet yok.

- **Son açılanlar**: bu sekmede açtığın son 8 kayıt sayfası (sipariş,
  karaoke, ürün, menü kalemi, kategori, slayt, promosyon, kampanya, masa,
  duyuru, gönderi). Müşteri, panel kullanıcısı, abone ve olay kaydı sayfası
  tutulmaz; başlığında e-posta ya da telefon olan kayıt da. Liste hesabına
  bağlıdır, sekme kapanınca ve **Çıkış**'ta silinir.
- **Sayfalar** (21 Kas 2026'ya kadar "Git"): menüdeki her sayfa ve sekme, eski adlarıyla da ("Mağaza Hero",
  "kupon", "damga", "qr"). Harfleri işaretsiz yazmak yeter: "siparis"
  Siparişler'i bulur.
- **Oluştur**: rolünün açabildiği "Yeni" sayfaları.
- **Kayıtlar** (başlığı kayıt türünün adı: "Siparişler", "Müşteriler" …):
  2 harften sonra sipariş, müşteri, ürün, menü ve karaoke kayıtları,
  rolüne göre ve bölüm başına 5. Metin isteğin gövdesinde gider,
  adrese ve kayda düşmez. 5'ten fazlası varsa "Listede ara": liste aramasız
  açılır (metin adrese yazılmaz), metni listenin kutusuna sen yazarsın.
- **Tercihler** (21 Kas 2026'ya kadar "Komutlar"): Güvenlik / 2FA, Klavye kısayolları, Sıkı görünüm (açar ya da
  kapatır, aşağıda "Dar menü ve Sıkı görünüm") ve sipariş sesini aç / kapat
  (bu tarayıcıda).
- Palet hiçbir şeyi değiştirmez: sipariş adımı, çıkış ya da ayar yoktur.
- Esc ilk basışta kutuyu boşaltır, ikinci basışta paleti kapatır; telefonda
  × düğmesi kapatır.
- Oturum kapandıysa "Oturumun kapandı." ve yeniden giriş bağlantısı çıkar;
  veritabanı yanıt vermezse "Arama şu an çalışmıyor." (sonuç yok demek
  değildir).

## Telefonda alt çubuk

Telefon ve tablette (geniş ekranda değil, orada kenar çubuğu var) ekranın
altında en çok beş düğme durur: menüyü açmadan tek dokunuşla vardiyanın
sayfaları. Rozetler menüdekilerle aynı sayılardır.

- **Sahip ve yönetici**: Genel bakış, Siparişler, Karaoke, Kasa ve
  **Tümü** (bütün menüyü açar). Açık sayfa çubukta değilse Tümü yanar.
- **Personel**: Siparişler, Karaoke, Kasa, Canlı durum ve **Tümü** (Stok ve
  Genel bakış menüde). Canlı durum 20 Ekim 2026'dan beri Personel'in de
  (aşağıda "Köşk durumu"); altı sayfa beşe sığmadığı için Tümü geldi.
- **Kasiyer**: çubuk yok (tek sayfası var).
- Siparişler düğmesi rozetin saydığı "Açık" sekmesini açar.
- Toplu işlem çubuğu açıkken, bir onay penceresi ya da menü açıkken ve
  telefonda bir yazı alanına dokununca (klavye açıkken) çubuk çekilir.
- Bildirimler, toplu işlem çubuğu, yeni sipariş kartları ve kaydet
  çubukları çubuğun üstünde durur; sayfanın sonu çubuğun altında kalmaz.

## Canlı durum: açık/kapalı saatlerden, Personel'in masaları

Uygulamanın ana sayfasındaki "Şu an açık", boş masa, Wi-Fi, gürültü, priz ve
not Canlı durum'dan gelir (`GET /api/mobile/v1/live-status`).

- **Açık/kapalı kendiliğinden** (21 Kas 2026, operatör: _"köşk açık yoğun
  vs. durumunu da kaldır, belli aralık olan o saatlerde otomatik çeksin"_).
  Elle Açık / Kapalı / Yoğun seçimi ve üst çubuktaki köşk çipi kalktı.
  Köşk Ayarlar → Saatler'deki saatlerde açık, dışında kapalıdır; gece
  yarısını geçen kapanış (ör. 02:00) önceki günün devamıdır. Canlı durum
  bunu yalnız gösterir: şu anki durum, bir sonraki açılış ya da kapanış
  ("Kapanış 23:00", "Açılış yarın 09:00"), haftanın saatleri (bugün koyu)
  ve sahip için "Saatleri düzenle" (`/admin/ayarlar?sekme=hours`). Her
  kayıt `manualOverride: "auto"` yazar; migration
  `20261121120000_venue_open_by_hours.sql` kayıtlı satırı bir kez `auto`'ya
  döndürdü. Kafe siparişi (`cafe_closed`) ve zilin yoğunluk penceresi aynı
  saatlere bakar. `/api/mobile/v1` değişmedi.
- **Kim.** Canlı durum ayrı bir bölüm (`venue`, karar D3, 20 Ekim 2026):
  Sahip, Yönetici ve **Personel**. Kasiyerde yok. Uygulamanın slaytları,
  duyuruları, gönderileri ve ayarları eskisi gibi yalnız Sahip ve
  Yönetici'de (`mobileApp`).
- **Masa sayısı yok** (22 Kas 2026, operatör: _"boş masa sayısını da
  kaldır"_). Canlı durum boş ve toplam masa sormaz; uygulamaya
  `freeTables: null` gider (sözleşme §6), uygulama boş masa satırı
  göstermez. Gönderilen bir `freeTables` / `totalTables` yok sayılır.
- **Ortam:** Wi-Fi, gürültü, priz ve not (en fazla 200 karakter), tek bir
  `UPDATE` ile (`patchVenueStatus`). Her kayıt olay kaydına bir satır yazar
  (`venue_status`, kim, ne).
- Uygulama yeni durumu en geç 30 saniyede görür (uç `s-maxage=30`).

## Klavye kısayolları

⌘K / Ctrl K her sayfada paleti açar. Sahip, yönetici ve personel için ayrıca
tek tuşlar vardır; `?` listelerini açar (paletin Tercihler'indeki "Klavye
kısayolları" da).

| Tuş                                               | Ne yapar                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/`                                               | Listenin arama kutusuna geçer; sayfada kutu yoksa paleti açar                    |
| `n`                                               | Sayfanın "Yeni" bağlantısını açar; yoksa paleti yalnız Oluştur'la açar           |
| `?`                                               | Kısayol listesi                                                                  |
| `g` sonra `b` / `s` / `k` / `d` / `m` / `u` / `r` | Genel bakış, Siparişler, Karaoke, Kasa ("damga"), Kafe menüsü, Ürünler, Raporlar |

- `g`'den sonra ikinci harf 1,5 saniye içinde gelmeli. İkinci harfte ü, ş,
  ç, ö, ğ işaretsiz harf gibi sayılır (`g ü` = `g u`). `i` ve `ı`'ya bir şey
  bağlı değil.
- Rolün açamadığı sayfanın harfi hiçbir şey yapmaz (personelde `g m`, `g u`,
  `g r`).
- Tek tuşlar çalışmaz: bir alana yazarken, IME ile yazarken, bir pencere
  (palet, onay, menü çekmecesi) açıkken, ⌘, Ctrl ya da Alt basılıyken (AltGr
  dahil), **Kasa'da** (okutulan ve yazılan kodlar oraya gelir) ve
  **kasiyerde** hiç.
- `n` yalnız bir bağlantıyı açar: sayfanın ana düğmesi bir gönderme ya da
  yazdırma düğmesiyse ona basmaz, paleti Oluştur'la açar.
- 20 Ekim 2026'da hiçbir sayfa "Yeni" bağlantısını başlığın ana bağlantısı
  (`PageHeader` `primary`, `data-admin-new`) olarak çizmiyor ("+ Yeni
  sipariş" `action` içinde): şimdilik `n` her sayfada paleti Oluştur'la
  açar. Bir sayfa `primary`'ye geçince `n` o bağlantıyı doğrudan açar.
- Kaydedilmemiş değişikliği olan bir formda (ürün sihirbazı, Ayarlar,
  Uygulama ayarları, yasal belge, kampanya e-postası) tuşlar sayfadan çıkmaz:
  `g` ve harf hiçbir şey yapmaz, `n` bağlantıyı değil paleti açar.
  "+ Varyant ekle"den sonra odak sayfaya düşer; oraya yazılan "Guatemala"
  `g u` olup sihirbazı kapatmasın diye (tarayıcı sayfa içi geçişte sormaz).
  Tuşlar sormaz, çünkü yazarken çıkan bir pencere Enter ya da boşlukla
  yanlışlıkla onaylanabilir; sayfadan çıkmak isteyen bağlantıya ya da palete
  basar ve orada sorulur.
- **Kapatmak için**: menünün altındaki Hesap bölümünde "Tek tuş kısayolları"
  (bu tarayıcıda hatırlanır; kısayol listesinde de aynı düğme var). Kapalıyken
  yalnız ⌘K / Ctrl K kalır.
- Kurallar tek yerde: `src/lib/admin/shortcut-core.ts`; dinleyici
  `src/components/admin/shortcuts.tsx` (yalnız tek tuşlu rollere, ayrı bir
  parça olarak yüklenir).

## Kaydedilmemiş değişiklik uyarısı

Uzun bir formda yazdığın şey kaydedilmeden panelin başka bir sayfasına geçmek
istersen panel önce sorar: **"Kaydedilmemiş değişiklikler var. Sayfadan
çıkılsın mı?"** Tamam dersen sayfa değişir ve yazdığın gider; Vazgeç dersen
yerinde kalırsın.

Bu formlarda var: **Ayarlar** (sekmelerden biri kaydedilmemişse; sekmedeki
nokta zaten bunu gösterir), **Uygulama ayarları** (dokuz bölümün hepsi),
**yasal belge düzenleyici**, **kampanya e-postası** (yeni ve taslak) ve 21
Ekim 2026'dan beri **kafe menüsü kalemi**, **anasayfa ve mağaza slaytı**,
**uygulama slaytı, duyurusu ve gönderisi** ile **promosyon kodu** (yeni ve
düzenleme). **Ürün sihirbazı** (yeni ve düzenleme) kendi uyarısını kullanır
ve 24 Ekim 2026'dan beri aynı yerlerde sorar: yenilemede ve sekme
kapanışında olduğu gibi menü bağlantısında, "Vazgeç"te ve ⌘K'da da.

- **Sorduğu yerler**: başka bir sayfaya giden bağlantı (menü, üst çubuk,
  "Vazgeç", bildirimdeki bağlantı) ve ⌘K paletinde bir sayfa seçmek (Vazgeç
  dersen palet açık kalır). Sayfayı yenilemek, sekmeyi kapatmak ya da adres
  çubuğuna başka bir adres yazmak da tarayıcının kendi sorusunu çıkarır.
- **Sormadığı yerler**: yazdığını kaydettikten sonra. Kayıt reddedilirse
  (kırmızı hata) form kaydedilmemiş kalır ve sorar. Forma hiç dokunmadıysan ya
  da yazdığını eski hâline getirdiysen de sormaz. Ctrl, ⌘, Shift ya da Alt'la
  (yeni sekme ya da pencere) açılan bağlantılar, indirmeler, aynı sayfada kalan
  bağlantılar (Ayarlar'da başka bir sekmeye geçmek, sayfa içi `#` atlaması,
  "İçeriğe geç") ve "Ara" düğmesi de sormaz.
- **Sorulamayan yerler**: tarayıcının Geri ve İleri düğmeleri ile Çıkış.
  Tarayıcı ilkine kanca vermiyor, Çıkış bir bağlantı değil form gönderimi. Bu
  yüzden uzun bir formdan sonra kaydetmeden Geri'ye ya da Çıkış'a basma.
- Kaydedince sayfada kalan formlar (Ayarlar, Uygulama ayarları, kampanya
  taslağı) kaydedilen hâli esas alır; yanıt gelene kadar yazdıkların
  kaydedilmemiş sayılır. Kaydedince listeye dönen formlar (yasal belge, yeni
  kampanya) sayfayı bıraktığı için sormaz.
- Kodda: kurallar `src/components/admin/ui/unsaved-guard.ts`'te. Kaydedince
  sayfadan çıkan uzun bir form `GuardedActionForm`'u
  (`src/components/admin/guarded-action-form.tsx`) `ActionForm` yerine
  kullanır; `ActionForm` korumayı kendisi yüklemez (her panel sayfasında
  var). Başka bir form `useUnsavedGuard(formRef, { saved })` ile korunur: `formRef` `<form>`'un
  kendisi (`ActionForm`'da `formRef` prop'u), `saved` her başarılı kayıtta
  yeni gelen cevap (`savedAnswer(state)`); kayıttan sonra yönlenen form
  `saved` vermez. Koruma yalnız operatörün değiştirdiği alanları karşılaştırır:
  alan, adıyla (`name`) bir `input` ya da `change` olayından tanınır. Sayfanın
  kendisinin değiştirdiği alan sayılmaz; operatör adına bir alanı kodla
  değiştiren bir denetim olayı o alanda göndermeli, adı olmayan denetim hiç
  sayılmaz. Kendi "kaydedilmemiş" bilgisini tutan bir sayfa
  `useUnsavedFlag(dirty)` çağırır. Ürün sihirbazının kendi kancası
  (`src/components/admin/unsaved-guard.ts`) bağlantı ve palet sorusunu
  `hold: acquireLeaveGuard` ile alır; o dosya yeni dosyayı içe aktarmaz.

## Listelerde ekleme, sıralama, yayından kaldırma ve silme (21 Eki 2026)

Kayıt eklemek ve çıkarmak için forma girmek gerekmeyen yerler:

- **Genel bakış'ta Hızlı ekle**: rolünün açabildiği her "Yeni …" sayfası
  (sipariş, menü ürünü, ürün, kategori, promosyon, kampanya, slaytlar,
  duyuru, gönderi, masa) karoların hemen altında tek dokunuşla. Liste
  paletin Oluştur listesiyle aynıdır (`CREATE_ENTRIES`,
  `src/lib/admin/palette-core.ts`); Personel'de yalnız Yeni sipariş,
  kasiyerde hiçbiri.
- **Yayına al / Yayından kaldır**: mağaza slaytları, uygulama slaytları,
  duyurular ve gönderilerde satırın ⋯ menüsünde (anasayfa slaytlarında
  zaten vardı). Tek tık, geri alınabilir; yalnız `isActive` yazılır, başka
  sekmede açık bir formun alanları ezilmez. Gönderiyi listeden yayına almak
  üyelere e-posta **göndermez**; e-posta yalnız gönderinin formundaki
  kutuyla gider. Uygulama içeriği telefonlara birkaç dakika içinde ulaşır.
- **↑ / ↓ (sıra)**: aynı listelerde ve kafe menüsünde (kategori içinde)
  Sıra sütununda, telefonda kartın üstünde. Tek bir küçük adımlayıcıdır
  (`MoveButtons`): iki ok ince bir çerçevede; ilk satırın ↑'ı ve son
  satırın ↓'ı soluk çizilir ve basılmaz, böylece her satırın adımlayıcısı
  aynı biçimde durur; tek satırlık listede hiç yoktur. Satır komşusuyla yer
  değiştirir, liste 10, 20, 30… diye yeniden numaralanır (elle girilmiş eşit
  sıralar bir sonraki taşımayı boşa çıkarmasın; 99 satırı aşan liste birer
  birer numaralanır). Liste süzülmüşken (uygulamada durum sekmesi, menüde
  Satışta / Tükendi sekmesi ya da arama) oklar görünmez: süzülmüş listede
  komşu görünmeyebilir. Uygulama listeleri yerine sıra sayısını yazar;
  menüde sayı yalnız geniş ekranda (xl) görünür. Klavyeyle basınca odak
  taşınan satırın oklarında kalır. Kural `src/lib/admin/store.ts`
  (`moveRowInList`, `moveMenuItem`).
- **Kayıt sayfasında Sil**: ürün, menü kalemi, promosyon, kategori
  (içinde ürün varken kapalı, nedeniyle), mağaza ve anasayfa slaytı ile
  uygulama slaytı, duyurusu ve gönderisi sayfasının başlığındaki ⋯
  menüsünde. Onay sorar; silince listeye döner ve bildirimi orada gösterir.
- **Kopyala**: kafe menüsü kaleminin ⋯ menüsünde ve sayfasında. Yeni kalem
  formu o kalemin bütün alanlarıyla açılır, adı "(kopya)" ile biter ve
  "Menüde göster" işaretsizdir: işaretlemeden kaydedilen kopya menüde
  görünmez. Asıl kaleme dokunulmaz.
- **Kaydet ve yenisini ekle**: yeni menü kalemi ve yeni masa formunda. Kayıt
  sonrası boş form yeniden açılır (menüde aynı kategoride); bir odanın
  masalarını ya da bir kategorinin kalemlerini art arda girmek için.

### Satır kontrolleri (21 Eki 2026)

Operatör: _"ok çubuklarını daha ufak minimalist yap ve panel tasarımını da
aynı şekilde geliştir ve responsive uyumlu da yapmayı unutma"_. Bir listenin
her satırında tekrar eden küçük kontroller (`ROW_CONTROL`,
`src/components/admin/ui/styles.ts`) sakin çizilir: ↑ / ↓ adımlayıcısı,
tek başına ⋯, ikon bağlantısı ve satırın metin eylemi ("Tükendi" /
"Satışa aç", siparişin sıradaki adımı, yasal metnin "Düzenle"si). Soluk
mürekkep, en çok ince bir çizgi; çerçeve ve zemin imleç üstündeyken gelir,
⋯ menüsü açıkken zemini kalır.

- **Boyut**: dokunmatik ekranda hepsi 44 px kalır; fareyle adım 28 px, geri
  kalanı 32 px (WCAG 2.2'nin 24 px alt sınırının üstünde). "Sıkı görünüm"ün
  36 px'inden zaten küçük oldukları için onun sınıflarını almazlar.
- **Çerçeveli ⋯**: başlıkta düğmelerin yanında duran ⋯ (PageHeader, ürün,
  menü kalemi, promosyon ve sipariş sayfası) `framed` ile düğme boyunda ve
  çerçeveli kalır; etiketli ⋯ ("Toplu işlem") da öyle.
- **Duyarlı**: kafe menüsünde ve gönderilerde Sıra sütunu md'den itibaren
  tabloda, telefonda kartta görünür (eskiden yalnız xl'de). 768 ve 1024
  px'te, fare ve dokunmatikte tablo yana kaymaz; menüde ad sütunu xl'e
  kadar biraz daha dar başlar.
- **Etiketler**: paneldeki son 10 px aralıklı büyük harf başlıklar (müşteri
  kartları, manuel sipariş, ürün sihirbazı, görsel yükleme, kayıt
  sayfalarının üst satırı) kitin cümle düzenine geçti: kart başlığı
  `CARD_TITLE`, kart içi başlık `CARD_SUBTITLE`, alan etiketi `EYEBROW` /
  `LABEL`. Büyük harf yalnız kenar çubuğunun grup etiketlerinde, giriş
  ekranının logosunun altında ve basılı fişte kalır. Ürün sihirbazının
  adım başlıkları da eğik serif yerine kartın başlık yazısıyla.

`tests/admin-row-controls.test.ts` ve `tests/admin-compact-density.test.ts`
tutar.

### Görünüm: Innex (22 Eki 2026)

Operatör: _"İnnexe geç"_. Panel Filllo'nun Innex serisinin tasarım
sistemini izler (`docs/ADMIN-INNEX.md`, değerler `docs/BRAND.md` "Admin
paneli görünümü"). 21 Eki'deki yumuşatılmış AkmanOS teması bırakıldı:

- Gri zemin üstünde iki beyaz kart: kenar çubuğu ve sayfa. Sayfa kartının
  üstünde üst çubuk (yol ya da ögenin sekmeleri, arama alanı, köşk, zil), altında
  sayfa başlığı şeridi (başlık 18 px, gri açıklama, sağda düğmeler, kart
  boyu çizgi). İçerik kartın sol kenarından başlar.
- Kenar çubuğu sakin: ikonlar 16 px çizgi, grup başlıkları küçük büyük
  harf, açık sayfanın satırı gri; grup rengi, renkli nokta ve renkli sayaç
  yok. Sayaçlar gri hap. Telefonun alt çubuğunda etkin hap da gri.
- Menünün beş grup rengi (`src/components/admin/ui/hues.ts`: **Bugün**
  mavi, **Katalog** bal, **Pazarlama** gül, **İçerik** mor, **Yönetim**
  yeşil) yalnız ikon kutularında kalır: Genel bakış ve rapor kartlarında
  28 px kutu, "Yeni" menüsünün ikonları. Ciro grafiği Innex'in koyu mavi
  çizgisi ve lavanta dolgusu.
- Kartlar beyaz, 1 px çizgi, gölgesiz; tablo başlığı soluk kuyuda 13 px
  gri; durum sekmeleri kutu çipleri (etkin olan koyu kenarlı); rozet
  köşesi 6 px; düğmeler fareyle 36 px, "Sıkı görünüm"de 32 px,
  dokunmatikte 44 px.
- Her renk kendi zemininde ve beyazda AA'yı geçer, sayfanın mürekkepleri de
  renkli zeminlerde (`tests/admin-ui-kit.test.ts`); bir bölümün rengi
  menüdeki grubunun rengidir (aynı test, `layout.tsx` NAV_GROUPS'tan
  okur).

### Innex düzenleri (23 Eki 2026)

Operatör: _"İnnex + diğer yerleri önerdiğin en profesyonel şekilde yap"_.
`docs/ADMIN-INNEX.md` §3'teki fikirlerin uygulananları; kural her yerde
aynı: kararı veren rakam açıkta, ayrıntı bir tık ötede.

- **KPI şeridi** (`dashboard/kpi-strip.tsx`): rakamlar tek kartta, aralarında
  1 px çizgi (kartın grisi 1 px boşluktan görünür, hücreler nasıl dizilirse
  dizilsin çizgi doğru kalır). Her hücrede ikon kutusu ve etiket, rakam,
  altında değişim hapı ve **referans**: hiçbir rakam tek başına durmaz.
  Beş hücre md'den 3 + 2, xl'den tek satır; telefonda ikişer, tek kalan
  tam satır.
- **Genel bakış**: şerit sahip ve yöneticiye beş rakam verir. Bugün net ciro
  ve bugünkü sipariş, **geçen haftanın aynı günü bu saate kadar** ile
  karşılaştırılır (`dashboardRevenue`: 14 günün tek okuması; bir kafenin
  cumartesisi cumasına, yarım günü tam güne benzemez); bugünkü siparişin
  bağlantısı saydığını açar (Siparişler → Ödeme: **Raporda sayılan**,
  iptal ve ödeme bekleyen hariç). Açık sipariş kafe / mağaza diye ayrılır
  ve barda en uzun bekleyen kafe siparişinin süresini söyler, bar
  ekranının kuralıyla: bekleme planlı saatten, yoksa ödemeden sayılır,
  vakti gelmemiş ön sipariş beklemez, 24 saati geçen (bar ekranının
  düşürdüğü) sayılmaz; 15 dakikayı geçince rakam turuncu. Dikkat isteyen ve Stokta yok
  kendi gerçeğini yazar ("Azalan stokta 3 ürün"); 0'ın altına iş istemez.
- **Genel bakış'ın panoları (6 Kas 2026, Arc UI)**: şeridin altında sahip ve
  yöneticiye **Son 7 gün** (net ciro, sipariş, ortalama sepet; önceki 7 gün
  **bu saate kadar** ile: 13-8. günler tam + 7. gün bu saate kadar,
  `lastSevenDays`, `dashboardRevenue`'nun aynı okuması). 14 günlük grafiğin
  altında **kanal ve teslimat** halkaları: Uygulama / Web / Panelden ve
  Masaya servis / Gel-al / Kargo / Kurye; her parça Siparişler'in kendi
  süzgeciyle sayılır (`listOrdersFiltered`, "Son 7 gün" + **Raporda
  sayılan**), satırı saydığı listeyi açar. Yan sütunda açık **masa
  çağrıları** (Siparişler'in okuması, misafir yok; personel dahil) ve
  Müşteriler'i açan rollere **son hareket eden müşteriler** (Müşteriler,
  "Son hareket" sırası). Personel ciroyu ve dökümü görmez, okunmaz da (D1).
  Halka ve kartlar Arc UI'nin ücretsiz `donut-chart` ve `metric-card`
  kayıtlarından, `motion`suz sunucuda çizilir (panel yalnız üç arayüz
  paketi alır): `src/components/admin/arc/`, belirteçleri `--admin-*`.
  Personel ciro görmez, okunmaz da (D1). "Hızlı ekle"nin on iki çipi
  başlıkta tek **Yeni** düğmesine döndü (birden fazla sayfada menü, tekte
  doğrudan bağlantı). Ana sütunda grafik ve son siparişler tablosu (başlığı
  kartın içinde), yan sütunda açık siparişlerin durum çubuğu ve lejant
  satırları, bugün karaoke, azalan stok.
- **Listelerde araç çubuğu** (`ui/filter-bar.tsx`): her genişlikte tek
  satır: büyüteçli arama kutusu, **Filtreler (n)** ve **Uygula**; listenin
  kendi denetimleri (yeni sipariş sesi) ve **Görünümler** aynı satırın
  sonunda. Açılır listeler ve tarih **Filtreler**'in altında tam genişlik
  bir satır olarak açılır; biri seçiliyse açık gelir, "Uygula" o zaman
  alanların altına iner (klavye sırası da öyle). Bir ya da iki açılır liste
  katlanmaz, satırda adlarıyla durur ("Kategori: Kiler"). Etkin süzgeç
  çipleri kartın altında. Durum çipleri 13 px: siparişlerin dokuzu 1280
  px'te tek satır. Sipariş listesinde tablo 1440×900'de 590 px'ten 388
  px'e çıktı.
- **Sipariş satırı**: ad ve sipariş edilenler (e-posta siparişte, arama
  bulur); ödenmiş ve hazırlanmayı bekleyen siparişin adımı dolu mavi
  ("Hazırlamaya başla"), sonraki adımlar çerçeveli; "Ödeme bekleniyor"
  altında "Ödenmedi" tekrarı yok.
- **Sipariş sayfası, üç bölge** (`ui/summary-card.tsx`,
  `ui/detail-layout.tsx`): başlık ve tek birincil eylem üstte; solda
  **tutar kartı** (kararı veren tek büyük rakam: iade edilecek, ödeme
  bekleyen ya da toplam; diğerleri altında küçük çip; sipariş, ödeme ve
  kanal satırları), müşteri, teslimat ve iç not (etiket solda, değer sağda);
  sağda **sekmeler** (`ui/detail-tabs.tsx`): Kalemler (tutar ve KDV
  dahil), Ödeme ve iade, Fatura, Geçmiş (zaman çizelgesi, e-postalar,
  mesafeli satış onayı). Sekmeler `?sekme=` bağlantısıdır: sunucu istenen
  sekmeyi çizer, tarayıcıda tık anında değiştirir; dikkat isteyen sipariş
  Ödeme ve iade'de açılır; `#odeme` gibi bir çapa kendi sekmesini açar.
  Telefonda sıra: tutar, sekmeler, müşteri. Kargo ve takip numarası satırı
  koli kargoya verilince görünür.
- **Karaoke rezervasyonu ve müşteri de üç bölge**, aynı parçalarla.
  Rezervasyon: solda para (iade edilecek kırmızı, ödeme bekleyen turuncu,
  yoksa tahsil edilen ya da köşkte ödenecek), giriş kodu, gün, saat, süre
  ve kişi, kanal; altında iletişim ve varsa telafi; sağda Rezervasyon
  (iptal kuralı dahil), Ödeme, Fatura, Onaylar, Geçmiş. İade borcu olan
  rezervasyon Ödeme'de açılır. Müşteri: solda toplam harcama, durum,
  ödenen sipariş, iade ve karaoke çipleri, iletişim satırları ve hesabın
  Yönetim kartı; sağda Siparişler, Karaoke, Sadakat (damga, kupon, davet)
  ve Profil (adresler, favoriler, bildirim tercihleri). Misafirin Sadakat
  ve Profil sekmesi yok.
- **Raporlar**: dönem başlıkta segment denetimi (`ui/segmented.tsx`); beş
  rakam şeritte, her biri **bir önceki aynı uzunluktaki dönemle**
  (`analyticsHeadlineCompared`, iki dönemin tek okuması); önceki dönem
  şimdiki gibi yarım kalan son kovasının aynı noktasında kesilir
  (`previousPeriodEnd`: aynı saat, gün, hafta ya da ay geri; ayın 31'i
  kısa ayın son günü), yoksa düz satış pazartesi sabahı ve ayın 1'inde
  düşüş gibi okunurdu. İadede artış
  kırmızı. Her rakam bir **kart sekmesi** (`?m=`, `report-metrics.ts`):
  altındaki grafik seçileni kova kova çizer (net, brüt, iade, sipariş,
  ortalama sepet), başlığı ve "en yüksek"i ona göre yazılır, başka dönem
  seçilince seçim kalır. Kovalar net yanında brüt ve iadeyi de taşır,
  şeritle aynı kuralla toplanır. En çok satanlar ve karaoke ön ödemesi
  xl'den yan yana.
- **Karaoke: liste ve takvim** (`karaoke-calendar.tsx`): başlıkta Liste /
  Takvim. Takvim haftayı gösterir (`?gorunum=takvim&hafta=`): günler sütun,
  saatler satır, her rezervasyon ilk saatinden son saatine bir blok;
  rengi parasının durumu (ödendi yeşil, ödeme bekliyor turuncu, köşkte
  ödenecek mavi, işlem bekliyor kırmızı). Bugün vurgulu, saat çizgisi
  kırmızı. İptaller takvimde değil, listede. Telefonda günlük liste.
  Genel bakış'ın karaoke kartı odanın **doluluğunu** yazar (odayı tutan
  rezervasyonların açık saatlerdeki saatleri / açık saatler: iptal
  edilmemişler ve Gün sonu'nun "gelmedi" saydığı, köşkte ödenecekken akşamı
  bittikten sonra iptale düşen rezervasyon, `heldTheRoom`) ve
  geçen haftanın aynı günüyle puan farkını: "%42 · 5/12 saat, +17 puan,
  geçen cuma %25".
- **Karaoke: saati değiştir** (27 Eki 2026, operatör: "admin panelden saati
  değiştirebilir yap, değişince de kişiye mail gitsin"): rezervasyonun
  sayfasında ve listenin ⋯ menüsünde "Saati değiştir" (`karaoke-reschedule-
  dialog.tsx` → `rescheduleReservationAction` → `rescheduleReservation`).
  Tarih ve başlangıç seçilir; süre, kişi, ücret, ödeme ve iptal kuralı aynı
  kalır, para hareket etmez. Personel de yapar. İptal edilmiş, akşamı
  bitmiş, ödemesi beklenen ya da iadesi süren rezervasyon taşınmaz
  (`karaokeRescheduleBlock`). Yeni saat bir rezervasyon gibi denetlenir
  (açılış saatleri, rezervasyon penceresi, geçmiş saat yok) ve günün diğer
  rezervasyonlarıyla çakışamaz (`karaoke_reservations_no_overlap`). Ücretsiz
  iptalin son anı rezervasyonun kendi kuralıyla yeniden hesaplanır
  (`karaokeMovedDeadline`): 28 Ekim 2026'dan beri yapılan rezervasyonda
  rezervasyondan sayılır ve yeni saate göre uzamaz (yapıldığı an + süre, en
  geç yeni başlangıçtan bir dakika önce), daha önce yapılanda yeni
  başlangıçtan 2 saat öncedir. Pencerenin açıklaması bunu söyler: "...
  ücretsiz iptalin son anı rezervasyonun kendi kuralıyla yeniden hesaplanır
  (28 Ekim'den sonra yapılanda rezervasyondan sayılır ve yeni saate göre
  uzamaz) ve e-postada yazar." `updatedAt` değişmez (son durum kararının
  anıdır). Onaylı rezervasyon, geç iptal edilmiş bir saate taşınırsa saat
  yeniden satılmış sayılır (onaydaki gibi `chargeResale`). Müşteriye
  `karaoke-saat-degisikligi` e-postası gider (yeni ve eski saat, yeni imzalı
  bağlantı; ödenmiş rezervasyonda "İptal kuralın değişmedi:", iki cümle ve
  "Son ücretsiz iptal: [KARAOKE_SON_IPTAL]."); taşıma Geçmiş'e "Tarih / saat
  değiştirildi" olarak düşer, köşkün paneline ve LafPOS'a yazım pingi gider.
- **Kullanıcılar**: rol sütunu rolün açtığı bölümleri çip olarak gösterir
  ("Genel bakış · Kasa · damga · Siparişler +3"); "Roller neyi açar" artık
  bir tablo: her bölüm bir satır, her rol bir sütun, açtığı yerde tik
  (`roleMatrix`). **Son etkinlik** sütunu (Innex'in "Şu an aktif / 3 saat
  önce"u, 23 Eki 2026): son beş dakikada yanıtlanan bir isteği olan
  "Şu an aktif" (yeşil nokta), değilse ne zaman görüldüğü ("3 saat önce",
  tam saat üstünde); altında **Giriş**: adresin en yeni `login_success`
  olay kaydı (`lastSignIns`; o kayıt parola doğru girilince yazılır, 2FA
  kodunun kendi kaydı yok). Etkinlik `admin_activity`'de, adres başına tek
  satır: oturumu okunan her istek yanıttan sonra (`after()`) yazar, aynı
  sunucu örneğinden dakikada en çok bir kez (`src/lib/admin/activity.ts`);
  geçmiş tutulmaz, kullanıcı silinince satırı da silinir (aynı adres
  yeniden açılınca da), önbelleğe girmez ve rozetlerin işaretini düşürmez.
  Yazım başarısız olursa da dakika beklenir: veritabanı yokken her istek
  yeniden denemez. Pasif hesap, görüldükten sonra parolası, rolü ya da
  erişimi değişen hesap (`updatedAt`) ve görüldükten sonra Çıkış'a basan
  hesap (en yeni `logout` kaydı, `lastSignOuts`) "Şu an aktif" görünmez
  (`inPanelNow`); açık bırakılmış bir sekmenin yoklamaları ise hesabı
  aktif tutar. "Hiç girmedi" yalnız iki kayıt da
  okunup ikisi de boşsa yazar; biri okunamazsa hücre "-" der (eskiden
  günlük okunamayınca her hesap "Hiç girmedi" görünüyordu). Sayfa düşmez.
- **Müşteriler** özeti de KPI şeridi. **Boş durum**: noktalı kutuda gri bir
  simge, 15 px başlık, gri açıklama ve tek adım.
- **Hızlı bakış** (ürünler ve kafe menüsü, Innex'in sağ çekmecesi;
  `ui/quick-look.tsx`, `quick-look-core.ts`): satıra tıklayınca kayıt
  listenin üstünde, 420 px'lik bir çekmecede açılır (telefonda tam ekran).
  Çekmece listenin adresindedir (`?gor=<id>`): sunucu listeyle birlikte
  çizer, yenilemede kalır, bağlantıyla paylaşılır, JavaScript'siz de
  açılır. Tarayıcıda modaldır: Esc, karartılmış liste ya da tarayıcının
  Geri'si kapatır; liste olduğu yerde kalır, odak açan satıra döner.
  Satır bu sayfadan açtıysa kapatmak Geri'dir (açılış adresi eklemişti),
  doğrudan gelinen çekmece listeye adresi değiştirerek döner. İçinde:
  fotoğraf, kod ve rozetler, yan yana **Satış durumu / Stok durumu** (menüde
  fiyatlar), varyantlar ve alerjenler çip olarak (dördünden sonrası
  "Tümünü göster (n)"), **İşlemler** (gri kap, beyaz satırlar, renkli ikon
  kutusu): Stok güncelle (formu satırın içinde açılır), Fiyatı değiştir
  (düzenleme sayfasının fiyat kartına), Pasif / Aktif yap, Tükendi /
  Satışa aç, Kopyala, Mağazada gör; **Son hareketler** (stok) ya da sahibe
  **Son değişiklikler** (olay kaydı; yönetici son değişiklik zamanını
  görür). Alt çubukta Tam sayfa ve tek dolu düğme Düzenle; Sil satırın ⋯
  menüsünde kalır. Çekmece istemciye saklanan görseli, maliyeti, açıklamayı
  ve SEO alanlarını vermez (CAT-07/08). Modal açıkken panelin bildirim
  yığını üst katmanın altında kalır: çekmecenin kendi bildirimleri vardır
  (`ToastScope`).
- **Faturalar**: kenar çubuğunda **sayaç** (Dikkat sekmesinin kümesi: son
  gün yakın ya da geçmiş, hata, elle kesilecek, okunacak taslak, PDF
  e-postası gitmeyen, belgesi kesilmemiş iade); yalnız e-Arşiv açıkken ve
  Faturalar'ı açan rollere. Diğer rozetler gibi ucuz yoklanır: `invoices`
  tablosuna her yazım kendi işaretini (`live:invoices`) düşürür, anahtar
  köşkün günüdür (son gün yazımla değil saatle yaklaşır). Her satırda
  ⋯'nin yanında **tek adım**: taslak için "Taslağı gör" (siparişin ya da
  rezervasyonun Fatura sekmesi; taslak satırları okunmadan kesinleşmez:
  ⋯ menüsü de taslağı kesinleştirmez, aynı sekmeye "Taslağı gör ve
  kesinleştir" ile götürür), vadesi gelene "Faturayı kes", hataya
  "Yeniden dene", elle kesilecek olana "Kestim", kesimden sonra iadesi
  olana "Belgeyi kestim" (iade faturasının ya da gider pusulasının
  numarası; `docs/EARSIV.md` "Faturadan sonra iade"), kesilene PDF.
- **Yapılmayan**: §3.10'un bütçe ve gerçekleşen çubukları (gider ve bütçe
  köşkün panelinde, lafmaliyet'te; sitede veri yok) ve Genel bakış'ta
  "Sistem sağlığı" kartı (Neon CU-saati, Vercel kotası: sitenin bu
  hesaplara okuma anahtarı yok, eklemek ayrı karar).

## Kayıtlı görünümler

Süzgeç çubuğu olan her listede, çubuğun satırındaki **Görünümler**
menüsü sık açılan bir listeyi tek dokunuşla geri getirir ("Masa
siparişleri", "Kargoya verilecek"): Siparişler, Karaoke, Ürünler, Kafe
menüsü, Müşteriler, Promosyon, Stok hareketleri, Olay kaydı, Bülten ve
Masalar (23 Eki 2026'dan beri; önce yalnız ilk ikisi). Her listenin
görünümleri ayrıdır (`views.key`). Sekmesi StatusTabs'ın varsayılan
`durum`'u olmayan liste onu bildirir (Karaoke `sekme`, Müşteriler
`filter`; `views.tabParam`): bildirmeyen Karaoke, 23 Eki 2026'ya kadar
"Dikkat" gibi bir sekmeyi kaydetmiyor, o sekmedeki listeyi boş sayıyordu.
Ürünler ve Kafe menüsünde bağlantıyla açılan hızlı bakış (`?gor=`)
varsayılan görünüme kapanmaz (`views.hold`).

- **Bu görünümü kaydet**: sekme, açılır listeler ve sıralama bir adla
  kaydedilir (en çok 30 karakter, liste başına en çok 8 görünüm). Arama
  metni, tarih aralığı ve sayfa kaydedilmez; e-posta ya da telefon
  numarasına benzeyen bir değer de. Yalnız listenin kendi parametreleri
  (süzgeçleri, sekmesi, sıralaması) ve onların yazdığı türden değerler
  (harf, rakam, `_`, `-`) kalır: adrese elle eklenmiş başka bir şey
  kaydedilmez. Adda e-posta ya da telefon olamaz. Aynı adı yeniden
  yazarsan o görünümün üzerine yazılır. Kaydetmek ve silmek yalnız bu
  tarayıcıyı değiştirir, sunucuya gidilmez.
- Kayıtlı bir görünüme dokununca liste o hâliyle açılır; o an kutuda bir
  arama varsa gider. Açık görünümün adı menü düğmesinde yazar.
- **Varsayılan yap**: liste menüden ya da bir yer iminden süzgeçsiz
  açılınca bu görünüme geçer, her sekmede bir kez (sonradan seçilen yeni
  bir varsayılan da bir kez). Listenin kendi "Tümü"sü, "Sıfırla"sı ve
  çipleri süzgeçsiz listeyi gösterir; varsayılan o sekmede açıldıktan
  sonra bir siparişten Geri'yle dönmek ve sayfayı yenilemek de. Kutuda
  hatırlanan bir arama varken ya da menü gelmeden sayfada bir şeye
  basıldıysa (bir sekme, Uygula, bir bağlantı, bir tuş) varsayılan
  uygulanmaz: başlattığın gezinmenin üstüne yazmaz.
- **Görünümü sil**: onay sorar; yalnız kısayol gider, siparişler değişmez.
- Görünümler bu tarayıcıda, hesabına bağlı durur (`localStorage`,
  `laf_admin_views_v1:<hesap anahtarı>:<liste>`; anahtar Son
  açılanlar'daki gibi e-postanın HMAC'i, e-posta değil). Aynı köşk
  tabletinde başka bir hesap onları görmez, başka cihaza taşınmazlar,
  Çıkış onları silmez. Site verisi kapalıyken ya da tarayıcının yeri
  doluyken kaydedilemez; pencere bunu söyler. Gizli pencerede kaydedilen
  görünüm o pencere kapanınca gider. Sekme, açtığı varsayılanı
  `sessionStorage`'da not eder
  (`laf_admin_views_tab_v1:<hesap anahtarı>:<liste>`); not sekme
  kapanınca gider.
- Menünün kodu ayrı bir parça olarak, sayfa tarayıcıya gelince yüklenir.
  Yüklenemezse (ağ koptu, yeni sürüm çıktı) Görünümler çizilmez, liste
  olduğu gibi çalışır; sayfayı yenilemek menüyü geri getirir.
- Kasiyerde menü yok. Kurallar tek yerde: `src/lib/admin/saved-views.ts`.

## Dar menü ve Sıkı görünüm

İki görünüm tercihi. İkisi de **bu tarayıcıda** durur (`localStorage`), sahip,
yönetici ve personelde var, kasiyerde yok. Sunucunun ve sayfanın ilk çizimi
hep geniş menü ve rahat görünümdür; kayıtlı tercih sayfa tarayıcıya gelince
hemen uygulanır (tercihle yenileyince menü bir an geniş görünüp daralır).

- **Dar menü** (1024 px ve üstü): menünün üstündeki « düğmesi kenar çubuğunu
  64 px'lik bir simge sütununa katlar, sayfaya yaklaşık 190 px yer kalır.
  Aynı düğme » olarak durur ve genişletir (`laf_admin_rail_v1`).
  - Her simgenin adı vardır (`aria-label`; Siparişler ve Karaoke'de rozetin
    saydığı sayı da). Fareyle üstüne gelince ya da klavyeyle odaklanınca ad
    bir ipucu olarak çıkar; **Esc** ipucunu gizler, fare ya da odak başka
    simgeye geçince geri gelir. Tıklamayla gelen odak ipucu göstermez.
  - Grup başlıklarının yerini ince bir çizgi alır; katlanmış gruplar dar
    menüde açık sayılır (açacak başlık yok). Hesap bölümü baş harfin
    arkasındadır: tıklayınca e-posta, Güvenlik / 2FA, iki anahtar ve Çıkış
    menünün yanında açılır. "Menü sadeleşti" notu dar menüde çizilmez.
  - Siparişler'in rozeti dar menüde ayrı bağlantı değil, simgenin üstünde
    küçük bir sayıdır; rozetten Açık sekmesine gitmek geniş menüde.
  - Telefonun çekmecesi hep geniştir; tercih yalnız 1024 px üstünü etkiler.
- **Sıkı görünüm** (menünün altındaki Hesap bölümünde "Sıkı görünüm"
  anahtarı ya da paletin Tercihler'inde; `laf_admin_density_v1`): tablo
  hücreleri `py-3` yerine `py-2`, kart ve bölümler `p-6` yerine `p-4`;
  düğmeler, alanlar, "⋯" menüsü, sayfa numaraları ve sekmeler 44 px yerine
  36 px (alanlar 34 px).
  - **Yalnız fare ya da izleme dörtgeni olan cihazda** (`pointer: fine`)
    uygulanır. Telefonda ve dokunmatik ekranda hiçbir şey değişmez, 44 px
    hedefler kalır; anahtarın altındaki not dokunmatikte bunu söyler
    ("Dokunmatik ekranda uygulanmaz.") ve palet komutu da bildirir.
  - Kitin sınıfları `pointer-fine:[[data-admin-density=compact]_&]:` ile
    yazılır (`ui/compact.ts`); varsayılan sınıflar değişmedi. Tercih açıkken
    admin kökü (`data-admin-root`) `data-admin-density="compact"`, dar menüde
    `data-admin-rail="on"` taşır; `globals.css`'e kural eklenmedi. Kitten
    gelmeyen, sayfanın kendi elle yazdığı düğmeler sıkılaşmaz.
- Kasiyerin tek sayfalık kabuğu bunun hiçbirini çalıştırmaz: ne anahtar, ne
  düğme, ne kök öğeye yazım.
- Kurallar tek yerde: `src/lib/admin/view-prefs-core.ts`; tercihlerin deposu
  ve kök öğeye yazan bileşen `src/components/admin/view-prefs.tsx`.

## Supabase uyanık tutma satırı (Ayarlar → Sistem durumu, yalnız sahip)

Ücretsiz plandaki Supabase projesi 7 gün veritabanı etkinliği görmezse
duraklar ve uygulamada da sitede de her girişi reddeder; günlük cron bu yüzden
her sabah projeyi yoklar (`docs/SUPABASE-GECIS.md` §0). Cron elle
çağrılamadığı için sonucu görünmüyordu; artık her yoklama Neon'daki
`supabase_keepalive` satırına yazılır ve Ayarlar'ın en üstündeki **Sistem
durumu** kartında, servis anahtarı satırının altında bir satır durur
(`src/app/admin/ayarlar/system-status.tsx`):

- **"Supabase uyanık tutma: son başarılı ping 20 Eki 2026 09:00."** Tarih
  panelin geri kalanı gibi İstanbul saatiyle yazılır.
- **Uyarı renginde**: son başarı İstanbul takvimiyle 3 günden eskiyse (gece
  yarısı Tuzla'da yeni gün sayılır), ya da son deneme başarısızsa. Son deneme
  atlandıysa (servis anahtarı yok) satır bunu da söyler.
- **"henüz kayıt yok"**: cron bu sürümden sonra henüz çalışmadı. Tablo
  kurulalı (migration'ın `_migrations` kaydı) en çok 2 İstanbul günü
  geçtiyse uyarı değil; daha uzun süredir kayıt yoksa uyarı renginde "günlük
  görev çalışmıyor olabilir" der (`CRON_SECRET` tanımsız ya da program
  bozuk: başka hiçbir yer bunu söylemez, proje 7 günde duraklar).

Kart her şey yolundayken kapalıdır ("Her şey yolunda"); bir satır uyarı ya
da tehlike renginde olunca kendiliğinden açılır ("Dikkat istiyor").

**Genel bakış yalnız uyarıyı gösterir** (operatör, 21 Eki 2026: olağan satır
orada durmasın). Yoklama çalıştığı sürece panoda hiçbir şey yazmaz; uyarı
durumlarından biri olunca satır, posta uyarısının altında, ne yapılacağıyla
birlikte belirir. Çünkü o durumda proje birkaç gün içinde duraklar ve bunu
başka hiçbir ekran söylemez.

Yalnız sahip görür (Ayarlar'ı açabilenler): yönetici, personel ve kasiyer
için kayıt sunucuda hiç okunmaz (`readKeepaliveFor`, iki sayfada da), satır
sayfaya da girmez. Kayıt okunamazsa sayfa yine açılır, satır "kayıt
okunamadı" der.

## Kullanıcılar: kendi hesabın (21 Eki 2026)

Sahip, Kullanıcılar sayfasında **kendi** hesabını silemez, pasifleştiremez ve
rolünü değiştiremez: hesap her istekte yeniden okunduğu için daha düşük rol
bu sayfayı hemen kapatır, pasifleştirmek ya da silmek kimsenin onayı
olmadan oturumu kapatır (son sahip kuralı yalnız son sahibi korur). Satırda
rol salt okunur görünür ve "Kullanıcıyı sil" nedeniyle kapalıdır; sunucu da
reddeder. Kendi satırı yalnız adı kaydeder: rol ve erişim kayıttaki gibi
kalır, böylece env ile girilmiş bir sahibin aynı adresli pasif satırı
kaydetmekle açılmaz. Bu değişiklikleri başka bir sahip yapar.

## Genel bakış: iki adımlı doğrulama uyarısı yok (21 Eki 2026)

Genel bakış, 2FA'sı kapalı bir hesaba uyarı göstermez (operatör, 21 Eki 2026:
bir önceki sürümde eklenen satır kaldırıldı; pano o hesap için 2FA durumunu
okumaz bile). 2FA isteğe bağlıdır (operatör kararı, `docs/AUDIT.md` §11).
Durumu görmek ve açmak için: hesap menüsünde **Güvenlik / 2FA**
(`/admin/2fa-kurulum`); sahip bütün hesaplarınkini Kullanıcılar'da görür.

## Kafe menüsü: köşkün paneliyle bağlantı (22 Eki 2026)

Kalemin satış fiyatı ve "Satışta / Tükendi" durumu köşkün iç panelinden
(ladmin.laffogato.net) de değişebilir: panel, kendi ürününü sitedeki kaleme
bağlamışsa değişikliği önce siteye yazar (`docs/PANEL-MENU.md`). Böyle bir
değişiklik Olay kaydı'nda "Yönetim paneli · <ad>" diye görünür. Buradan
yapılan değişiklik de panele bildirilir; panel kopyasını hemen günceller.

Bir fiyat, hangi panelden olursa olsun, değiştiğinde Kafe menüsü sayfasının
üstündeki satır, fiyat listesinin girilen günü daha eskiyse uyarır:
"Fiyatlar <gün> günü değişti; fiyat listesinin tarihi hâlâ <gün>." Tarih
kendiliğinden değişmez (köşkteki basılı listeler aynı günü taşır); Ayarlar
> Vergi'den çekilir.

## Köşkün paneli: bar ekranı, online satış ve Sistem durumu (22 Eki 2026)

Uygulamadan ya da web'den gelen, ödenmiş kafe siparişi köşkün iç panelindeki
bar ekranına da düşer ve orada çalar (`docs/PANEL-ORDERS.md`). Ekran
siparişi ilerletmez: "Hazırlanıyor", "Teslime hazır", "Tamamlandı" burada
basılır, ekrandaki her siparişin bağlantısı bu panelde onun sayfasını açar.
Sipariş burada ilerleyince ekrandan kendiliğinden kalkar.

Köşkün paneli kâr-zararına ve kasa raporuna sitenin aldığı parayı da
(kafe, mağaza, karaoke; KDV'siyle) imzalı bir özetten okur
(`docs/PANEL-SALES.md`). Rakamlar Raporlar'ın ve Gün sonu'nunkiyle aynıdır;
panelden elle girilen sipariş kasada çalındığı için ayrı sayılır.

Ayarlar'daki **Sistem durumu** kartı bağlantının açık olup olmadığını söyler
ve açıksa köşkün paneline bağlantı verir. Kapalıysa (iki projede ortak
`KARAOKE_SYNC_SECRET` yok) kart kendiliğinden açılır: karaoke, menü
fiyatları, bar ekranı ve online satış birlikte durmuştur.

## Sistem durumu: veritabanı ve Neon işlem süresi (23 Eki 2026)

Operatör: _"Sen tüm hepsini yap maine yolla"_ (eksikler listesindeki
"Sistem sağlığı"). Yeni bir kart açılmadı: Ayarlar'ın **Sistem durumu**
kartına iki satır eklendi, Genel bakış yalnız uyarıyı tekrarlar (operatör,
21 Eki 2026: olağan satır Genel bakış'ta durmaz).

- **Veritabanı:** şema bu sürümle güncel mi (`/api/health`'in cevabı).
  Uygulama migration'ı kendisi uygular ve hatasını bilerek yutar; uygulanamayan
  bir migration yalnız bir log satırı bırakıyordu. Gerideyse kart açılır.
- **Neon işlem süresi** (yalnız sahip): bu fatura döneminin CU-saati, planın
  aylık sınırına göre yüzdesi, bu hızla ne zaman dolacağı ve compute'un günde
  ortalama kaç saat uyanık kaldığı. %80'den ya da bu hız sınırı dönem bitmeden
  dolduracaksa turuncu; o zaman Genel bakış da aynı cümleyi gösterir. Dolunca
  kırmızı: Free planda Neon veritabanını dönem sonuna kadar askıya alır.
  `NEON_API_KEY` ve `NEON_PROJECT_ID` yoksa gri kalır ve nasıl açılacağını
  söyler; anahtar tanımlıyken Neon yanıt vermezse turuncu (izleme kördür).
  Ayrıntı ve anahtarın yetkisi `docs/DATABASE.md` "Sistem durumu: Neon
  işlem süresi".

## Sipariş iptali para iade etmez (28 Eki 2026)

Operatör: _"e ticaret için de manuel işlem olsun, iade otomatik işlemesin"_
(karaoke rezervasyonunun iptal penceresiyle aynı gün;
`docs/LEGAL-REDLINES-2026-09.md` §37). O güne dek sipariş sayfasının ve
satır menüsünün "İptal et" penceresi, iade yetkisi olana "Tutarın tamamını
şimdi iade et" kutusunu işaretli getiriyor ve iptalle aynı adımda parayı
POS'a (ya da cüzdana) iade ediyordu. Artık:

- **"İptal et" hiçbir zaman para hareket ettirmez.** Pencerede iade kutusu
  ve hedef notu yok; eski bir sekmeden ya da elle gönderilen `refund=1`
  okunmaz (`cancelOrderAction`, `cancelOrder`: `CancelRequest`'te `refund`,
  `refundToken`, `expectedDestination` kalktı). Nedeni, stok kararı ve
  ödemesi alınmış siparişte sipariş numarasının yazılması aynen.
- **Ödemesi alınmış sipariş iptal edilince** "İptal edildi, iade bekliyor"
  (`refund_due`) işareti alır, pencere ve tost "para henüz iade edilmedi,
  'İade başlat' ile iade et" der; sipariş iade edilene kadar Genel bakış ve
  listenin dikkat süzgecinde durur. Siparişte zaten daha önemli bir para
  işareti (mükerrer çekim, tutar uyuşmazlığı) varsa o kalır.
- **İade her zaman ayrı, açıkça başlatılan bir adımdır** ve yalnız `refunds`
  yetkisiyle: "İade başlat" (tutar, neden, sipariş numarası, tek kullanımlık
  jeton; POS'a iade isteği), ya da para PayNkolay panelinden geri
  verildiyse aşağıdaki "PayNkolay'dan iadeyi bul" / "PayNkolay'da iade
  ettim". Kod hiçbir sipariş yolunda kendiliğinden iade başlatmaz
  (uygulamada sipariş iptali yok; iptal edilmiş siparişe gelen ödeme panele
  düşer; webhook yalnız kaydeder). Karaoke'nin başıboş ödeme iadesi
  (`refundStrayPayment`) karaoke içindir ve kalır.
- **Ödemesi alınmış siparişin iptali yine `refunds` yetkisi ister**
  (`orderActions` / `bulkRefusal`): müşterinin parasını tutmak para
  kararıdır. Toplu iptal aynı yoldan geçer, o da iade etmez.

Testler: `tests/admin-order-actions.test.ts` ("cancelOrderAction never
refunds"), `tests/admin-refund-guards.test.ts` ("never moves money in the
same step").

## Siparişte PayNkolay'da yapılmış iade (22 Eki 2026)

Operatör: _"siparişleri iptal edince PayNkolay'dan manuel iade ediyorum ama
panelde siparişi iade edildi işaretleyemiyorum"_. "İade başlat" parayı POS'a
iade isteği göndererek geri verir; para PayNkolay işyeri panelinden zaten
geri verildiyse onu kullanmak **ikinci bir iade** isteği gönderirdi. Kartla
(PayNkolay) ödenmiş bir siparişin "⋯" menüsünde bunun için iki seçenek var
(ikisi de `refunds` yetkisi ister, POS'a istek göndermez; iptal bunların
hiçbirini kendiliğinden yapmaz, yukarıdaki bölüm, 28 Eki 2026):

- **PayNkolay'dan iadeyi bul**: PayNkolay'ın işlem listesine
  (`PaymentList`, `docs/PAYNKOLAY.md` §2) bu siparişin başarılı iptal ve
  iade satırlarını sorar (ödemeden bugüne, en fazla 120 gün, 30 günlük
  parçalarla), panelde kaydı olmayan kısmı kaydeder ve ne bulduğunu söyler.
  Hiçbir şey bulamazsa ya da PayNkolay yanıt vermezse hiçbir şey yazmaz ve
  nedenini söyler: iade az önce yapıldıysa birkaç dakika sonra tekrar dene.
- **PayNkolay'da iade ettim**: her ihtimale karşı elle kayıt. PayNkolay
  panelinde iade ettiğin tutarı (kısmi iadede yalnız o kısmı), nedeni ve
  onay için sipariş numarasını yaz; istersen ürünleri stoğa geri al.

İkisi de "İade başlat"ın kaydettiği her şeyi yapar: iade defterine yazılır
(`refunds[].outside`), ödeme rozeti "İade edildi" ya da "Kısmi iade" olur
(iptal edilmemiş bir siparişte tutarın tamamı iade edilince durum da "İade
edildi"; iptal edilmiş sipariş "İptal edildi" kalır), damga geri alınır, müşteriye iade e-postası gider, "İptal edildi, iade
bekliyor" işareti kalkar, olay kaydına yazılır. Kaydedilebilecek en çok
tutar, tahsil edilenden önceki iadeler düşüldükten sonra kalandır. Aynı
düğmeye iki kez basmak defterce reddedilir; ama bir iadeyi önce "bul" ile
sonra elle (ya da tersi) kaydetmek, aynı tutarda ikinci bir kısmi iadeden
ayırt edilemez: kaydetmeden önce kartın iade satırlarına bak. Siparişte
birden çok PayNkolay tahsilatı varsa (mükerrer çekim) "bul" çalışmaz:
listedeki iptalin hangi çekime ait olduğu bilinemez, kayıt elle yapılır.
Faturası kesilmiş bir
siparişte iade, e-Arşiv'deki gibi "Faturalı siparişte iade" uyarısını
doğurur.

## Oluşturma sihirbazları (22 Eki 2026)

Operatör: _"Fatura oluşturma yeri gibi olan yerlere wizard yap ve UX/UI
olarak gelişmiş olsun. Güvenlik olarak da açık olmasın ve hızlı olsun."_

Yeni kayıt açan uzun formlar adım adım ilerler; aynı kaydın düzenleme
sayfası tek sayfa kalır (orada her şey bir bakışta görünmeli):

| Akış | Sayfa | Adımlar |
|---|---|---|
| Fatura oluştur | `/admin/siparisler/[id]/fatura` | Alıcı → Fatura adresi → Satırlar → Özet |
| Yeni sipariş (elle) | `/admin/siparisler/yeni` | Ürünler → Müşteri ve teslimat → Ödeme ve not → Özet |
| Yeni promosyon kodu | `/admin/promosyon/yeni` | Kod ve indirim → Kurallar → Özet |
| Yeni kampanya e-postası | `/admin/bulten/kampanya/yeni` | Şablon ve kitle → İçerik → Özet (taslak olarak kaydedilir) |
| Yeni menü kalemi | `/admin/menu/yeni` | Temel bilgi → Fiyat ve vergi → Görsel → Etiket ve alerjen → Özet |
| Yeni uygulama gönderisi | `/admin/mobil/gonderiler/yeni` | İçerik → Görsel ve bağlantı → Yayın → Özet (üyelere e-posta kutusu ve onayı özette) |
| Yeni ürün | `/admin/urunler/yeni` | Kendi 5 adımlı sihirbazı (`ProductWizard`) |

Kategori, masa, slayt ve duyuru gibi kısa formlar tek sayfadır: üç-dört
alanlık bir formu adımlara bölmek yavaşlatır.

**Nasıl çalışır** (`src/components/admin/ui/wizard.tsx`):

- Adım çubuğu: tamamlanan adım ✓, düzeltilecek alanı olan adım "!" ve
  kırmızı çerçeve, açık adım dolu. Geri dönmek serbest; ileri bir adıma
  aradaki adımlar denetlenerek gidilir.
- "Sonraki adım" ve tek satırlık bir alanda **Enter** o adımı denetler
  (tarayıcının kuralları + adımın kendi kuralı: VKN kontrol hanesi, en az
  bir ürün, %1-100) ve sonrakini açar. Göndermeden önce bütün adımlar
  yeniden denetlenir; sorunlu adım açılır, alanın mesajı gösterilir.
- Sunucu bir alanı reddederse o alanın adımı açılır ve adım işaretlenir.
- **Özet**: yazılanların hepsi adım adım, her satırda "Düzenle" ile o
  adıma dönüş. Sunucuda çizilen formlarda (menü kalemi, gönderi) özet
  alanların kendi etiketlerinden okunur.
- **Güvenlik:** sihirbaz yalnız arayüzdür. Her adım aynı formun içindedir,
  tek bir gönderim yapılır ve sunucu her şeyi eskisi gibi yeniden denetler
  (yetki, Zod, fiyat ve stok sunucuda). Hiçbir adım ayrı istek atmaz,
  veri tarayıcıda saklanmaz.
- **Hız:** adımlar arasında geçiş anlıktır (ağ yok); yeni paket yok, kit
  yalnız bu sayfaların yükünde (`ui/index.ts`'ten verilmez).

Testler: `tests/admin-wizards.test.ts` (hangi sayfa sihirbaz, her alan
formda mı, ilk adımda gönder düğmesi yok, düzenleme tek sayfa).
