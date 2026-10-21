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
- **Komutlar**: Güvenlik / 2FA, Klavye kısayolları ve sipariş sesini aç /
  kapat (bu tarayıcıda).
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

## Köşk durumu (üst çubuk) ve Personel'in Canlı durumu

Uygulamanın ana sayfasındaki "Şu an açık", boş masa, Wi-Fi, gürültü, priz ve
not Canlı durum'dan gelir (`GET /api/mobile/v1/live-status`). Vardiya bunu
akşam boyunca en çok değiştiren kişidir, o yüzden (karar D3, 20 Ekim 2026):

- **Kim.** Canlı durum ayrı bir bölüm (`venue`): Sahip, Yönetici ve
  **Personel**. Kasiyerde yok (ne sayfa ne çip). Uygulamanın slaytları,
  duyuruları, gönderileri ve ayarları eskisi gibi yalnız Sahip ve
  Yönetici'de (`mobileApp`).
- **Toplam masa yalnız Sahip ve Yönetici'de.** Personel sayfada toplam
  masayı görür ama değiştiremez (alanın adı yok, gönderilmez); sunucu
  Personel'in gönderdiği toplamı yok sayar ve kayıtlı olanı korur. Boş masa
  kayıtlı toplamı geçemez; bu kural veritabanındaki tek `UPDATE`'in içinde
  denetlenir (`patchVenueStatus`), arada toplamı düşüren bir yöneticinin
  kaydı da sayılır.
- **Üst çubuktaki çip** ("Köşk: Açık / Yoğun / Kapalı"): her panel
  sayfasında, arama ile zilin arasında. Açılınca Otomatik / Açık / Yoğun /
  Kapalı ve boş masa −/+ (44 px), Kaydet; sonuç bildirim olarak gelir.
  "Diğer ayarlar" sayfaya götürür. Yoğun ayrı bir durum değildir: yalnız
  boş masayı 0 yapar, açık/kapalı ayarı olduğu gibi kalır (sayfadaki "Boş
  masa 0" ile aynı; uygulama "masaların hepsi dolu" der). Elle Açık
  bırakılmış bir maç gecesi saat dışında da açık kalır, elle Kapalı kapalı
  kalır. Açık bir köşkte boş masa 0 ise çip "Yoğun" der ve kutu Yoğun'da
  açılır; + ile bir masa boşalınca seçim köşkün kendi ayarına (Otomatik ya
  da Açık) döner, hiçbir zaman kendiliğinden Otomatik'e değil.
- **Yalnız iki alan.** Çip yalnız açık/kapalı seçimini ve boş masayı yazar,
  tek bir SQL `UPDATE` ile: aynı anda başka birinin değiştirdiği Wi-Fi,
  gürültü, priz ya da not ezilmez. Her kayıt olay kaydına bir satır yazar
  (`venue_status`, kim, ne).
- **Veritabanını uyandırmaz.** Çip durumunu dakikada bir, yalnız sekme
  görünürken sorar; düzende veritabanı okuması yok. Rozetler gibi her cevap
  bir imleç taşır (`src/lib/admin/venue-signal.ts`): Canlı durum, Ayarlar
  (saatler) ya da bir panel hesabı yazılmadıysa ve saatler köşkü açıp
  kapatmadıysa cevap `{ unchanged: true }`: hesap okuması yok, veritabanı
  yok, yalnız çerezin imzası ve Data Cache'teki işaret. Durumu taşıyan her
  cevap hesabı yeniden okur (kural 30). Bir kayıt (`admin:changed`) imleci
  düşürür, çip hemen yeniden okur; saatler köşkü açtığı ya da kapattığı
  dakikadan sonraki ilk soru da tamdır. Önbellek çalışmazsa her soru tam
  cevap olur (dakikada bir okuma). Çerezdeki rol Canlı durum'u açmıyorsa
  karar hesabındır: rolü sonradan Personel'e yükseltilen bir kasiyer durumu
  hemen görür, ama yeniden girene kadar her sorusu tam cevaptır (imleç
  yok).
- Uygulama yeni durumu en geç 30 saniyede görür (uç `s-maxage=30`);
  `/api/mobile/v1` değişmedi.

## Klavye kısayolları

⌘K / Ctrl K her sayfada paleti açar. Sahip, yönetici ve personel için ayrıca
tek tuşlar vardır; `?` listelerini açar (paletin Komutlar'ındaki "Klavye
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
- Kaydedilmemiş değişikliği olan bir formda (ürün sihirbazı) tuşlar sayfadan
  çıkmaz: `g` ve harf hiçbir şey yapmaz, `n` bağlantıyı değil paleti açar.
  "+ Varyant ekle"den sonra odak sayfaya düşer; oraya yazılan "Guatemala"
  `g u` olup sihirbazı kapatmasın diye (tarayıcı sayfa içi geçişte sormaz).
- **Kapatmak için**: menünün altındaki Hesap bölümünde "Tek tuş kısayolları"
  (bu tarayıcıda hatırlanır; kısayol listesinde de aynı düğme var). Kapalıyken
  yalnız ⌘K / Ctrl K kalır.
- Kurallar tek yerde: `src/lib/admin/shortcut-core.ts`; dinleyici
  `src/components/admin/shortcuts.tsx` (yalnız tek tuşlu rollere, ayrı bir
  parça olarak yüklenir).

## Kayıtlı görünümler

Siparişler listesinde süzgeç çipleriyle aynı satırdaki **Görünümler**
menüsü, sık açılan bir listeyi tek dokunuşla geri getirir ("Masa
siparişleri", "Kargoya verilecek"). Diğer listeler sırayla gelecek.

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
