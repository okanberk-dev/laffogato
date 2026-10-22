# İYS (İleti Yönetim Sistemi) - operatör kılavuzu

22 Ekim 2026'dan beri sitenin ticari e-postası İYS'ye bağlı. Bu belge
operatörün ne yapacağını, sitenin neyi kendisi zorladığını ve ileride bir
entegratörün nasıl takılacağını anlatır. Hukuki metinlerdeki karşılığı:
`docs/LEGAL-REDLINES-2026-09.md` §31.

## 1. Kural

Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (2020
değişikliği):

- İYS dışında (sitemizde, uygulamamızda) alınan ticari ileti onayı **3 iş günü
  içinde** İYS'ye kaydedilir. Kaydedilmeyen onaya dayanılarak ileti
  gönderilemez.
- Bize ulaşan ret **3 iş günü içinde** gönderimi durdurur ve **3 iş günü
  içinde** İYS'ye bildirilir.
- Kişi reddini İYS'den de verebilir (iys.org.tr, İYS uygulaması, e-Devlet);
  ona da uyulur.

Kanalımız yalnız **e-posta** (EPOSTA). SMS ve arama yok; uygulama bildirimi
İYS kanalı değildir.

## 2. Neden elle

İletişim adresi 250.000'den az olan hizmet sağlayıcı İYS API'sine ancak bir
**entegratör** (İYS iş ortağı, ücretli) üzerinden erişebilir; ücretsiz Temel
Hizmetler'de yükleme İYS Web'den (hs.iys.org.tr) elle yapılır. Entegratörümüz
yok. Bu yüzden aktarım bugün **elle**: site neyin, ne zamana kadar
yükleneceğini söyler ve dosyayı hazırlar; yüklemeyi operatör yapar. Kural ise
kodda (§5).

## 3. Bir kez: İYS kaydı

Bu adımlar İYS'nin güncel sayfasından doğrulanmalı (buradan erişilemedi):

1. iys.org.tr → Hizmet Sağlayıcı başvurusu: şirket (vergi no, MERSİS) ve
   yetkili kişi bilgileriyle, e-Devlet ya da e-imza ile.
2. **Temel Hizmetler** paketini seç (ücretsiz; İYS Web'den yükleme ve
   sorgulama).
3. **Marka** ekle: L'Affogato. Kanal: E-posta.
4. Paneli kullanacak kişileri yetkili kullanıcı olarak tanımla.
5. İlk yüklemeden önce: İYS Web'in toplu izin yükleme şablonunu indir ve
   sütun adlarını bizim dosyamızla karşılaştır (§4.1).

## 4. Rutin: Bülten → İYS (`/admin/iys`)

Sayfa sahip ve yönetici rolüne açıktır. Her açılışta kayıtlar sitenin onay
kayıtlarıyla yeniden eşitlenir (günlük görev de eşitler).

**En az haftada iki kez (hiçbir kaydın 3 iş günü dolmadan) ve her kampanyadan
önce:**

1. **İYS dosyasını indir.** Yüklenecek bütün ONAY ve RET kayıtları ile daha
   önce indirilip onaylanmamış olanlar tek dosyaya girer. Kayıtlar "Dosyada,
   onay bekliyor" olur.
2. **İYS Web'e yükle** (İzin Yönetimi → toplu izin yükleme).
3. **Sonucu işle.** İYS'nin reddettiği satırlarda "İYS reddetti" (hata kodunu
   yaz), sonra dosyanın satırında "İYS'ye yüklendi". Onaylananlar kampanya
   kitlesine girer.
4. **İYS'deki retleri kontrol et.** İYS Web'den markanın e-posta izin
   listesini indir ve "İYS izin listesini yükle" ile yükle. Listeyi, bekleyen
   dosyayı yükledikten **sonra** indir. Listede:
   - **RET** gördüğümüz ve bizde hâlâ açık olan adresin onayı sitede hemen
     kapanır (üyenin pazarlama ve bülten tercihi, bülten kaydı; onay
     defterine kaynak `iys` ile yazılır). Bilinen eski bir RET'ten sonra
     sitede yeniden verilmiş onaya dokunulmaz.
   - **ONAY** görünen ve bizde bekleyen ya da dosyada olan kayıt kayıtlı
     sayılır. ONAY satırı hiçbir zaman sitede yeni bir onay açmaz: onay
     kişiden, bizim formlarımızdan gelir.
   - Listeyi indiremiyorsan İYS Web'deki son izin değişikliklerine bak; yeni
     ret yoksa "İYS'yi kontrol ettim, yeni ret yok" de.

   İkisi de **3 iş günü** geçerli. Süre dolunca hiçbir ticari e-posta gitmez
   (§5).

