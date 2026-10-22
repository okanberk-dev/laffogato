# e-Arşiv fatura: Paraşüt üzerinden otomatik (22 Ekim 2026)

Online siparişlerin (mağaza kolisi; uygulama ve web kafe siparişleri: gel-al,
masa, kurye) ve ödenmiş karaoke rezervasyonlarının e-Arşiv faturasını site
Paraşüt API v4 ile kendisi keser, PDF'i müşterinin siparişteki e-posta
adresine gönderir. Teslimden itibaren 7 gün içinde kesilmeyen fatura
kesilmemiş sayılır (VUK m.231/5); panel her faturanın son gününü gösterir.

Varsayılan **kapalıdır** (`EARSIV_MODE` boş ya da `off`): site Paraşüt'e
tek istek atmaz, fatura kaydı açmaz, her şey eskisi gibi elle kesilir.

Bir siparişin faturası sipariş sayfasından **"Fatura oluştur"** sihirbazıyla
da hazırlanır (§8): kurumsal alıcı (unvan, VKN, vergi dairesi) ya da
`EARSIV_START_AT`'ten önce ödenmiş bir sipariş için. GİB'de e-Fatura
kullanıcısı olan şirkete fatura **e-Fatura** olarak kesilir, herkese
e-Arşiv.

Kod: `src/lib/invoice/` (saf kurallar `invoice-core.ts`, `address-core.ts`,
`config.ts`, `panel-core.ts`; Paraşüt istemcisi `parasut-client.ts`; veritabanı
`store.ts`; çalıştırıcı `run.ts`; `after()` kancası `hook.ts`). Tablolar:
`db/migrations/20261022190000_earsiv_invoices.sql`. Hukuki metinler:
`docs/LEGAL-REDLINES-2026-09.md` §32.

## 1. Kurulum

