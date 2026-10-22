# e-Arşiv fatura: Paraşüt üzerinden otomatik (22 Ekim 2026)

Online siparişlerin (mağaza kolisi; uygulama ve web kafe siparişleri: gel-al,
masa, kurye) ve ödenmiş karaoke rezervasyonlarının e-Arşiv faturasını site
Paraşüt API v4 ile kendisi keser, PDF'i müşterinin siparişteki e-posta
adresine gönderir. Teslimden itibaren 7 gün içinde kesilmeyen fatura
kesilmemiş sayılır (VUK m.231/5); panel her faturanın son gününü gösterir.

Varsayılan **kapalıdır** (`EARSIV_MODE` boş ya da `off`): site Paraşüt'e
tek istek atmaz, fatura kaydı açmaz, her şey eskisi gibi elle kesilir.

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
   | `EARSIV_START_AT` | otomasyonun başladığı an, ör. `2026-10-23T00:00:00+03:00` |
   | `EARSIV_PAYMENT_ACCOUNT_ID` | isteğe bağlı: Paraşüt'teki "PayNkolay" kasa/banka hesabının numarası |
   | `EARSIV_MODE` | önce `draft` |

   `EARSIV_START_AT` zorunludur: yalnız bu andan **sonra ödenen** siparişler
   ve bu andan **sonra biten** karaoke saatleri otomatik faturalanır. Daha
   önce elle kesilmiş faturalar böylece iki kez kesilmez. Tanımsızsa ya da
   saat dilimi yoksa panel "ayar hatası" gösterir ve hiçbir şey yapılmaz.

   `EARSIV_PAYMENT_ACCOUNT_ID` verilirse fatura "peşin satış" olarak
   tahsilatıyla birlikte kaydedilir (`cash_sale`); verilmezse tahsilat
   Paraşüt'te elle eşleştirilir.
4. **Kargo firmalarını gir.** Panel → Faturalar → Kargo firmaları: her satıra
   `Ad | Ticaret unvanı | VKN`. "Ad", kargoya verirken "Kargo firması"
   kutusuna yazılan addır (Yurtiçi, Aras…). Unvan ve VKN firmanın vergi
   levhasından alınır; **uydurma değer yazılmaz**, VKN'nin kontrol hanesi
   denetlenir. Listede olmayan firmayla gönderilen kolinin faturası "elle
   kesilecek" olur.
5. **Taslak dönemi (`EARSIV_MODE=draft`).** Site faturaları Paraşüt'te
   **taslak** olarak hazırlar: resmileştirmez, müşteriye e-posta göndermez.
   Muhasebeci birkaç gün Paraşüt'te taslakları kontrol eder: müşteri adı,
   il/ilçe, satırlar, KDV oranları, indirim, kargo/kurye satırı, toplam,
   tahsilat hesabı. Taslakları muhasebeci isterse Paraşüt'te elle
   resmileştirebilir; site bunu bir sonraki çalıştırmada görür ve kaydı
   "kesildi" yapar.
6. **Canlı (`EARSIV_MODE=live`).** Muhasebeci onaylayınca. Canlıda taslak
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
- **Panel:** Faturalar → "Şimdi çalıştır" (50 saniye).

Her fatura için sıra: müşteri kaydı (e-postaya göre önbellekte; ad ya da adres
değişince güncellenir) → ürün kodları (`LAF-KAFE-10`, `LAF-MAGAZA-10`,
`LAF-MAGAZA-20`, `LAF-TESLIMAT-20`, `LAF-KARAOKE-20`; yoksa oluşturulur) →
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

## 3. Neler elle kalır ve neden

| Durum | Neden |
|---|---|
| Panelden girilen (kasada çalınan) sipariş | Belgesi kasanın ÖKC fişidir; fatura kaydı hiç açılmaz |
| Kurumsal fatura istenen sipariş | Otomasyon yalnız nihai tüketiciye keser. E-postayla gelen talepte siparişin fatura kartından "Elle kesilecek (kurumsal)" **fatura kesilmeden önce** işaretlenir |
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
  dolan, elle kesilecek, hata veren, faturalı siparişte iade, e-postası
  gitmeyen faturalar ve ayar hatası. Tıklayınca Faturalar → Dikkat.
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

Sitede tutulan: `invoices` (kayıt başına durum, Paraşüt kimlikleri, il/ilçe/
adres, tutar, KDV dökümü; ad ve e-posta **tutulmaz**, gerektiğinde siparişten
okunur), `invoice_contacts` (e-posta → Paraşüt müşteri numarası, adın
kendisi değil yalnız değişiklik izi), `invoice_state` (Paraşüt oturum
belirteci, Paraşüt'ün sırlarından türeyen anahtarla şifreli; ürün
numaraları; kargo firmaları; son çalıştırma). PDF saklanmaz.

## 6. Arıza

- **Paraşüt girişi reddedildi:** kullanıcı/parola/istemci bilgisi yanlış;
  çalıştırma durur, panelde ayar satırında görünür.
- **İstek sınırı (429):** istemci `Retry-After` kadar bekler (en fazla 60 sn);
  kalan iş sonraki çalıştırmaya kalır.
- **e-Arşiv işi hata verdi:** Paraşüt'ün hata satırları kayda olduğu gibi
  (maskeli) yazılır; sık görülen: "Alıcı il/ilçe adresi doldurulmalı" (adresi
  düzenle). 5 denemeden sonra elle.
- **Belirteç sorunu:** Paraşüt sırları değişirse eski belirteç okunamaz ve
  parola ile yeniden giriş yapılır; elle bir şey gerekmez.

## 7. Muhasebeciye açık sorular

1. **Nihai tüketici yer tutucusu:** TCKN vermeyen tüketiciye `11111111111`
   ile e-Arşiv kesmek uygun mu (GİB duyurusu, 2018)?
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