### 4.1 Dosya

Sütunlar İYS'nin kendi sırasında (İYS'nin toplu yükleme örneği `data.csv`):

```
type,source,recipient,status,consentDate,recipientType
EPOSTA,HS_WEB,ornek@ornek.com,ONAY,2026-10-22 14:05:00,BIREYSEL
```

- `consentDate` İstanbul saatiyle `YYYY-AA-GG SS:DD:ss`.
- `source`: site `HS_WEB`, uygulama `HS_MOBIL`, e-postadaki çıkış bağlantısı
  `HS_EPOSTA`, panelden ya da kendi kararımızla kapatılan `HS_KARAR` (yalnız
  RET'te; İYS ilk ONAY'da `HS_KARAR` kabul etmez).
- İYS Web'in yükleme şablonunun sütun adları buradan doğrulanamadı; farklıysa
  sütunları şablondakilerle eşleştir. Dosya virgülle ayrılmış, UTF-8.

### 4.2 Süreler

Her kaydın son günü: izin (ya da ret) anı + 3 iş günü. **Temkinli** sayılır:
pazartesi-cuma, İstanbul saatiyle; **resmî tatiller atlanmaz** (tatil yasal
süreyi yalnız uzatır, yani son günümüz yasal son günden hep önce ya da aynı
gün). Cumartesi verilen onay çarşamba aynı saatte, cuma akşamı verilen onay
çarşamba akşamı dolar. Süresi geçen kayıt panelde ve Genel bakış'ta kırmızı,
1 iş günü içinde dolacak olan turuncu görünür.

### 4.3 "Eski onay"

Bu özellik açılmadan önce verilmiş onaylar ilk eşitlemede "eski onay"
olarak listelenir; 3 iş günleri baştan dolmuştur. Yükle; İYS onları
reddedebilir (**H467**: 3 iş gününden eski izin). Reddedilen adres, kişi sitede
ya da uygulamada yeniden onay verene kadar kampanya almaz; yeni onay yeni bir
kayıtla, kendi 3 iş günüyle gelir. O güne kadar kampanya kitlesi boştur.

### 4.4 E-postayla ya da telefonla gelen ret

Aynı gün panelde işle: üyede Müşteriler → üyenin sayfası → iletişim
tercihleri, abonede Bülten → Aboneler → Pasifleştir. Sitenin 3 iş günü
panelde işlendiği andan sayar; yasal süre ise retin bize ulaştığı andan.

### 4.5 İYS hata kodları

- **H467**: izin tarihi 3 iş gününden eski. "İYS reddetti", kod H467.
- **H178**: aynı izin aynı tarihle zaten kayıtlı. Sorun değil; reddedildi
  deme, dosyayı "İYS'ye yüklendi" ile kapat.
- **H194**: listede aynı adres birden fazla.
- Tam liste İYS'nin API belgelerinde.

## 5. Sitenin kendisi zorladığı

- **İYS'de kayıtlı olmayan adrese ticari e-posta gitmez.** Kampanya kitlesi
  (paneldeki sayım, kuyruk, her partiden önceki yeniden okuma) ve doğum günü
  e-postası yalnız İYS'nin ONAY tuttuğunu bildiğimiz adreslere gider
  (`20261022180100_iys_send_gate.sql`). Reti İYS'ye giden dosyada olup henüz
  onaylanmamış adres de dışarıda kalır.
- **İYS kontrolü 3 iş gününden eskiyse hiç ticari e-posta gitmez**
  (`src/lib/iys/gate.ts`): "Gönder" gerekçesiyle reddedilir; kuyruktaki
  kampanya bekler (başarısız sayılmaz), kontrol tazelenince günlük görev ya da
  "Gönder" sürdürür; zamanlanmış taslak zamanını korur; doğum günü kuponu
  verilir, e-postası gitmez.
- **Bize ulaşan ret anında uygulanır** (çıkış bağlantısı, hesap tercihleri,
  uygulama, panel); İYS'ye bildirilecek RET kaydı kendiliğinden açılır.