1. **Ayrı bir Paraşüt API kullanıcısı aç.** Paraşüt'te sitenin kullanacağı
   bir kullanıcı ekle (köşk panelinin, lafmaliyet'in kullanıcısı değil):
   satış faturası oluşturma, müşteri ve ürün/hizmet ekleme, e-Arşiv
   resmileştirme yetkisi yeterli. Neden ayrı: Paraşüt her oturum
   yenilemesinde yeni bir yenileme belirteci verir (eskisi geçersiz olur) ve
   istek sınırı (10 saniyede 10 istek) paylaşılır; iki uygulama aynı
   kullanıcıyla birbirinin oturumunu düşürebilir.
2. **API istemci bilgisini iste.** destek@parasut.com'a yaz: "API erişimi
   için client_id ve client_secret". Firma numarası (company id) Paraşüt
   adresindeki sayıdır (`uygulama.parasut.com/<firma no>/...`).
3. **Vercel'e ortam değişkenlerini ekle** (Production; değerler yalnız
   sunucuda okunur, `.env.example`'da açıklamalı):

   | Değişken | Değer |
   |---|---|
   | `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET` | Paraşüt desteğinden |
   | `PARASUT_USERNAME`, `PARASUT_PASSWORD` | sitenin Paraşüt kullanıcısı |
   | `PARASUT_COMPANY_ID` | firma numarası |
   | `PARASUT_BASE_URL` | boş bırak (varsayılan `https://api.parasut.com`) |
   | `EARSIV_START_AT` | otomasyonun başladığı gün, ör. `23.10.2026` (İstanbul saatiyle o günün başı) |
   | `EARSIV_PAYMENT_ACCOUNT_ID` | isteğe bağlı: Paraşüt'teki "PayNkolay" kasa/banka hesabının numarası |
   | `EARSIV_MODE` | önce `draft` |

   `EARSIV_START_AT` zorunludur: yalnız bu andan **sonra ödenen** siparişler
   ve bu andan **sonra biten** karaoke saatleri otomatik faturalanır. Daha
   önce elle kesilmiş faturalar böylece iki kez kesilmez. Yalnız günü yaz:
   `23.10.2026` ya da `2026-10-23`, İstanbul saatiyle o günün 00:00'ı
   demektir. Günün ortasından başlatmak istersen saati ekle
   (`23.10.2026 14:00`, yine İstanbul saati); saat dilimiyle yazılmış bir an
   (`2026-10-23T00:00:00+03:00`) da olduğu gibi okunur. Kaydettikten sonra
   Faturalar → "Bağlantı ve çalışma" kartındaki "Başlangıç"ın beklediğin gün
   ve saat olduğuna bak. Tanımsızsa ya da gün okunamıyorsa (`31.02.2026`,
   `23/10/2026`) panel "ayar hatası" gösterir ve hiçbir şey yapılmaz.

   **Üretimde `15.10.2026`** (operatör, 22 Eki 2026): PayNkolay o gün
   canlıya geçti ve o günden beri sanal POS'la ödenen karaoke ve
   siparişlerin faturası kesilmemişti. Tarama son 10 günü okur
   (`SWEEP_DAYS`), bu yüzden geriye çekilen başlangıç en fazla 10 gün
   öncesini kapsar; daha eskisi elle kesilir. Bu kayıtların bir kısmının 7
   günlük süresi geçmiş olabilir: panel kırmızı gösterir, fatura yine kesilir
   (geç kesim usulsüzlük cezası doğurabilir, kesmemek daha ağırdır;
   muhasebeciye sor).

   Değişkenler girilip site yeniden yayına alınınca Faturalar → "Bağlantı
   ve çalışma" kartındaki **"Paraşüt bağlantısını sına"** düğmesine bas:
   site kendi bilgileriyle bir kez giriş yapıp firmayı okur, fatura kesmez.
   Ret gelirse hangi bilginin yanlış olduğunu söyler (değer göstermez).

   `EARSIV_PAYMENT_ACCOUNT_ID` verilirse fatura "peşin satış" olarak
   tahsilatıyla birlikte kaydedilir (`cash_sale`); verilmezse tahsilat
   Paraşüt'te elle eşleştirilir.
4. **Kargo firmalarını gir.** Panel → Faturalar → Kargo firmaları: her satıra
   `Ad | Ticaret unvanı | VKN`. "Ad", kargoya verirken "Kargo firması"
   kutusuna yazılan addır (Yurtiçi, Aras…). Unvan ve VKN firmanın vergi
   levhasından alınır; **uydurma değer yazılmaz**, VKN'nin kontrol hanesi
   denetlenir. Listede olmayan firmayla gönderilen kolinin faturası "elle
   kesilecek" olur.
5. **Taslak modu (`EARSIV_MODE=draft`): her fatura senin onayınla
   kesinleşir** (operatör, 22 Eki 2026: _"faturayı kes diyince kessin ama
   draftını bana göstersin, final sonra kesebilsin"_). Site faturaları
   Paraşüt'te **taslak** olarak hazırlar (kendiliğinden, ya da kartta
   "Faturayı kes" ile hemen); taslak kendiliğinden resmileşmez, müşteriye
   bir şey gitmez. Sipariş ya da rezervasyon sayfasındaki e-Arşiv kartı
   taslağı gösterir: alıcı, TCKN yer tutucusu, fatura adresi, satırlar (adet,
   KDV oranı, indirim, KDV dahil tutar), KDV dökümü, genel toplam ve
   Paraşüt'te nerede olduğu (Satışlar > Faturalar, açıklaması
   "L'Affogato #10234" ya da "Karaoke krk-…"; "Paraşüt'ü aç" firmanın
   sayfasını açar). Doğruysa **"Faturayı kesinleştir"**: o taslak bugünün
   tarihiyle e-Arşiv olur, numarası ve ETTN'si kayda yazılır, PDF müşteriye
   e-postayla gider. Kontrol edilecekler: müşteri adı, il/ilçe, satırlar,
   KDV oranları, indirim, kargo/kurye satırı, toplam, tahsilat hesabı.

   Yanlış bir şey görürsen:
   - **Ad, adres ya da bir satır:** taslağı Paraşüt'te düzelt, sonra
     panelde "Faturayı kesinleştir". Site Paraşüt'teki hâli kesinleştirir;
     tek şartı genel toplamın siparişin tutarıyla tutmasıdır (tutmazsa
     kesinleştirmez, taslağa dokunmaz, iki tutarı yazar).
   - **Dünden kalan taslak:** e-Arşiv kesinleştiği günün tarihini taşır.
     Site eski tarihli taslağı kendiliğinden silmez (Paraşüt'te
     düzelttiğin bir taslak olabilir), kesinleştirmeyi reddedip söyler:
     **"Taslağı yenile"** (taslak silinir, siparişten bugünün tarihiyle
     yeniden hazırlanır; Paraşüt'te yaptığın değişiklikler gider) ya da
     tarihi Paraşüt'te bugüne çek.
   - **Faturayı Paraşüt'te kendin kestiysen:** "Paraşüt'te elle kestim" ile
     numarasını yaz; yoksa kayıt taslak kalır, panel uyarmaya devam eder.
   - **e-Arşiv işi hata verirse** (Paraşüt'ün nedeni kartta yazar) kayıt
     yine taslağa döner; düzeltip yeniden kesinleştir.

   Onay yalnız gördüğün taslak içindir: Paraşüt'te silinmiş bir taslağı
   site yeniden hazırlar ve yine senin onayını bekler. Bir taslağın
   kesinleştirilmesi yarıda kalırsa (Paraşüt yavaş) sonraki çalıştırma
   onu bitirir ve e-postayı gönderir. Bekleyen taslaklar Genel bakış'ta
   ("N taslak kesinleştirmeni bekliyor") ve Faturalar → Dikkat'te görünür.
6. **Canlı (`EARSIV_MODE=live`).** Her faturanın tek tek onaylanması
   istenmediğinde. Canlıda faturalar kendiliğinden kesinleşir; taslak
   durumundaki kayıtlar da sıraya girer: önceki günden kalan taslak silinip
   bugünün tarihiyle yeniden oluşturulur (e-Arşiv, resmileştiği günün
   tarihini taşır), sonra resmileştirilir.

Panelde ayar durumu: Faturalar → "Bağlantı ve çalışma" (mod, başlangıç, eksik
değişkenlerin **adları**, son çalıştırma). Değerler hiçbir ekranda görünmez.

## 2. Ne zaman kesilir

| Kaynak | Ne zaman | Son gün (VUK 231/5) | `shipment` |
|---|---|---|---|
| Mağaza kolisi (`fulfillment: shipping`) | "Kargoya ver" basılınca (`shippedAt`) | kargoya verilişten 7 gün | taşıyıcının unvanı + VKN + gönderi günü |
| Kurye (köşkün kendi kuryesi) | kuryeye verilince ya da tamamlanınca; ikisi de yoksa ödemeden 3 saat sonra | teslimden (yoksa ödemeden) 7 gün | şirketin kendi unvanı + VKN'si (kurye adı/TCKN gönderilmez) |
| Gel-al, masaya servis | hazır / servis edildi ya da tamamlandı; ikisi de yoksa ödemeden 3 saat sonra | teslimden (yoksa ödemeden) 7 gün | yok |
| Karaoke (ödenmiş) | rezervasyon saati bitince | saatin bitişinden 7 gün | yok |

Üç yol aynı işi yapar:

- **Kancalar:** sipariş ödenince, kargoya / kuryeye verilince ya da hazır
  olunca, tamamlanınca, iptal ve iadede `after()` ile yanıttan sonra o
  sipariş için en fazla 25 saniye. Siparişin akışını bekletmez, bozamaz.
- **Günlük cron** (`/api/cron/daily`, 09:00 İstanbul): son 10 günün ödenmiş
  siparişleri ve karaoke rezervasyonları, açık kayıtlar ve vadesi gelen her
  şey, en fazla 120 saniye. Karaoke faturası böylece ertesi sabah kesilir.
- **Panel:** Faturalar → "Şimdi çalıştır" (50 saniye), ya da kesim zamanı
  gelmiş tek bir kayıtta (kafe siparişi teslim edildi, koli kargoya verildi,
  karaoke saati bitti) sipariş / rezervasyon sayfasındaki fatura kartından
  **"Faturayı kes"**: yalnız o kaydı, ertesi sabahı beklemeden işler ve
  sonucu hemen söyler. Taslak modunda sonuç bir taslaktır (kartta görünür,
  "Faturayı kesinleştir" ile kesinleşir, §1 adım 5); canlıda fatura
  numarasıdır. Karaoke faturası saat bitmeden kesilmez: rezervasyon o ana
  kadar iptal ve iade edilebilir.

Her fatura için sıra: müşteri kaydı (e-postaya göre önbellekte; ad ya da adres
değişince güncellenir) → ürün kodları (`LAF-KAFE-10`, `LAF-MAGAZA-10`,
`LAF-MAGAZA-20`, `LAF-TESLIMAT-20`, `LAF-HIZMET-20`; yoksa oluşturulur) →
satış faturası → **toplam kontrolü** (Paraşüt'ün "Genel Toplam"ı siparişin
KDV dahil toplamıyla en fazla 0,01 TL farklı olabilir; tutmazsa taslak silinir,
kayıt "elle kesilecek: tutar tutmadı" olur, iki tutar yazılır) → (taslak
modunda burada durur) → e-Arşiv resmileştirme → fatura numarası ve ETTN →
PDF → müşteriye e-posta (`e-arsiv-fatura` şablonu, PDF ekli). Her Paraşüt
kimliği alındığı anda kaydedilir: yarıda kesilen bir çalıştırma kaldığı
yerden devam eder, aynı sipariş için ikinci fatura açmaz (yanıtı kaybolan
istekten sonra Paraşüt'te önce aranır).

Satırlar: her kalem kendi satış anındaki KDV oranıyla, birim fiyat KDV hariç;
promosyon indirimi kalemlere fişteki gibi orantılı dağıtılır ve satır
indirimi olarak yazılır; kargo/kurye bedeli kendi oranıyla ayrı satırdır.
Faturanın notu "Sipariş no: …"; koli faturasında "İrsaliye yerine geçer."
Karaoke faturasının tek satırının ürünü yalnız **"Hizmet"** (operatör, 22
Eki 2026: adında oda ya da KDV oranı yazmaz; oran faturanın KDV
sütununda). Satırın açıklaması işin cinsini ve süresini söyler, **tarih
yazmaz**: "Karaoke odası kullanımı, 2 saat"; geç iptalde köşkün tuttuğu pay
"Karaoke odası geç iptal bedeli, 2 saat". VUK 230/5 faturada işin cinsini
ve miktarını ister ("Hizmet" tek başına onu söylemez), hizmetin gününü
istemez: faturanın kendi tarihi vardır, hizmet günü rezervasyon kaydında
durur ve 7 günlük süre (VUK 231/5) ondan sayılır. Ürün kodu
`LAF-HIZMET-20`; eski adıyla açılmış "Karaoke odası (KDV %20)" ürünü
(`LAF-KARAOKE-20`) Paraşüt'te kullanılmadan kalır. Değişiklikten önce
hazırlanmış bir karaoke taslağı varsa "Taslağı yenile" ile yeni adla
hazırlanır.

## 3. Neler elle kalır ve neden

| Durum | Neden |
|---|---|
| Panelden girilen (kasada çalınan) sipariş | Belgesi kasanın ÖKC fişidir; fatura kaydı hiç açılmaz |
| Kurumsal fatura istenen sipariş | Artık elle değil: siparişin fatura kartından **"Fatura oluştur"** (§8), alıcı "Kurumsal". Şahıs şirketi (TCKN ile fatura) sihirbazda alınmaz; o fatura "Elle kesilecek" ile Paraşüt'te kesilir |
| Cüzdanla, sıfır tutarla, panelden elle tahsil edilen ödeme | e-Arşiv'in ödeme şekli muhasebeciyle netleşmedi |
| Ödül kuponu (damga, kilometre taşı, davet) ya da tutarın tamamını karşılayan kupon | Faturada indirim mi ödeme aracı mı olacağı muhasebeciyle netleşmedi |
| Fatura kesilmeden iade yapılmış sipariş | Tutar ve belge muhasebeciyle |
| Satırında KDV oranı olmayan eski sipariş | Oran tahmin edilmez |
| Kargo firması listede yok / VKN eksik | Taşıyıcının VKN'si uydurulmaz |
| Fatura ili/ilçesi okunamadı | Faturalar'da adresi düzenle, "Yeniden dene" |
| Paraşüt toplamı tutmadı | Elle kes |
| 5 denemede kesilemedi | Son hata kayıtta; elle kes ya da sorunu giderip yeniden dene |

Elle kesilen faturanın numarası Faturalar'da "Paraşüt'te elle kestim" ile
girilir; kayıt "elle kesildi" olur ve bir daha otomatik kesilmez (olay
kaydına düşer).

**Faturadan sonra iade:** kesilmiş faturaya site dokunmaz. Sipariş "Faturalı
siparişte iade" dikkat işaretini alır, fatura kartında ve Faturalar'da
"iade faturası / gider pusulası gerekir" yazar; belge muhasebeciyle Paraşüt'te
düzenlenir, sonra işaret kaldırılır.

## 4. Günlük rutin

- **Genel bakış**'taki e-Arşiv satırı: son günü geçen (kırmızı), 2 gün içinde
  dolan, kesinleştirmeni bekleyen taslak, elle kesilecek, hata veren,
  faturalı siparişte iade, e-postası gitmeyen faturalar ve ayar hatası.
  Tıklayınca Faturalar → Dikkat. Taslak modunda her sabah: Dikkat'teki
  taslakları aç, kontrol et, "Faturayı kesinleştir".
- **Koli:** "Kargoya ver"den sonra sipariş sayfasındaki e-Arşiv kartında
  "Faturayı yazdır / indir" belirir (birkaç saniye; görünmezse sayfayı yenile
  ya da Faturalar → Şimdi çalıştır). Çıktı paketin içine konur, irsaliye
  yerine geçer. PDF her seferinde Paraşüt'ten taze alınır, tarayıcı
  Paraşüt'e yönlendirilmez.
- **Üye:** faturasını `/uye/hesap/siparislerim/<no>` sayfasından indirir
  (yalnız kendi siparişi; 5 dakikada en fazla 10 indirme).

## 5. Giden veri (KVKK)

Paraşüt'e giden: müşterinin adı (siparişteki ad), e-posta adresi, fatura
ili, ilçesi ve siparişteki adres metni (**telefon numaraları metinden
çıkarılır**), sipariş/rezervasyon numarası ve tarihi, kalemler, tutarlar,
KDV, ödeme tarihi ve aracısı (PayNkolay), kolide taşıyıcının unvanı ve VKN'si.
Gitmeyen: telefon, TCKN (alıcı vergi numarası alanına GİB'in nihai tüketici
yer tutucusu `11111111111` yazılır), kart bilgisi. Paraşüt KVKK Aydınlatma
Metni §14'te veri işleyen olarak adlıdır.

Sihirbazda kurumsal alıcı seçilirse (§8) Paraşüt'e kişinin adı yerine
şirketin unvanı, VKN'si ve vergi dairesi, varsa fatura e-postası gider;
şirketin VKN'si e-Fatura kutusunu öğrenmek için Paraşüt'e sorulur.

Sitede tutulan: `invoices` (kayıt başına durum, Paraşüt kimlikleri, il/ilçe/
adres, tutar, KDV dökümü; ad ve e-posta **tutulmaz**, gerektiğinde siparişten
okunur; sihirbazdan gelen kayıtta şirketin unvanı, VKN'si, vergi dairesi,
yazıldıysa fatura e-postası ve isteyen yöneticinin adresi:
`20261022220000_invoice_buyer.sql`), `invoice_contacts` (e-posta, şirkette
`vkn:<numara>` → Paraşüt müşteri numarası, adın kendisi değil yalnız
değişiklik izi), `invoice_state` (Paraşüt oturum
belirteci, Paraşüt'ün sırlarından türeyen anahtarla şifreli; ürün
numaraları; kargo firmaları; son çalıştırma). PDF saklanmaz.

## 6. Arıza

- **Paraşüt girişi reddedildi:** kullanıcı/parola/istemci bilgisi yanlış;
  çalıştırma durur, panelde ayar satırında görünür.
- **İstek sınırı (429):** istemci `Retry-After` kadar bekler (en fazla 60 sn);
  kalan iş sonraki çalıştırmaya kalır.
- **e-Arşiv işi hata verdi:** Paraşüt'ün hata satırları kayda olduğu gibi
  (maskeli) yazılır; sık görülen: "Alıcı il/ilçe adresi doldurulmalı" (adresi
  düzenle). 5 denemeden sonra elle. Taslak modunda bir kesinleştirme hata
  verirse kayıt taslağa döner ve neden kartta yazar.
- **Belirteç sorunu:** Paraşüt sırları değişirse eski belirteç okunamaz ve
  parola ile yeniden giriş yapılır; elle bir şey gerekmez.

## 7. Muhasebeciye açık sorular

1. **Nihai tüketici yer tutucusu:** TCKN vermeyen tüketiciye `11111111111`
   ile e-Arşiv kesmek uygun mu (GİB duyurusu, 2018)? TÜRMOB'un Ocak 2026
   bülteni bunu açıkça kabul ediyor: vergi mükellefi olmayan müşteri TCKN'sini
   paylaşmak istemezse alıcı numarası alanına `11111111111` girilebilir. Site
   bu yüzden TCKN sormaz (KVKK m.4 veri en aza indirme). Karaoke ve gel-al /
   masa faturasında alıcı adresi bilinmediği için il/ilçe hizmetin verildiği
   yer (Tuzla / İstanbul), sokak boş gider; müşteri adresini verirse kesimden
   önce "Fatura adresini düzenle" ile yazılır. Muhasebeciye teyit için
   bırakıldı.
2. **Köşkün kendi kuryesi:** e-Arşiv `shipment` bloğuna şirketin kendi
   unvanı ve VKN'si yazılıyor; kurye adı ve TCKN gönderilmiyor. Uygun mu?
3. **Ödül kuponu:** damga/kilometre taşı/davet kuponu faturada indirim mi,
   ödeme aracı mı (bugün panel "ödeme aracı" dökümü gösteriyor, Ödül Programı
   §18 ve Mobil Uygulama Koşulları "indirim olarak" diyor)? Netleşene kadar
   bu siparişler elle.
4. **Cüzdan ve sıfır tutar:** cüzdanla ödenen siparişte `payment_type` ne
   olmalı; tamamı kuponla ödenen (0 TL) sipariş için belge nasıl?
5. **Faturadan sonraki iade:** nihai tüketicide gider pusulası mı, iade
   faturası mı; kısmi iadede tutar?
6. **Karaoke:** fatura saatin bittiği günden itibaren 7 gün içinde (ertesi
   sabah) kesiliyor; günlük toplu fatura yerine rezervasyon başına fatura
   uygun mu? "gelinmedi" bilgisi satıra yazılmıyor (site bilmiyor).
7. **Koli faturası notu:** faturanın notuna "İrsaliye yerine geçer." yazılıyor;
   Paraşüt'ün internet satışı şablonu bunu kendisi basıyorsa tekrar mı olur?
   Gönderim saati (dakikasıyla) Paraşüt şablonunda görünüyor mu?
8. **Paraşüt'ün e-postası:** Paraşüt, API ile resmileşen e-Arşiv'i müşteriye
   kendisi de gönderiyor mu? Gönderiyorsa sitenin e-postası ikinci kopya
   olur; Paraşüt'te kapatılmalı.
9. **Yuvarlama:** satır KDV'si yarım kuruşta yukarı mı yuvarlanıyor? Toplam
   kontrolü 0,01 TL tolerans tanır; daha büyük farkta kayıt elle kesilir.

## 8. Siparişten fatura: sihirbaz ve e-Fatura (22 Ekim 2026)

Operatör: _"normal e-ticaret siparişlerinde de siparişin içinden fatura
oluşturabileyim ... bu fatura oluşturma sihirbazını da güzel oluştur"_ ve
_"e-Arşiv yerine e-Fatura yapabilir miyiz, biz hep e-Fatura çalışıyoruz"_.

**Nereden:** sipariş sayfasındaki fatura kartı → **"Fatura oluştur"**
(taslak varsa "Alıcıyı / adresi değiştir"), ya da Faturalar → satırın ⋯
menüsü. Sayfa: `/admin/siparisler/<id>/fatura` (`invoices` rolü: sahip ve
yönetici). Otomatik fatura kapalıyken (`EARSIV_MODE=off`) görünmez.

**Dört adım:**

1. **Alıcı:** *Bireysel* (nihai tüketici, siparişteki ad, TCKN yerine
   `11111111111`) ya da *Kurumsal* (ticaret unvanı, 10 haneli **VKN**, vergi
   dairesi). VKN GİB'in kontrol hanesiyle denetlenir; şahıs şirketinin
   TCKN'si alınmaz (KVKK: gerçek kişinin kimlik numarası sitede tutulmaz),
   o fatura "Elle kesilecek" ile Paraşüt'te kesilir. İsteğe bağlı **fatura
   e-postası**: PDF oraya gider (boşsa siparişteki adrese).
2. **Fatura adresi:** il (81 il), ilçe, adres. Siparişten okunan adres
   gelir; okunamadıysa sihirbaz sorar (bu durumda sipariş "elle" kalmaz).
3. **Satırlar:** siparişin satırları Paraşüt'e gidecekleri gibi (satış
   anındaki KDV oranı, satırlara dağıtılmış indirim, kargo/kurye ayrı
   kalem), KDV dökümü ve genel toplam. Burada değişmez.
4. **Özet:** alıcı, vergi bilgisi, adres, e-posta, belge türü, tutar ve ne
   olacağı. Düğme taslak modunda **"Taslağı oluştur"** (taslak zaten varsa
   "Taslağı yeniden oluştur": eskisi silinir, yeni alıcıyla bugünün
   tarihiyle hazırlanır), canlı modda "Faturayı kes".

Sonra sipariş sayfasına dönülür; taslak kartta satır satır görünür ve her
taslak gibi **"Faturayı kesinleştir"** ile kesilir (§1 adım 5).

**Ne zaman kullanılabilir** (`invoiceWizardRefusal`): sipariş online ve
ödenmiş; iptal ya da iade edilmemiş; ödeme PayNkolay; ödül kuponu, cüzdan,
sıfır tutar, oranı olmayan eski sipariş değil; kolisi kargoya verilmiş
(e-Arşiv taşıyıcıyı yazar); fatura kesilmemiş, elle kesilmemiş, şu an
işlenmiyor ve resmileştirmesi başlamamış. Kullanılamıyorsa sayfa nedenini
yazar. `EARSIV_START_AT`'ten **önce** ödenmiş sipariş de sihirbazla kesilir
(kayıt `requestedBy` ile işaretlenir ve tarama onu kapsam dışı saymaz);
yasal son günü yine teslimden 7 gündür, geçmişse kart kırmızı yazar. Kafe
siparişi sihirbazdan istenince teslimi ya da 3 saati beklemez.

**e-Fatura mı e-Arşiv mi:** kesinleştirme anında şirketin VKN'si Paraşüt'e
sorulur (`GET e_invoice_inboxes?filter[vkn]=`, her seferinde; kayıt
önbelleğe alınmaz, şirket her gün kaydolabilir):

- **GİB'de e-Fatura kullanıcısı:** `POST e_invoices`, senaryo **TEMELFATURA**
  (`basic`; alıcı ticari faturadaki gibi reddedemez), alıcı kutusu en son
  kaydedilen adres. e-Fatura'da internet satışı ve gönderi bloğu yoktur.
  GİB faturayı şirketin kutusuna kendisi ulaştırır: sitenin e-postası
  **gitmez**, kart "e-Fatura: alıcının GİB kutusuna gitti" yazar, "E-postayı
  yeniden gönder" çıkmaz. PDF yine "Faturayı yazdır / indir"de.
- **Değilse:** e-Arşiv, alıcı vergi numarası şirketin VKN'si ve vergi
  dairesiyle; PDF fatura e-postasına (yoksa siparişteki adrese) gider.

Bireysel alıcıya e-Fatura kesilmez: nihai tüketicinin e-Fatura kutusu
yoktur, belgesi e-Arşiv'dir (VUK GT 509: e-Fatura yalnız GİB'e kayıtlı iki mükellef arasında düzenlenir, LEGAL-REDLINES "Her fatura elektronik"). "Biz hep
e-Fatura çalışıyoruz" alışılmış durum için: şirketler arası faturalar
Paraşüt'te zaten e-Fatura olarak kesilir; sihirbaz bunu online siparişe
getirir.

Paraşüt'teki müşteri kaydı şirkette VKN'ye göre tutulur (`vkn:<numara>`):
aynı kişinin bireysel ve kurumsal faturası ayrı kayıtlara gider. Paraşüt'te
başka bir alıcı için hazırlanmış taslak (alıcı sonradan değişti) asla
olduğu gibi kesinleşmez: kuyruk onu yeni alıcıyla yeniden hazırlar,
"Faturayı kesinleştir" ise "Taslağı yenile" der. Olay
kaydına şirketin unvanı ve VKN'si, il ve ilçe yazılır; e-posta ve adres
metni yazılmaz.

Kod: `src/lib/invoice/order-request.ts` (sihirbazın okuduğu her şey),
`store.ts` `requestOrderInvoice`, `invoice-core.ts` (`buyerOf`,
`invoiceWizardRefusal`, `eInvoiceBody`, `pickEInvoiceInbox`), `run.ts` (5.
adım), `src/app/admin/faturalar/actions.ts` `createOrderInvoiceAction`,
`src/components/admin/invoice-wizard.tsx`. Testler:
`tests/invoice-core.test.ts`, `tests/invoice-run.test.ts`,
`tests/invoice-wizard-action.test.ts`,
`tests/db-integration-invoices.test.ts` ("the invoice wizard's request").

**Muhasebeciye:** (10) e-Fatura senaryosu TEMELFATURA mı TİCARİFATURA mı
olmalı? Bugün temel. (11) e-Fatura'ya kesilen online siparişin notunda
"Sipariş no" yeterli mi?
