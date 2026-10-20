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

## Palet (⌘K / Ctrl K)

Üst çubuktaki **Ara** paleti açar; klavyeden Mac'te ⌘K, Windows'ta Ctrl K
(bir alanın içindeyken de çalışır). Kasiyerde palet yok.

- **Son açılanlar**: bu sekmede açtığın son 8 kayıt sayfası (sipariş,
  karaoke, ürün, menü kalemi, kategori, slayt, promosyon, kampanya, masa,
  duyuru, gönderi). Müşteri, panel kullanıcısı, abone ve olay kaydı sayfası
  tutulmaz; başlığında e-posta ya da telefon olan kayıt da. Liste hesabına
  bağlıdır, sekme kapanınca ve **Çıkış**'ta silinir.
- **Git**: menüdeki her sayfa ve sekme, eski adlarıyla da ("Mağaza Hero",
  "kupon", "damga", "qr"). Harfleri işaretsiz yazmak yeter: "siparis"
  Siparişler'i bulur.
- **Oluştur**: rolünün açabildiği "Yeni" sayfaları.
- **Kayıtlar**: 2 harften sonra sipariş, müşteri, ürün, menü ve karaoke
  kayıtları, rolüne göre ve bölüm başına 5. Metin isteğin gövdesinde gider,
  adrese ve kayda düşmez. 5'ten fazlası varsa "Listede ara": liste aramasız
  açılır (metin adrese yazılmaz), metni listenin kutusuna sen yazarsın.
- **Komutlar**: Güvenlik / 2FA ve sipariş sesini aç / kapat (bu tarayıcıda).
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
- **Personel**: Siparişler, Karaoke, Kasa, Stok, Genel bakış. Beş sayfası
  da sığdığı için Tümü yok; menü üst çubukta.
- **Kasiyer**: çubuk yok (tek sayfası var).
- Siparişler düğmesi rozetin saydığı "Açık" sekmesini açar.
- Toplu işlem çubuğu açıkken, bir onay penceresi ya da menü açıkken ve
  telefonda bir yazı alanına dokununca (klavye açıkken) çubuk çekilir.
- Bildirimler, toplu işlem çubuğu, yeni sipariş kartları ve kaydet
  çubukları çubuğun üstünde durur; sayfanın sonu çubuğun altında kalmaz.