- **Hesap kapanınca** onay defteri ve İYS kayıtları e-posta adresiyle kalır:
  retin kaydı ve İYS'ye bildirimi bunlardır.
- Sipariş, kargo, parola ve doğrulama e-postaları etkilenmez.
- Genel bakış: süresi geçen ya da 1 iş günü içinde dolacak kayıt varsa ve
  kontrol eskiyken bekleyen kampanya varsa uyarı çıkar.

## 6. Teknik

- Tablolar (`db/migrations/20261022180000_iys_consent_sync.sql`):
  `iys_recipients` (adres başına istenen durum ve İYS'nin tuttuğu bildiğimiz
  durum), `iys_events` (giden kutusu: `pending` → `exported` →
  `registered` / `rejected`, ya da `superseded`), `iys_state` (açılış anı, son
  kontrol).
- `iys_reconcile(p_now, p_sources)`: onay kayıtlarından (üye tercihleri,
  bülten kayıtları, onay defteri) istenen durumu çıkarır; ONAY üstüne ONAY,
  RET üstüne RET üretmez; yüklenmemiş kaydı gereksiz kalınca `superseded`
  yapar. Kaynak eşlemesi `src/lib/iys/iys-core.ts` `IYS_SOURCE_MAP`'te,
  fonksiyona parametre olarak gider.
- `iys_settle_export`, `iys_apply_list`, `iys_record_check`, ve 3 iş günü
  hesabının SQL ikizi `iys_add_business_days`
  (`tests/db-integration-iys.test.ts` ikisini eşit tutar).
- Panel: `src/app/admin/iys/` (dosya `POST /admin/iys/dosya`, oturumu ve rolü
  kendisi denetler). Olay kaydında adres değil, sayılar.
- Bir dosya bir adresin yalnız en eski açık kaydını taşır
  (`iys_export_events`; İYS aynı adresi iki kez içeren listeyi reddeder,
  H194); sonraki kayıt bir sonraki dosyaya kalır.
- Saklama: rızası 3 yıldan önce biten (istenen durum `NONE`) adresin satırı
  ve kayıtları periyodik imhada silinir (`iys_retention`, `src/lib/retention.ts`
  `iys-outbox`; onay defteriyle aynı yayımlanmış süre). Açık kaydı olan,
  son 3 yılda kaydı yazılan ya da sonuçlanan, ya da İYS'de hâlâ ONAY
  görünen adres kalır.

## 7. Entegratör takmak

Her `iys_events` satırı İYS API'sinin `POST /sps/{iysCode}/brands/{brandCode}/consents`
gövdesinin alanlarını zaten taşır (`toIysConsentRequest`, `iys-core.ts`):
`type`, `source`, `recipient`, `status`, `consentDate`, `recipientType`.
Bir entegratör bağdaştırıcısı yalnız şunları yapar:

1. `pending` kayıtları sırayla (aynı adreste ONAY, sonraki RET'ten önce)
   entegratörün API'sine gönderir; gönderdiği kaydı `exported` yapar
   (`exportId` = entegratörün istek numarası).
2. Yanıta göre `iys_settle_export` (başarılı) ya da satır satır `rejected`
   (İYS kodu `note`'a).
3. İYS'den gelen değişiklikleri (entegratörün webhook'u ya da İYS'nin pull
   servisi) `importIysConsentList`'e verir: yeni retler sitede uygulanır ve
   kontrol kaydedilir. Böylece 3 iş günlük kontrol kendiliğinden tazelenir.

Elle akış bozulmadan yanında durur; ikisi aynı tabloları kullanır.

## 8. Açık sorular

- Üyenin İYS'ye giden onay tarihi, onay kutusunun işaretlendiği an ile e-posta
  doğrulamasının **geç olanıdır** (bülten aboneliği zaten doğrulama anında
  tarihlenir). Avukata sorulacak (LEGAL-REDLINES §31.6).
- İYS "kaynak sonradan değiştirilemez" diyor; RET'te `HS_KARAR` / `HS_EPOSTA`
  kullanımının bununla çelişip çelişmediği İYS'ye sorulmalı.
- 250.000 eşiği ve paket kuralları kurumsalhizmetler@iys.org.tr ile teyit
  edilmeli.
