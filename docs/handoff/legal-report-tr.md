# L'Affogato hukuk ve muhasebe listesi: inceleme raporu

**Durum tarihi:** 17 Ekim 2026. Canlı site (laffogato.net) ile iki depo (laffogato `main` 8307b4f, lafmobil'in gerçek `main`'i e82a70f) 17-18 Ekim gecesi kontrol edildi.

**Kapsam:** `laffogato-hukuk-muhasebe-listesi.html` içindeki 20 madde. Etiketsiz maddelere numara verdik: fA'L için FAL-1 ile FAL-4; "Diğer kontroller" için OTH-1 (menü fotoğrafları), OTH-2 (ödeme sayfası), OTH-3 (karaoke iade ve iptal), O-4 (yurt dışına aktarım). Bunlara planlanan karaoke panel ayarı (OTH-3-CFG), O-4'ün sağlayıcı alt maddeleri (O-4.1 Neon, O-4.2 Supabase, O-4.3 Vercel, O-4.4 Resend) ve VERBİS kapsam kontrolü (KVKK-VERBIS) eklendi. Toplam 26 madde. Listede olmayan ama yol üstünde bulduğumuz konular 3. bölümde.

**Nasıl okunur:** Her maddede beş başlık var: kanun ne diyor, bugün site ve uygulama ne yapıyor, karar, ne değiştireceğiz, avukata veya mali müşavire ne soracağız. Kanun maddelerini birincil kaynaktan okuduk (mevzuat.gov.tr, resmigazete.gov.tr, gib.gov.tr, kvkk.gov.tr). Emin olamadığımız yeri "düşük güven" diye yazdık. Bu rapor hukuki ya da mali görüş değildir; son söz avukatın ve mali müşavirin.

Karar türleri:

- **Uygun:** değişiklik gerekmiyor.
- **Değişmeli:** kanun açıkça istiyor ya da metin bugün yanlış.
- **Meslek kararı:** kanun tek bir cevap vermiyor; avukat veya mali müşavir seçecek.
- **Operatör işi:** imza, bildirim, anahtar yenileme, panel ayarı gibi senin yapacağın iş.

Kod ve metin değişikliklerinin tam listesi `changes.json` dosyasında. Orada `<PUBLISH_DAY ...>` metnin yayımlanacağı günü, `[...]` ise uzun bir cümlenin kısaltılmış ortasını gösterir.

## 1. Özet

| Karar | Sayı | Maddeler |
| --- | --- | --- |
| Uygun | 2 | Y3-1, Y3-7 |
| Değişmeli | 8 | Y3-2, Y3-3, OTH-3, Y2-3, Y2-4, FAL-1, OTH-1, OTH-2 |
| Meslek kararı | 6 | Y3-4, Y3-6, OTH-3-CFG, Y2-1, Y2-2, KVKK-VERBIS |
| Operatör işi | 10 | Y3-5, Y2-5, FAL-2, FAL-3, FAL-4, O-4, O-4.1, O-4.2, O-4.3, O-4.4 |

**Bu hafta yapılması gerekenler (öncelik sırasıyla):**

1. Sohbete yapıştırılan Anthropic API anahtarını bugün iptal et, yenisini yalnız Vercel'e gir (FAL-4).
2. Site canlı ve altyapının tamamı yurt dışında, ama hiçbir sağlayıcıyla KVKK standart sözleşmesi yok. Neon, Supabase, Vercel, Resend ve Google'dan "Standart Sözleşme 2" imzası iste (O-4). fA'L kapalı kalsın (FAL-2).
3. 1 Ocak 2026'dan beri üç kural yürürlükte: malı geri gönderme süresi 14 gün; iade taşıyıcısının adı verilmemişse iade kargosu müşteriden istenemez; ön bilgilendirmede arabulucu şartı yazmalı. Metinler hâlâ 10 gün diyor. `legal-distance-sales-2026` PR'ı en öncelikli metin işi (OTH-2).
4. e-Arşiv: 1 Ocak 2026'dan beri faturaların e-Arşiv olarak düzenlenmesi gerekiyor. Mali müşavirle bugünkü durumu teyit et.
5. Kasada satılan paket kahve, matcha ve cantucci %10, bu kesin. Online mağazadaki gıda için mali müşavir yazılı olarak %1 onayı verene kadar paneli %10'a al. Pamuk Önlük %10 olmalı (Y2-1, Y2-5).
6. Menüde içeriği tutmayan 7 fotoğrafı panelden kaldır (OTH-1). Bambu Chasen'in üstü çizili 999 TL fiyatını, son 10 günde gerçekten o fiyattan satılmadıysa sıfırla.
7. Telefonla alınmış ileri tarihli masa rezervasyonu var mı, bak (Y3-5).

## 2. Madde madde

### A. Rezervasyon yalnız karaoke için; karaoke iptal ve iade

#### Y3-1 Belgenin adı "Kafe Hizmet Koşulları" oldu, adresi aynı kaldı. Uygun mu?

- **Kanun:** Hiçbir kanun bir sözleşme belgesinin adını düzenlemiyor. Önemli olan iki şey var: şartın müşteriye açıkça bildirilmesi ve okunabilmesi (6098 s. TBK m.21/1) ve metnin açık, anlaşılır olması (6502 s. TKHK m.5/4). İçerikle uyumlu bir başlık bunu destekler.
- **Bugün:** `src/lib/legal/content.ts:14106-14108` başlık "Kafe Hizmet Koşulları", adres `/hukuk/kafe-hizmet-kosullari`. Çapraz atıflar güncellenmiş (content.ts:3360, 12674, 13058; content-karaoke.ts:46). Uygulamada lafmobil #15, 17 Ekim 16:05'te main'e birleşmiş. Çevrimdışı kopya siteyle aynı ve uygulama zaten önce canlı metni okuyor.
- **Karar:** Uygun.
- **Ne değiştireceğiz:** Hiçbir şey. Adres değişmesin, çünkü dışarıya verilmiş bağlantılar var. §23'e değişiklik notu eklemek de gerekmiyor. Tek ev işi: yerel lafmobil klonu eski, `git fetch` ile güncelle.
- **Soru:** Yok.

#### Y3-2 Karaoke kuralları hem Kafe Hizmet §5'te hem karaoke sözleşmesinde. §5 atfa indirilsin mi?

- **Kanun:**
  - Yalnız müşteriye gösterilen ve onaylatılan genel işlem şartı sözleşmeye girer (TBK m.21/1). Karaoke ödemesinde yalnız karaoke sözleşmesi onaylatılıyor (meta.ts:59).
  - Belirsiz ya da çok anlamlı şart, metni hazırlayanın aleyhine ve tüketici lehine yorumlanır (TBK m.23, TKHK m.5/4, Haksız Şartlar Yönetmeliği m.6/3).
  - Onaylanan ön bilgilendirme sözleşmenin parçasıdır ve tek taraflı değişmez (Mesafeli Sözleşmeler Yönetmeliği, kısaca MSY, m.5/2).
- **Bugün:** Kafe §1 (content.ts:14143) kuralların "sözleşmede ve bu Koşulların 5. maddesinde" olduğunu söylüyor. Karaoke sözleşmesi §1 (content-karaoke.ts:46) ise "yalnız bu belgeyle belirlenir" diyor. Rakamlar bugün aynı (2 saat, gelmeme, m.15/1-g). Ama §5 kendi nitelendirmesini ("götürü bir koşul", 14254) ve farklı iptal kanalı listeleri ekliyor. Aynı kural İptal, İade ve Cayma §21'de (1803) ve Veri Saklama'da (7851) da tekrar ediyor.
- **Karar:** Değişmeli. Bu bir yazım düzeltmesi, kanun doğrudan emretmiyor. Ama iki "yalnız" cümlesi birbiriyle çelişiyor. 2 saat ileride panelden ayarlanırsa her kopya ikinci bir kural olur.
- **Ne değiştireceğiz:** `legal-karaoke-cafe-single-source` PR'ı:
  - §5 yalnız rezervasyon kanallarını ve talep usulünü anlatır, kurallar için karaoke sözleşmesine atıf yapar.
  - §5'teki iki kural paragrafı ve tablo silinir.
  - §1, §4, İade §21 ve Veri Saklama aynı atfa döner.
  - Karaoke sözleşmesinin kuralları değişmez.
- **Avukata soru:** Kafe Hizmet Koşulları §5'teki karaoke özetini kaldırıp yalnız Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'ne atıf bırakmayı öneriyoruz (cümleler PR'da). Özetin kalmasını isterseniz her özetin sonuna 'Bu özet ile Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi arasında fark olursa sözleşme uygulanır.' eklenir. Hangisini onaylıyorsunuz?

#### Y3-3 Etkinlik iptal süreleri iki belgede farklı. Hangisi geçerli?

- **Kanun:**
  - Çelişen iki şart tüketici lehine okunur (TKHK m.5/4, Haksız Şartlar Yön. m.6/3, TBK m.23).
  - Sözleşme süresince şart tüketici aleyhine değiştirilemez (TKHK m.4/2). Daha sıkı bir kural ancak yeni kayıtlara uygulanır.
  - Belirli tarihli boş zaman ve yiyecek-içecek hizmetinde cayma hakkı yoktur (MSY m.15/1-g). Bu yalnız kayıt telefon, e-posta ya da mesajla yapılmışsa önemlidir. Her iki durumda da belirleyici olan sözleşmedeki iptal şartıdır.
- **Bugün:** İki belge iki noktada çelişiyor: süreler ve devrin son anı. Etkinlikler online satılmıyor.
  - Kafe §6 (content.ts:14279, tablo 14285-14297): 7 gün öncesine kadar tam iade. 72 saat ile 7 gün arası hazırlık gideri düşülür. 72 saatten az kala gerçek zarar düşülür, kalan iade edilir. Katılımcı değişikliği en az 24 saat önce.
  - İptal, İade ve Cayma §21 (1807-1810): 48 saat önce tam iade. 24-48 saat arası tam iade veya başka tarih. 24 saatten az kala ve gelmemede iade yok. Devir etkinlik başlayana kadar ücretsiz.
- **Karar:** Değişmeli.
- **Ne değiştireceğiz:** Metin düzelene kadar köşk her aralıkta misafir lehine olanı uygular:
  - 24 saatten önce tam iade.
  - 24 saatten az kala ve gelmemede yalnız belgelenmiş ve başka türlü değerlendirilemeyen hazırlık gideri düşülür, kalanı iade edilir.
  - Katılımcı devri etkinlik başlayana kadar ücretsiz.

  Sonra kural tek yerde, İade §21'de durur ve Kafe §6 ona atıf yapar (aynı PR). Son rakamlar senin ticari kararın.
- **Avukata soru:** Etkinlik iptalinde iki belge çelişiyordu. Tek kural olarak şunu öneriyoruz: 24 saatten önce tam iade; 24 saatten az kala ve gelinmezse yalnız belgelenmiş fiili hazırlık gideri düşülür, kalan iade edilir; katılımcı devri etkinlik başlayana kadar ücretsiz. Bu metni (İptal, İade ve Cayma §21) onaylıyor musunuz, yoksa işletme daha sıkı bir süre isterse bunun yalnız yeni kayıtlara uygulanması (TKHK m.4/2) yeterli mi?

#### Y3-4 Telefonla yapılan karaoke iptali hangi anda geçerli sayılır?

- **Kanun:** Sözleşmeyle tanınan bir iptalin telefonda ya da e-postada hangi anda hüküm doğurduğunu söyleyen açık bir TBK maddesi bulamadık (düşük güven). Kıyas olarak:
  - Cayma bildiriminde süre içinde gönderilmesi yeter, ispat tüketicidedir (MSY m.11/1, 11/4).
  - Telefonla yapılan öneri hazırlar arasında sayılır (TBK m.4/2).
  - Kural yoksa belirsizlik misafir lehine okunur (TKHK m.5/4).
  - Satıcı işlem kayıtlarını 3 yıl saklar (MSY m.20/1).
- **Bugün:** Sözleşme "bizi arayarak yaptırabilirsiniz" diyor (content-karaoke.ts:94, 97) ama hangi anın sayılacağını yazmıyor. Panelde personelin yaptığı her iptal "işletme iptali" sayılıyor ve tam iade yapılıyor (src/app/admin/mobil/karaoke/actions.ts:176-232; karaoke-payment.ts:1481-1546). Yani telefonla arayan her saatte tam iade alıyor. Bu metinden cömert ve misafire zarar yok, ama kayıtta misafir talebi işletme iptali gibi görünüyor. Tam 2 saat kala kod iptali geç sayıyor. Sayfa ise son anı açıkça yazıyor (karaoke-reservation-view.tsx:199-201), yani boşluk bir milisaniye.
- **Karar:** Meslek kararı. Kanunen şart değil, yazılması tavsiye edilir.
- **Ne değiştireceğiz:** Avukat onaylarsa karaoke sözleşmesi §7'ye bir madde eklenir (metin soruda) ve sözleşmenin sürüm tarihi ilerler. Panelde "misafir istedi (telefon / e-posta)" iptal modu isteğe bağlı ayrı bir iş. O zamana kadar personel tam iade yapmaya devam eder; bu kanuna uygun.
- **Avukata soru:** Telefon ya da e-postayla yapılan karaoke iptalinin hangi anda geçerli sayılacağına dair kanunda açık kural bulamadık. Karaoke sözleşmesi §7'ye şu maddeyi eklemeli miyiz: 'İptali bizi arayarak yaptırırsanız aramanızın tarafımızca yanıtlandığı an, e-postayla bildirirseniz e-postanızın {{EMAIL}} adresine ulaştığı an iptal anı sayılır. Telefonla iptal talebinizi aynı gün e-postayla teyit ederiz. Telefonumuza ulaşamazsanız iptalinizi e-postayla bildirebilir ya da hesabınızdan veya kişiye özel bağlantınızdan kendiniz yapabilirsiniz.' Tam 2 saat kala yapılan iptal kodda geç sayılıyor (sayfada son an yazıyor); tüketici lehine '2 saat ve daha fazla' olarak değiştirmemizi ister misiniz?

#### Y3-5 Telefonla onaylanmış ileri tarihli masa rezervasyonları: tek tek aranmalı mı?

- **Kanun:**
  - Onaylanmış rezervasyon onaylandığı şartlarla kalır (TKHK m.4/2).
  - Haklı sebep olmadan hizmet reddedilemez; politika değişikliği haklı sebep değildir (TKHK m.6/2).
  - İfa etmeyen, kusursuz olduğunu ispat edemezse zararı öder (TBK m.112).
  - İfa imkânsızlaşırsa 3 gün içinde bildirim ve 14 gün içinde iade gerekir (MSY m.16/4). Burada yalnız asgari takvim olarak kullanılabilir.
- **Bugün:** §23 (content.ts:14634) onaylanmış rezervasyonları onaylandıkları sürüme bağlıyor. Masa rezervasyonları yalnız telefon ve e-postayla alınmış ve veritabanında yok, sistem listeleyemez.
- **Karar:** Operatör işi. Karşılanacak bir rezervasyon için aramak kanunen şart değil; eski şartlarla karşılanır.
- **Ne değiştireceğiz:** OP-TABLE-BOOKINGS (5. bölüm):
  - Defteri, WhatsApp ve Instagram mesajlarını ve işletme e-postasını 17 Ekim sonrası tarihli masa ve grup rezervasyonu için tara.
  - Her birini eski şartlarla karşıla ve personele söyle.
  - Gerçekten karşılanamayan olursa misafire 3 gün içinde telefon ve e-postayla bildir, kaporayı 14 gün içinde tam iade et, alternatif öner.
  - Gönderilecek mesajlar: "Merhaba, {tarih} {saat} için aldığın masa rezervasyonu geçerli, o gün seni bekliyoruz." ya da "Merhaba, {tarih} {saat} için aldığın masa rezervasyonunu karşılayamıyoruz, özür dileriz. Ödediğin {tutar} kaporayı en geç 14 gün içinde iade ediyoruz."
  - Tarihler geçince isim ve numaraları defterden sil (KVKK m.7/1).
  - Sonucu docs/LEGAL-REDLINES-2026-09.md §17'ye yaz.
- **Soru:** Yok.

#### Y3-6 Erişim (§20) ve evcil hayvan (§12) cümleleri rezervasyon vaadi mi?

- **Kanun:**
  - Belirsiz şart tüketici lehine okunur (TKHK m.5/4).
  - Engellilik temelli ayrımcılık yasaktır ve makul düzenleme yapılır (5378 s. Engelliler Hakkında Kanun m.4/A, m.3/1-j).
  - Makul düzenleme yapmamak ayrımcılıktır; kamuya açık hizmet verenler makul düzenleme yapar (6701 s. TİHEK Kanunu m.4/1-f, m.5).
- **Bugün:**
  - §12 (content.ts:14473) "talebinizi geldiğinizde personele bildirmeniz" diyor. Masa tutma yok, rezervasyon değil.
  - §20 (14581) "ziyaretinizden önce {{PHONE}} numarasından bildirmeniz rica olunur, böylece erişimi en kolay masa tahsis edilebilir" diyor. "Edilebilir" bir çaba ifadesi, ama önceden bildirimle birlikte "tahsis" masa tutma gibi okunabilir.
  - §5 (14250) ise "masa ve grup rezervasyonu alınmaz" diyor.
- **Karar:** Meslek kararı. §12 değişmez. §20 bir rezervasyon sözleşmesi değil, erişim düzenlemesi. Makul düzenleme yükümlülüğü metinden bağımsız olarak var, cümle kalmalı.
- **Ne değiştireceğiz:** Asgari düzeltme S1 PR'ında: §5'e "Bu kural, 20. maddede düzenlenen erişim ihtiyacına yönelik ön bildirimi kapsamaz." eklenir. İsteğe bağlı olarak, personelin gerçekte ne yaptığını söylersen (OP-ACCESS-TABLE) §20 iki seçenekten biriyle yeniden yazılır:
  - Masa tutuluyorsa: "Bu bildirim bir masa rezervasyonu değildir; erişim ihtiyacınıza yönelik makul düzenleme olarak, mümkün olduğu ölçüde erişimi en kolay masayı bildirdiğiniz geliş saatine kadar hazır tutar ve personelimizi önceden hazırlarız."
  - Masa tutulmuyorsa: "Bu bildirim bir masa rezervasyonu değildir ve masa ayrılmaz; geldiğinizde erişimi en kolay boş masayı size gösterir, gereken desteği sağlarız."
- **Avukata soru:** Kafe Hizmet §20'deki erişim cümlesini rezervasyon vaadi sayılmasın diye iki seçenekle yazdık (masa tutulur / masa tutulmaz, geldiğinde en uygun boş masa gösterilir). İşletmenin uygulaması netleşince hangisini kullanalım; §5'e eklediğimiz 'Bu kural, 20. maddede düzenlenen erişim ihtiyacına yönelik ön bildirimi kapsamaz.' cümlesi yeterli mi?

#### Y3-7 Üyeliksiz karaoke yapanlar KVKK metninde ayrı ilgili kişi grubu olarak yazılsın mı?

- **Kanun:**
  - Aydınlatmanın asgari içeriği: veri sorumlusu, amaç, verinin kime ve neden aktarılabileceği, toplama yöntemi ve hukuki sebep, m.11 hakları (6698 s. KVKK m.10/1). İlgili kişi grubu listesi zorunlu kalem değil.
  - VERBİS kaydı varsa aydınlatma onunla uyumlu olmalı (Aydınlatma Tebliği m.5/1-ç). VERBİS kaydında gruplar beyan edilir (KVKK m.16); küçük işletmeler muaf olabilir (Kurul 2023/1154).
- **Bugün:** KVKK Aydınlatma §5'te "Kafe ziyaretçisi" grubu karaoke rezervasyonu yapanı açıkça kapsıyor (content.ts:5758). Veri kategorisi de hukuki sebebiyle ayrıca yazılı: "Üye ve üyeliksiz rezervasyon yapan kişi - Karaoke rezervasyon verisi" (5785).
- **Karar:** Uygun.
- **Ne değiştireceğiz:** Zorunlu değişiklik yok. S4 PR'ında isteğe bağlı bir netlik ifadesi var: "internet sitesi veya mobil uygulama üzerinden, üye olarak ya da üye olmadan karaoke odası rezervasyonu yapan". Asıl eksik başka bir yerde: üyeliksiz misafir verisi için saklama süresi yok (3. bölüm).
- **Mali müşavire soru:** VERBİS muafiyeti için yıllık çalışan sayısı 50'nin ve yıllık mali bilanço toplamı 100 milyon TL'nin altında mı (Kurul 2018/87, 2023/1154 ve 2025/1572 ile değişik)? Rakamları yazılı teyit eder misiniz? Muafsak standart sözleşmelerin Ek I'indeki VERBİS kısmını boş bırakacağız.

#### OTH-3 Karaoke iade ve iptal metinleri (2 saat kuralı, gelmeme, MSY m.15/1-g, işletme iptalinde tam iade)

- **Kanun:**
  - Belirli gün ve saatte sunulan eğlence hizmetinde cayma hakkı yok (MSY m.15/1-g). 24.05.2025 değişiklikleri ve Danıştay'ın 06.05.2026 tarihli, (ı), (j), (k) bentlerini iptal eden kararı bu bendi etkilemiyor.
  - Ödemeden önce temel bilgiler bir arada gösterilir ve onaylatılır; siparişin ödeme yükümlülüğü doğurduğu söylenir (MSY m.5, m.6/2-a, m.7/1, m.8/1).
  - İfa imkânsızlaşırsa satıcı 3 gün içinde bildirir, 14 gün içinde ödemenin tamamını iade eder. Bu kural yalnız imkânsızlık içindir (MSY m.16/4).
  - Haklı sebep olmadan hizmet reddedilemez (TKHK m.6/2).
  - Haksız şart örnekleri: tüketici vazgeçince ödemeyi tutan ama satıcı vazgeçince eşdeğer tazminat vermeyen şart, aşırı tazminat ve keyfi fesih (Haksız Şartlar Yön. EK (ç), (d), (e)). Bunlar m.7/1 ile kesin hükümsüz.
  - Aşırı ceza koşulunu hâkim kendiliğinden indirir (TBK m.182/3).
  - Sözleşme ve ön bilgilendirme kalıcı veri saklayıcısıyla, değiştirilmeden erişilebilir şekilde verilir (TKHK m.4/1, MSY m.4/1-c, m.6/1).
- **Bugün:** Kurallar doğru yerde ve ödemeden önce gösteriliyor:
  - KDV dahil toplam, cayma olmadığı ve iki kural cümlesi (karaoke-booking.tsx:581-586).
  - Üç ayrı işaretsiz zorunlu kutu (624-680).
  - "Rezervasyonu onayla ve {tutar} öde" düğmesi ve "Bu düğmeyle ödeme yükümlülüğü altına girersin." cümlesi (700-708).
  - Uygulama da sunucunun kurallarını ödemeden önce gösteriyor.

  Eksikler:
  1. Sözleşme §8 (content-karaoke.ts:103) "başka bir nedenle" yapılan işletme iptalini de m.16/4'e bağlıyor. Oysa m.16/4 yalnız imkânsızlık için.
  2. Kafe §5 bu kuralı "götürü bir koşul" diye nitelendiriyor (14254).
  3. İptal e-postası, iptali kim yaparsa yapsın "Karaoke rezervasyonun iptal edildi. Oda serbest bırakıldı." diyor (src/lib/email/text.ts:299-316). İşletme iptal ettiğinde neden ve tam iade yazılmıyor, yani e-posta m.16/4 bildirimi yerine geçmiyor.
  4. Onay e-postası yalnız canlı sayfaya bağlantı veriyor. /hukuk sayfalarında sürüm yok ve panelden metin değişirse tek kayıt üzerine yazılıyor. Bu yüzden misafirin onayladığı metin sonradan gösterilemeyebilir.
- **Karar:** Değişmeli. Öz kalsın: 2 saatten önce tam iade, sonrası ve gelmemede iade yok, cayma yok, işletme iptalinde tam iade. Süre kısa ve o saat gerçekçi olarak yeniden satılamıyor; bu yüzden avukatın %100 kaybı kabul etmesi muhtemel.
- **Ne değiştireceğiz:**
  - S1'de §8 ikiye ayrılır. Elimizde olmayan sebeplerde m.16/4 takvimi uygulanır. Başka sebepte de tam iade yapılır ve "kanundan doğan tazminat haklarınız saklıdır" yazılır. "Götürü" cümlesi silinir; yerine "cezai şart değildir" de yazılmaz, çünkü etiket mahkemenin nitelendirmesini değiştirmez.
  - `karaoke-business-cancel-notice` PR'ı: personel ödenmiş bir rezervasyonu iptal ederken sabit listeden neden seçer (arıza, geçici kapanış, mücbir sebep, diğer). E-posta şöyle der: "Rezervasyonunu biz iptal etmek zorunda kaldık: {neden}. Özür dileriz. Ödediğin [tutar] tutarın tamamını kartına iade ettik; yansıması bankana göre birkaç iş günü sürebilir." İç not e-postaya hiç gitmez.
  - `legal-versions-durable-copy` PR'ı: her yayımlanan sürüm saklanır, e-posta onaylanan sürümün değişmez bağlantısını verir.
  - İsteğe bağlı: işletme iptalinde aynı süre için ücretsiz yeni saat (OP-KARAOKE-GOODWILL).
  - İsteğe bağlı: ödeme öncesi "Satıcı:" satırına ticaret unvanını eklemek. m.6/2-a bunu orada istemiyor; bağlı belgede unvan ve VKN zaten var.
- **Avukata soru 1:** Karaoke odasında saate 2 saatten az kala iptal ve gelmeme hâlinde iade yapılmıyor (MSY m.15/1-g ile cayma yok). Bu tam kaybı Haksız Şartlar Yönetmeliği EK (ç), (d) ve TBK m.182/3 karşısında savunulabilir buluyor musunuz? Geç iptal edilen saat başkasına satılırsa ilk misafire iade yapılmalı mı (sözleşme kira mı, hizmet mi, karma mı)? İşletme iptali metnini 'elimizde olmayan sebep' ve 'başka sebep' olarak ikiye ayırdık; onaylıyor musunuz?
- **Avukata soru 2:** Sipariş ve karaoke onay e-postaları bugün yalnız güncel /hukuk sayfalarına bağlantı veriyor; panelden metin değişirse misafirin onayladığı metin gösterilemiyor. Her yayımlanan sürümü saklayıp e-postada o sürümün değişmez bağlantısını vermek MSY m.4/1-c ve ETHS Yön. m.8/1-d için yeterli mi, yoksa onaylanan ÖBF ve sözleşmenin sipariş bilgileriyle doldurulmuş PDF'i e-postaya eklenmeli mi?

#### OTH-3-CFG Planlanan panel ayarı: ücretsiz iptal saati (0-72) ve geç iptal iade yüzdesi

- **Kanun:**
  - Sözleşme süresince şartlar tüketici aleyhine değiştirilemez (TKHK m.4/2) ve onaylanan ön bilgilendirme sözleşmenin parçasıdır (MSY m.5/2). Bu yüzden panelde yapılan bir değişiklik daha önce yapılmış bir rezervasyona asla uygulanamaz ve her rezervasyonda kuralın anlık görüntüsü saklanmalı.
  - Hazırlayana tek taraflı değiştirme yetkisi veren şart yazılmamış sayılır (TBK m.24; Haksız Şartlar Yön. EK (h)).
  - Temel şartlar ödemeden hemen önce gösterilip onaylatılır; kopyası kalıcı veri saklayıcısıyla verilir (MSY m.6/2-a, m.7/1; TKHK m.4/1).
  - Dengesizlik yaratan şart hükümsüzdür (TKHK m.5; Haksız Şartlar Yön. m.5/1, m.7/1, EK (ç), (d)). Aşırı ceza indirilir (TBK m.182/3).
  - İşletme ifa edemezse ödenen her şey iade edilir (MSY m.16/4; TBK m.136/2, m.112). Yani yüzde ayarı işletme iptaline asla uygulanmaz.
  - Kısmi iadede KDV düzeltmesi gerekir (KDV K. m.35).
- **Bugün:**
  - 2 saat koda gömülü (src/lib/mobile/karaoke-time.ts:25, 67-88). Kural cümleleri sabit (98-112); web, API ve e-posta bunları kullanıyor. Hukuk metinleri "2 saat"i elle yazıyor.
  - Fiyat rezervasyonda saklanıyor (content-karaoke.ts:65), ama onay kaydı kural değerlerini saklamıyor (karaoke-core.ts:110-125).
  - PayNkolay v1 yalnız tam iade yapıyor ve metin "kısmi iade yapılmaz" diyor.
  - lafmobil rezervasyon ekranı kendi "2 saat" cümlelerini basıyor.
- **Karar:** Meslek kararı. Anlık görüntü kanunen şart; üst sınırlar avukatın değerlendirmesi.
- **Ne değiştireceğiz:** Yalnız bu ayarı yapmaya karar verirsen (OP-KARAOKE-CFG-DECISION):
  - Önce `karaoke-cancel-policy-snapshot`: rezervasyon anında süre, yüzde, son an ve gösterilen cümleler saklanır. Eski rezervasyonlar 2 saat / %0 olarak okunur. Panel alanının altında "Değişiklik yalnız bundan sonra yapılan rezervasyonlara uygulanır." yazar.
  - Sonra `legal-karaoke-cancel-policy-parametric` (sözleşme "özette gösterilen son an" der), `karaoke-cancel-policy-display` ve uygulama ekranı.
  - Kısmi iade sandbox'ta doğrulanana kadar yüzde yalnız 0 ya da 100 olabilir.
  - İşletme iptali her zaman %100.
  - Uygulamanın yeni sürümü asgari sürüm olana kadar değerler 2 saat / %0 kalır; yoksa eski sürümler misafire onaylamadığı bir kural gösterir.
- **Avukata ve mali müşavire soru:** Avukata: panelden karaoke ücretsiz iptal süresi (0-72 saat) ve geç iptal iade yüzdesi ayarlanabilir olacaksa şu sınırı öneriyoruz: iade %0 ise süre en çok 24 saat, süre daha uzunsa iade en az %50. Uygun mu, yüzde gelmeme hâlini de kapsasın mı? Mali müşavire: geç iptalde tutulan bedel ve ileride kısmi iade nasıl faturalanmalı (KDV K. m.35 düzeltmesi)?

### B. Ürüne göre KDV (%1, %10, %20)

#### Y2-1 Kasada satılan paket kahve %10 mu? Online mağaza ayrı mal satışı olarak mı kayıtlı?

- **Kanun:**
  - (I) sayılı listedeki mallar %1, (II) sayılı listedekiler %10, diğerleri %20 (BKK 2007/13033 m.1). CBK 5189 gıda bölümünü (I) sayılı listeye taşıdı; CBK 7346 genel oranı %20'ye, (II) sayılı listeyi %10'a çıkardı. Metni GİB'in güncel KDV oranları dokümanında okuduk.
  - Kahve, çay, matcha (fasıl 09) ile şeker, kakao, unlu mamul ve dondurma (fasıl 17-21) sıradan bir perakendeci mal olarak satınca %1.
  - Ancak kahvehane, kafeterya, pastane gibi yerlerin hizmeti (II) sayılı listenin 24. sırasında. KDV Genel Uygulama Tebliği III/B-2.4.1 (Seri 51 ile, 1.5.2024'ten beri) bu işletmelerin sattığı gıdayı, nerede tüketilirse tüketilsin, %10 sayıyor. Tebliğin 1. örneğinde kafeterya ruhsatlı bir kahvecinin müşteriye öğüttüğü paket Türk kahvesi de %10. Tebliğ ayrıca "Bu işletmelerin telefonla veya internet üzerinden sipariş suretiyle adrese gönderme, gel-al gibi yöntemlerle yaptıkları tüm satışlar da aynı mahiyettedir." diyor.
  - GİB özelgesi E-55054586-130-56345 (Zonguldak VDB, 09.08.2024): oran işyeri işyeri belirlenir; servis alanı olmayan, ayrı ruhsatlı satış yeri %1 uygular.
  - Fazla gösterilen KDV ödenir ve alıcıya iade edilmedikçe geri alınamaz (KDV K. m.8/2). Eksik beyan vergi ziyaı cezası doğurur (VUK m.344). Mükellef kendi durumu için özelge isteyebilir (VUK m.413).
- **Bugün:**
  - `src/lib/utils/kdv.ts:13-16` yeme-içme işletmesinin gıdasını "nerede tüketilirse tüketilsin" %10 sayıyor, ama 63-71'de mağaza kahvesi ve kiler %1.
  - Canlı API'de Sirena, Notturna, Uji Matcha, Cantucci ve Yenilebilir Kup %1; menüdeki 82 kalem %10.
  - Mağaza ürünleri yalnız kargoyla gidiyor. Kasa satışı sistem dışında.
  - Panel ipuçları "%1" diyor (settings-form.tsx:280-281). Hukuk metinleri kahvede ve paketli gıdada %1 vaat ediyor (content.ts:268, 882).
  - Kafenin işyeri açma ruhsatı, e-yoklama işyeri türü ve kolilerin çıktığı yer hiçbir yerde kayıtlı değil.
- **Karar:** Meslek kararı. Kasa kısmı kesin: %10.
- **Ne değiştireceğiz:**
  - Kasada (ÖKC) bu ürünlerin departmanı %10 olur (OP-TILL-KDV).
  - Online mağaza için mali müşavir yazılı olarak %1 onayı verene kadar (ya da GİB bir özelge talebine cevap verene kadar) panelde kahve = 10, kiler = 10 ve Yenilebilir Kup'un kendi oranı = 10 olur (OP-SHOP-KDV-INTERIM).
  - Risk tek yönlü: %10 gereken yerde %1 uygulamak vergi ziyaı ve faiz demek. %1 gereken yerde %10 uygulamak ise KDV dahil fiyatın her lirası için yaklaşık 8 kuruş marj kaybı; bu pratikte geri alınamaz. Müşteri iki durumda da aynı fiyatı öder.
  - Panel ipuçları `admin-kdv-hints-and-citation` PR'ında yeni kurala göre yazılır.
  - Karar çıkınca kod varsayılanları (kdv.ts, data.ts:880-881) ayrı bir PR ile değişir.
- **Mali müşavire soru:** Online mağazada kargoyla sattığımız paket kahve, matcha, cantucci ve yenilebilir kup için %1 mi %10 mu uygulamalıyız? KDV GUT III/B-2.4.1 (Seri 51) kafeterya işletmesinin internetten adrese gönderdiği satışları %10 sayıyor; %1 ancak mağaza ayrı ruhsatlı ve servis alanı olmayan bir satış yerinden yürütülürse savunulabilir (özelge 32095). Kolilerin çıktığı yer, o yerin işyeri açma ve çalışma ruhsatı, masa/oturma alanı olup olmadığı ve Tuzla VD kaydı (e-yoklama işyeri türü, işyeri sayısı) şunlar: [...]. Yazılı görüşünüzü, gerekirse VUK m.413 özelge talebiyle birlikte rica ederiz. Yanıta kadar paneli %10'a alıyoruz.

#### Y2-2 Kargo bedeli faturada ürünün oranıyla mı, ayrı %20 olarak mı?

- **Kanun:**
  - Satıcının, alıcının gösterdiği yere kadar üstlendiği taşıma giderleri malın matrahına girer (KDV K. m.24/a; GUT III/A-5(a)). Kodda yazan m.24/b ambalaj, sigorta, komisyon gibi giderler için; doğru bent (a).
  - GİB uygulaması bölünmüş. Özelge 32558 (Balıkesir VDB, 2015), mal fiyatına dahil edilip tek tutar gösterilen taşımayı malın oranında sayıyor. Özelge 32391 (Balıkesir VDB, 2017) ise ayrı gösterilen ya da dışarıdan alınan taşımayı ayırıp genel oranda vergilendiriyor.
  - Birlikte yapılan farklı oranlı işlemlerde bedel ayrıştırılır (GUT III/B-1.3).
  - İndirimli oranlı satıştan doğan KDV iadesi yalnız yıllık eşiğin üstünde alınır (2026: 164.000 TL; GUT III/B-3).
- **Bugün:**
  - kdv.ts:23-25 ve 247-250 kargo bedelini satırlara orantılı dağıtıyor ve her payı satırın oranıyla vergilendiriyor (m.24/b atfıyla).
  - Aynı kural content.ts:268, 2126 ve 2159'da, panel notunda (settings-form.tsx:295-296), docs/API-MOBILE.md:606'da ve LEGAL-REDLINES'ta yazılı.
  - Kargo ödeme sayfasında ve basılı sipariş fişinde ayrı satır. Taşımayı Geliver üzerinden üçüncü bir firma yapıyor.
  - Fatura depoda üretilmiyor; kargonun faturada nasıl göründüğünü göremiyoruz.
- **Karar:** Meslek kararı. Bizde hem ayrı satır hem üçüncü firma var. Bu yüzden ayrı %20 (B) temkinli seçim; en kötü ihtimal fazla ödeme. Ürünün oranı (A) m.24/a ile savunulabilir, ama kargo payında eksik beyan riski taşır.
- **Ne değiştireceğiz:**
  - Her durumda atıf m.24/a olarak düzeltilir (B1 PR'ı ve uygulama sözleşme eşitlemesi).
  - Mali müşavir B'yi seçerse `kdv-shipping-own-line` PR'ı: KDV dökümünde kargo ayrı %20 satır olur; metinler ve panel notu buna göre değişir.
  - Hangisi seçilirse seçilsin fatura, KDV dökümü ve metin aynı şeyi söylemeli. Metin "ürünün oranı" derken faturaya ayrı %20'lik bir "kargo hizmeti" satırı yazılmamalı.
- **Mali müşavire soru:** Kargo bedelini (100 TL, 400 TL üstü ücretsiz; taşıma Geliver üzerinden üçüncü firma) e-Arşiv faturada nasıl göstermeliyiz? A: KDV K. m.24/a'ya göre malın matrahına dâhil ve malın oranında (ürün satırlarına paylaştırılmış ya da oran başına 'Teslim (kargo) bedeli' satırı). B: ayrı 'kargo hizmeti' satırı %20 (özelge 32391). Hangisini seçiyorsunuz? Not: mal %1/%10 iken kargo firmasının %20 KDV'si devreden KDV biriktirir; 2026 için 164.000 TL üstü iade edilebilir.

#### Y2-3 Tek fiyatla satılan karışık hediye setleri

- **Kanun:**
  - Farklı oranlı işlemler birlikte yapılınca her birinin bedeli ayrıştırılıp kendi oranıyla vergilendirilir; ayrıştırılamıyorsa gruptaki en yüksek oran uygulanır (GUT III/B-1.3).
  - Özelge 32094 (İstanbul VDB, 2024): sakız ile oyuncak arabanın tek fiyatla satıldığı kutu %20.
  - Özelge 32968 (İstanbul VDB, 2011): farklı oranlı mallardan oluşan paket en yüksek oranlı kalemin oranını alır.
  - Porselen hiçbir listede değil, %20.
- **Bugün:**
  - Affogato Seti (200 g Sirena, fior di latte gelato, iki yenilebilir kup, porselen kaşık; tek fiyat 780 TL) %20. Yenilebilir Kup kutusu kendi oranıyla %1.
  - Panel ipucu "Kahve ve fincan bir aradaysa %20 güvenli seçim" diyor (settings-form.tsx:282). Hukuk metinleri ise "gıda içeren hediye kutu ve setlerinde oran içindeki ürünlere göre" diyor (content.ts:268, 882).
  - Sistem bir seti bileşenlerine bölemiyor.
- **Karar:** Değişmeli (metin).
- **Ne değiştireceğiz:**
  - Set tek fiyatla satıldıkça %20 kalır. Gıda kısmı ancak faturada her bileşenin fiyatı ayrı gösterilirse kendi oranını alabilir. Sistemde bileşen satırı olmadığı için bu şimdi yapılmasın.
  - Metindeki set kuralı silinir (`legal-kdv-rule-wording`), panel ipucu B1'de düzelir.
  - Yenilebilir Kup Y2-1 kararını izler.
- **Mali müşavire soru:** Ürün ürün oran listemizi onaylar mısınız: Affogato Seti (kahve, gelato, yenilebilir kup, porselen kaşık, tek fiyat) %20 (GUT III/B-1.3); Yenilebilir Kup kutusu gıda oranı (Y2-1 kararına göre %1 veya %10); Pamuk Önlük %10 (II sayılı liste 5. sıra, GTİP 62.11?); Moka, Porselen Fincan Seti, Bambu Chasen, Emaye Bardak %20. Her ürün için dayandığınız GTİP'i ve onay tarihini yazar mısınız?

#### Y2-4 Hukuk metnindeki "ürüne göre %1, %10 veya %20" ifadesi; Şikâyet §11'in yeni cümlesi

- **Kanun:**
  - Ön bilgilendirmede tüm vergiler dahil toplam fiyat ve teslim masrafı yazılır; oranın kendisini yazmak zorunlu değil (MSY m.5/1-d).
  - Oranı satıcı değil Cumhurbaşkanı belirler (KDV K. m.28).
  - Vergi, mal kargoya verilince ya da daha önce fatura düzenlenince doğar ve o andaki oran uygulanır (KDV K. m.2/1, m.10/a, b, e). İadede ilk teslimdeki oran kullanılır (GUT III/B-1.2.3).
  - Tekstil kumaşları, giyim eşyası ve her türlü çanta (II) sayılı listede, %10 (4, 5 ve 8. sıralar; özelgeler 38916, 32621, 32298).
- **Bugün:**
  - Kategori-oran listesi on yerde geçiyor: content.ts:268, 284, 882, 903, 3418, 3446, 3836, 12751, 12919, 13323.
  - Liste şimdiden yanlış: tekstil marka ürünü %10 olmalı (canlı Pamuk Önlük %20'de satılıyor); tek fiyatlı karışık set en yüksek oranı alır; Y2-1 %10 çıkarsa "%1 paketli gıda" da yanlış olur.
  - İki onay belgesi oran değişikliği konusunda çelişiyor: ÖBF "sipariş tarihinde yürürlükte olan oran" diyor (268), MSS "güncel oran uygulanır ve Site üzerinde gösterilir" diyor (882).
  - Panelin vergi alanları 0-100 arası her tam sayıyı kabul ediyor.
  - Şikâyet §11 (content.ts:13850) doğru: fiyatlar KDV dahil ve oran toplamı değiştirmiyor. Asıl yanlış olan, oranı toplamın girdisi gibi yazan eski metindi.
- **Karar:** Değişmeli. Fiyatlar KDV dahil olduğu için kimse yanlış toplam ödemiyor. Kusur sözleşmedeki yanlış ifade; avukat yine de düzeltmeli.
- **Ne değiştireceğiz:**
  - `legal-kdv-rule-wording`: liste yerine şu kural yazılır: "Uygulanan KDV oranı, yürürlükteki vergi mevzuatına göre her ürünün ve hizmetin tabi olduğu orandır." ve "Her kalemin KDV oranı ve tutarı faturada gösterilir."
  - İki belgeye aynı cümle girer: "Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez." Bu bir ticari taahhüt: sipariş ile kargo arasında oran artarsa farkı satıcı üstlenir. Faturada kargoya verme günündeki oran kullanılır.
  - Şikâyet §11 değişmez.
  - Paneldeki serbest sayı alanını ürün formundaki gibi açılır listeye çevirmek isteğe bağlı bir yazım hatası koruması; kanun gereği değil.
- **Avukata ve mali müşavire soru:** Sözleşmelerdeki '%1, %10 veya %20' listesini 'her ürünün yürürlükteki mevzuata göre tabi olduğu oran, faturada kalem kalem gösterilir' kuralıyla değiştiriyoruz ve 'Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez.' cümlesini ekliyoruz (sipariş ile kargoya verme arasında oran artarsa farkı satıcı üstlenir; faturada kargoya verme günündeki oran kullanılır, KDV K. m.10). Avukat: bu taahhüt uygun mu? Mali müşavir: faturada bu şekilde uygulanabilir mi?

#### Y2-5 Canlıya çıkmadan önce Hediye kategorisindeki her ürünün oranı tek tek kontrol edilsin

- **Kanun:**
  - Tek fiyatlı ve ayrıştırılamayan farklı oranlı kalemler en yüksek oranı alır (GUT III/B-1.3).
  - Fasıl 09 ve 17-21 gıdası mal olarak %1. Tekstil giyim ve çanta %10. Mutfak ekipmanı, porselen, emaye veya çelik bardak ve bambu çırpıcı hiçbir listede değil, %20 ((I) ve (II) sayılı listeler).
  - Yeme-içme işletmesinin sattığı gıda %10 olabilir (GUT III/B-2.4.1, bkz. Y2-1).
  - Özelge 32621 (Bursa VDB, 2014): tişört ve mesleki kıyafet dahil tekstil giyim (II) sayılı listenin 5. sırasında.
- **Bugün (canlı API, 11 ürün):**
  - Hediye: Yenilebilir Kup %1 (kendi oranı), Affogato Seti %20.
  - Kahve: Sirena, Notturna %1.
  - Kiler: Uji Matcha, Cantucci %1.
  - Ekipman: Moka, Porselen Fincan Seti, Bambu Chasen %20.
  - Marka ürünü: Pamuk Önlük (kalın kanvas) %20, Emaye Bardak %20.

  Oranları kimin, hangi tarihte onayladığı hiçbir depoda kayıtlı değil.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:** OP-KDV-PRODUCT-REVIEW: yalnız Hediye değil, tüm aktif ürünler mali müşavirle gözden geçirilir. Oran, dayanılan GTİP, tarih ve onaylayan kişi LEGAL-REDLINES §16.3'e yazılır.
  - Beklenen sonuç: Affogato Seti %20.
  - Yenilebilir Kup, kahve ve kiler Y2-1'deki karara göre.
  - Pamuk Önlük kendi oranıyla %10; ileride eklenecek tişört ve çanta da öyle.
  - Emaye Bardak ve ekipman %20.

  Kaydettikten sonra API'nin her ürün için anlaşılan oranı döndürdüğü kontrol edilir. Panel ve sihirbaz ipuçları B1 PR'ında düzelir.
- **Mali müşavire soru:** ASK-Y2-3-5 (yukarıda, Y2-3).

### C. fA'L yapay zekâ yorumu ve yurt dışına aktarım

#### FAL-1 fA'L metinlerinin ve açık rıza sürümünün (2026-10-17-anthropic) avukat incelemesi

- **Kanun:**
  - Açık rıza; belirli bir konuya ilişkin, bilgilendirilmeye dayanan ve özgür iradeyle açıklanan rızadır (KVKK m.3/1-a).
  - Rıza, fotoğrafın işlenmesi için m.5 şartı olabilir. Ama yeterlilik kararı yoksa sürekli bir yurt dışı aktarım için ayrıca m.9/4 güvencesi gerekir. Rıza tek başına yalnız arızi aktarımı taşır (m.9/6-a). Her yorum isteğinde tekrarlanan aktarım arızi değildir (Yurt Dışına Aktarım Yönetmeliği, RG 10.07.2024, m.16/1).
  - Aydınlatmanın asgari içeriği m.10/1'de.
  - Kurul İlke Kararı 2026/347 (RG 24.03.2026): rızaya dayanan işlemede aydınlatma ile açık rıza ayrı başlıklarda, ayrı beyanlarla verilir. Aydınlatma için "okudum ve kabul ediyorum" denmez, "okudum, anladım" denir. Başka bir işleme şartı varken rıza metni sunulmaz. Metin genel, eksik, yanıltıcı ya da yanlış olamaz.
  - Kurum'un 2026 ceza tablosu: aydınlatma ihlali 85.437 - 1.709.200 TL (m.18/1-a); m.12 kapsamında veri güvenliği ihlali 256.357 - 17.092.242 TL (m.18/1-b).
  - Anthropic'in yayımlanmış politikası: ticari API girdileri ve çıktıları 30 gün içinde silinir. Kural ihlali şüphesiyle işaretlenen içerik 2 yıla, sınıflandırma puanları 7 yıla kadar saklanır. Ticari şartlara göre müşteri içeriğiyle model eğitilmez.
- **Bugün:**
  - Açık Rıza Metni R12 (content.ts:6705-6721) Anthropic, PBC'yi (ABD) veri işleyen olarak adlandırıyor. Gönderilen ve gönderilmeyen veriyi, fotoğrafın şirkette saklanmadığını, reddin hizmeti etkilemediğini ve 90 günlük kullanım kaydını yazıyor. KVKK Aydınlatma §9, §12, §15 ve Gizlilik §8 bununla uyumlu.
  - Canlı sayfa Anthropic yazıyor, OpenAI geçmiyor.
  - Rıza sürümü `fal-core.ts:92`'de. Eski sürüm 409 `consent_outdated` ile reddediliyor. Yorum için doğrulanmış e-posta gerekiyor.
  - Özellik üretimde kapalı (bootstrap `app.fal.ai=false`).
  - Uygulama metinleri Anthropic yazıyor. Ama onay ekranında (fal-consent-sheet.tsx:92-120) bilgilendirme ile rıza tek başlık altında, KVKK Aydınlatma bağlantısı yok ve ret düğmesi ikincil stilde.

  Bulunan boşluklar:
  1. KVKK Aydınlatma §8 (5916) aktarımı rızaya dayandırıyor; §15 (6112) ve R12 (6712) ise standart sözleşmeye. Bu bir çelişki ve aynı cümle uygulamanın çevrimdışı kopyasında da var.
  2. Sağlayıcının saklama süresi muğlak yazılmış (6709); oysa Anthropic süreleri yayımlıyor.
  3. KVKK Aydınlatma §14 alıcı tablosunda yapay zekâ sağlayıcısı satırı yok (açık madde Y1-6).
  4. Yönetmeliğin adı yanlış yazılmış (5610, 6114).
  5. Onay ekranı 2026/347'ye göre ayrılmamış.
  6. R12'deki 90 günlük silme yalnız `RETENTION_APPLY=destroy` ile çalışıyor (src/lib/retention.ts:228-232). Varsayılan davranış yalnız rapor.
  7. R12 standart sözleşmenin "akdedilen" yani imzalanmış olduğunu söylüyor; henüz imzalı değil.

  Yerinde olanlar: rıza hizmetin şartı değil; tek bir özelliğe özel ve sürümlü; kullanım anında soruluyor; aynı ekrandan geri alınabiliyor; model kişileri tanımlamaması için yönlendiriliyor.
- **Karar:** Değişmeli.
- **Ne değiştireceğiz:**
  - S4 PR'ında yönetmelik adı düzelir.
  - `fal-r12-anthropic-retention` PR'ı:
    - 8. madde cümlesi şuna döner: fotoğrafın işlenmesi açık rızanıza, yurt dışına aktarılması standart sözleşmeye dayanır.
    - R12'ye Anthropic'in saklama süreleri ve eğitim yasağı yazılır.
    - R12'ye "Bu sözleşme imzalanıp Kurum'a bildirilmeden fotoğrafınız yapay zekâ hizmetine gönderilmez." eklenir.
    - §14 tablosuna Anthropic satırı eklenir.
    - Rıza sürümü yayın gününe ilerler. Uygulama sürüm değerini olduğu gibi geri gönderdiği için bu v1'i bozmaz.
    - Testler ve API-MOBILE.md örnekleri güncellenir.
  - Uygulama PR'ı (`app-fal-consent-and-seed`), onay ekranı:
    - "Bilgilendirme" başlığı altında dört satır ve "KVKK Aydınlatma Metni" bağlantısı.
    - "Açık rıza" başlığı altında "Fotoğrafımın yapay zekâ yorumu için işlenmesine ve bu amaçla Anthropic'e (ABD) aktarılmasına açık rıza veriyorum." cümlesi ve R12 bağlantısı.
    - Eşit ağırlıkta iki düğme: "Açık rıza veriyorum" ve "Vermiyorum, cihazımda oku".
  - Operatör: OP-RETENTION-APPLY, OP-APP-BUILDS.
- **Avukata soru:** fA'L metinleri (açık rıza sürümü 2026-10-17-anthropic) için: (a) isteğe bağlı, ücretsiz bir eğlence özelliğinde fotoğrafın işlenmesini açık rızaya dayandırmayı (m.5/2-c yerine) uygun buluyor musunuz (Kurul 2026/347)? (b) Önceki alıcı OpenAI, L.L.C. için metne bir not gerekir mi? (c) Onay kaydına uygulama sürümünü eklemeli miyiz (R12 §20 maddesi değişir)? (d) Fotoğrafta üçüncü kişi olmaması için yalnız uyarı yeterli mi? (e) Onay ekranında ayrıca 'Okudum, anladım' dokunuşu ister misiniz? Ayrıca R12'ye eklediğimiz Anthropic saklama süreleri ve 'sözleşme imzalanıp bildirilmeden fotoğraf gönderilmez' cümlesini onaylar mısınız?

#### FAL-2 Anthropic ile KVKK m.9 standart sözleşmesi

- **Kanun:**
  - Yurt dışına aktarım, m.5/m.6 şartı ve Kurul'un yeterlilik kararıyla yapılır (KVKK m.9/1; 7499 s. Kanunla değişik, 1.6.2024'ten beri).
  - Yeterlilik kararı yoksa üçü birlikte gerekir: m.5/m.6 şartı, ilgili kişinin hak arayabilmesi ve taraflarca sağlanan bir uygun güvence. (c) bendindeki güvence, Kurul'un ilan ettiği standart sözleşmedir (m.9/4).
  - İstisnalara ancak güvence de sağlanamıyorsa ve aktarım arızi ise başvurulur (m.9/6; Yönetmelik m.6/2, m.16).
  - Standart sözleşme değiştirilmeden kullanılır, Türkçe metin esastır ve taraflarca ya da yetkilileri tarafından imzalanır (Yönetmelik m.14/2-4).
  - Veri sorumlusundan veri işleyene aktarım için "Standart Sözleşme 2" kullanılır (Kurul 2024/959). Bu sözleşmede ekleme ya da çıkarma yapılmaz (Madde 2); alt işleyenler Ek III'e yazılır (Madde 8); Türk hukuku ve Türk mahkemeleri geçerlidir (Madde 17-18).
  - Kurum duyurusu (05.02.2025): geçerli imza şart; Türkçe sütun imzalanır; geriye yürüyen yürürlük tarihi olmaz.
  - İmza el yazısıyla ya da güvenli elektronik imzayla atılır (TBK m.15/1).
  - ABD için yeterlilik kararı yok (Kurum'un yurt dışına aktarım sayfası).
  - Anthropic'in veri işleme eki AB standart sözleşmelerini içeriyor ama KVKK sözleşmesi içermiyor. §I.4'te uluslararası aktarım uyumu için "makul destek" taahhüdü var.
- **Bugün:** İki depoda da imzalı sözleşme ya da yazışma yok (LEGAL-REDLINES Y1-1 ve §15.5 adım 2 açık). Özellik `FAL_AI_ENABLED=true` olmadan, açıklanan sağlayıcı ve anahtar olmadan açılamıyor (fal-core.ts:132-136, fal.ts:315-322). Üretimde kapalı.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:**
  - OP-SS2-ANTHROPIC ve OP-FAL-OFF.
  - Anthropic değiştirilmemiş Türkçe metni imzalamazsa özellik kapalı kalır. Bağlayıcı şirket kuralları yalnız şirketler grubu içindir; taahhütname aktarımdan önce Kurul izni ister (Yönetmelik m.15/3); aktarım arızi olmadığı için R12 rızası da kullanılamaz.
  - Anthropic'in ticari şartları ve veri işleme eki veri işleyen sözleşmesi olarak kalır (KVKK m.12/2). Müşteri içeriğiyle model eğitimine izin veren hiçbir programa katılma.
- **Avukata soru:** Standart Sözleşme 2'yi yabancı sağlayıcılar (Anthropic, Neon, Supabase, Vercel, Resend, Google) DocuSign gibi basit elektronik imzayla imzalamak isterse TBK m.15/1 ve Kurum'un 05.02.2025 duyurusu karşısında geçerli olur mu, ıslak imza veya güvenli elektronik imza mı şart? Bir sağlayıcı değiştirilmemiş Türkçe metni imzalamazsa (ör. Claude'u, sağlayıcının veri işleyen olduğu bir bulut platformu üzerinden kullanmak) hangi yolu önerirsiniz?

#### FAL-3 İmzadan sonra 5 iş günü içinde Kurul'a bildirim

- **Kanun:**
  - Standart sözleşme imzadan sonra 5 iş günü içinde Kurum'a bildirilir (KVKK m.9/5).
  - Süre imzaların tamamlanmasından itibaren 5 iş günü. Bildirim fiziki, KEP ya da Kurul'un belirlediği yolla yapılır. Taraflar kimin bildireceğini kararlaştırabilir; kararlaştırmazlarsa veri aktaran bildirir (Yönetmelik m.14/5).
  - Yetki belgeleri ve yabancı belgelerin noter onaylı tercümesi eklenir (m.14/6). Değişiklik ve fesih de bildirilir (m.14/8).
  - Standart Sözleşme Bildirim Modülü standartsozlesme.kvkk.gov.tr'de (Kurum duyurusu 25.10.2024).
  - Bildirmemenin cezası 2026 için 90.308 - 1.806.177 TL (m.18/1-d).
- **Bugün:** Sözleşme olmadığı için bildirim de yok. Şirketin KEP adresi yok (entity.ts:123); bildirim modülden ya da kâğıtla yapılır.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:**
  - OP-SS2-NOTIFY. Sözleşmenin 16. maddesinde bildiren taraf olarak "Veri aktaran" seçilir.
  - Kanun aktarımın imzayla başlamasına izin veriyor. Biz şirket politikası olarak bildirim makbuzu alınmadan özelliği açmıyoruz.
  - İsteğe bağlı: şirkete KEP adresi al.
- **Soru:** İmza şekli için ASK-FAL-2 (yukarıda).

#### FAL-4 Sohbete yapıştırılan Anthropic API anahtarının yenilenmesi

- **Kanun:**
  - Veri sorumlusu hukuka aykırı erişimi önlemek için her türlü teknik ve idari tedbiri alır ve veri işleyenle birlikte sorumludur (KVKK m.12/1-2).
  - Veri başkalarınca ele geçirilirse en kısa sürede bildirilir; Kurul'a göre bu süre 72 saat. Her olay kayıt altına alınır (m.12/5, Kurul 2019/10).
- **Bugün:** İki depoda ve git geçmişinde anahtar izi yok; laffogato'da .env.local yok. Kod yalnız Messages API'yi kullanıyor ve bu API geçmiş istekleri geri vermiyor. Özellik kapalı; hiçbir üye fotoğrafı gönderilmedi.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:** OP-FAL-KEY, bugün:
  1. Eski anahtarı iptal et.
  2. Yalnız fA'L için kullanılan bir çalışma alanında, aylık harcama sınırı olan yeni bir anahtar oluştur.
  3. Yeni anahtarı yalnız Vercel'e gir: `ANTHROPIC_API_KEY`, "Sensitive", yalnız Production.
  4. Kullanılmıyorsa `OPENAI_API_KEY`'i sil ve yeniden yayımla.
  5. Eski anahtarın yapıştırma ile iptal arasındaki kullanımını kontrol et (Files ve Batches API dahil).

  Kişisel veri açığa çıkmış görünmüyor; Kurul bildirimi büyük olasılıkla gerekmez. Yine de değerlendirmeyi yazılı olarak sakla.
- **Soru:** Yok.

#### O-4 Yurt dışına aktarım: üye ve sipariş verisi Neon, Supabase, Vercel ve Resend'de. Standart sözleşmeler ve bildirimler tamam mı?

- **Kanun:**
  - FAL-2 ve FAL-3'teki kurallar aynen geçerli (KVKK m.9/1, 9/4, 9/5, 9/6-7; Yönetmelik m.4/1-e, 6/2, 14, 16).
  - Kurum rehberine göre yurt dışından uzaktan erişim (yalnız ekranda görmek bile) ve yurt dışındaki bulutta saklama aktarımdır (Rehber s.16).
  - Süregelen bir ilişkide düzenli yapılan, olağan iş akışındaki aktarım istisnalardan yararlanamaz (Rehber s.66).
  - Kurul 2026/347: metin genel, eksik ya da yanlış olamaz; başka bir şart varken rıza metni sunulmaz.
- **Bugün:**
  - KVKK Aydınlatma §15 (content.ts:6115) "standart sözleşme imzalanır ve Kurum'a bildirilir" diyor; oysa imzalı sözleşme yok.
  - 6122 olası tüm yöntemleri sayıyor. Gizlilik §9 (5245), özel şirketin kullanamayacağı "uluslararası sözleşme"yi de sayıyor.
  - Açık Rıza R6 (6648) "onay vermezseniz veri yurt dışına aktarılmaz ve hizmet yurt içi imkânlarla yürütülür" diyor. Yurt içi bir seçenek yok; bu cümle doğru değil.
  - Altyapının tamamı yurt dışında: Vercel fra1 (vercel.json:3), Resend İrlanda, canlı veritabanı Neon (entity.ts:55), kimlik Supabase (entity.ts:66).
  - Metinde yalnız Vercel ve Resend'in konumu yazıyor. Neon'un ABD'de, Supabase'in Singapur'da olduğu bilgisi listeden geliyor; depoda doğrulanamıyor.
  - Bu aktarımlar şu an her sayfa açılışında, girişte, siparişte ve e-postada oluyor ve süreklidir. Ne R6 rızası ne de "sözleşmenin ifası" istisnası bunları taşıyabilir.
- **Karar:** Operatör işi. Site canlı olduğu için öncelikli.
- **Ne değiştireceğiz:**
  - OP-SS2-PROVIDERS (Google dahil), OP-SS2-NOTIFY, OP-REGIONS.
  - Metin iki adımda değişir. `legal-kvkk-transfer-texts-truthful` bugün doğru olmayanları düzeltir: R6'daki yurt içi cümlesi, "uluslararası sözleşme", sağlayıcı adları ve İYS aydınlatmasındaki rıza cümlesi. `legal-kvkk-transfer-mechanism-named` ise sözleşmeler imzalanınca her alıcıyı ülkesiyle ve kullanılan tek yöntemle yazar.
  - Ara dönemde 6115 için avukatın seçeceği cümle kullanılır.
  - Bir sağlayıcı imzalamazsa rızaya dayanmak yerine o katman başka bir sağlayıcıya taşınır; veri katmanı sağlayıcıdan bağımsız.
- **Avukata soru:** Site canlı ve tüm altyapı yurt dışında, ancak standart sözleşmeler henüz imzalı değil. Sözleşmeler imzalanana kadar KVKK Aydınlatma §15'te şu ara cümleyi kullanalım mı: 'Bu sağlayıcılarla Kurul tarafından ilan edilen standart sözleşmelerin imzalanması süreci yürütülmektedir; imzalanan her sözleşme beş iş günü içinde Kurum'a bildirilir.' Açık Rıza Metni R6 (yurt dışına aktarım rızası) hiç kalmalı mı, yoksa kaldıralım mı (Kurul 2026/347: başka şart varken rıza metni sunulmaz)?

#### O-4.1 Neon (PostgreSQL veritabanı, listeye göre ABD)

- **Kanun:** KVKK m.9/4-c; Rehber s.16, s.66; Yönetmelik m.14/3-6; Standart Sözleşme 2 Ek I-III.
- **Bugün:** Tüm iş verisi Neon'da: üyeler, adresler, siparişler, onaylar, sadakat, karaoke ve fA'L kullanım kayıtları (entity.ts:55; docs/DATABASE.md:3-11). Metin `{{DB_PROVIDER}}` diyor ama konum yazmıyor (content.ts:6120). Sözleşme yok. Supabase'e taşıma yapılırsa veritabanı sözleşmesi de Supabase'e geçer.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:**
  - Neon konsolundan bölgeyi, veri işleme ekinden de sözleşen şirketi oku (OP-REGIONS).
  - Neon'dan Standart Sözleşme 2 iste. Ek I: yukarıdaki tüm müşteri veri kategorileri; amaç "veri tabanı barındırma ve yedekleme"; sürekli aktarım; saklama Saklama ve İmha Politikası'na göre. Ek III: Neon'un alt işleyenleri.
  - Neon reddederse veritabanını sözleşmeyi imzalayan bir sağlayıcıya ya da bölgeye, veya Türkiye'de barındırılan bir Postgres'e taşı. `dbProvider` ve `DATABASE_URL` birlikte değişir.
- **Soru:** ASK-FAL-2 ve ASK-O-4 (yukarıda).

#### O-4.2 Supabase (üyelik kimlik doğrulaması, listeye göre Singapur)

- **Kanun:** KVKK m.9/4-c; Rehber s.16, s.66; Standart Sözleşme 2 Madde 8 ve Ek III.
- **Bugün:**
  - Supabase Auth şunları tutuyor: e-posta, parola özeti, ad, telefon (uygulama kayıtları), şartların ve ileti onayının zaman damgaları, oturum anahtarları ve IP'li giriş kayıtları (content.ts:6078-6080). Satırın başlığı sağlayıcıyı adlandırmıyor.
  - R6 `{{AUTH_PROVIDER}}` = "Supabase" diyor (6653). §15'teki konum listesi ise yalnız "kimlik doğrulama hizmeti sağlayıcısı" diyor.
  - Proje bölgesi depoda doğrulanmamış. SUPABASE-GECIS.md'deki bağlantı testleri bölgeyi kanıtlamıyor.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:**
  - Supabase panelinden (Project Settings) bölgeyi, veri işleme ekinden sözleşen şirketi teyit et.
  - Standart Sözleşme 2 iste. Ek I: kimlik ve hesap verisi, IP'li giriş kayıtları; amaç "site ve uygulamada ortak üyelik girişi"; sürekli aktarım.
  - S4'te §14 başlığı "Üyelik kimlik doğrulama hizmeti sağlayıcısı ({{AUTH_PROVIDER}})" olur. S4b'de sağlayıcı ülkesiyle yazılır.
  - Supabase reddederse kimlik sağlayıcısını değiştirmek mobil sözleşmeye (Bearer Supabase JWT) dokunur. Bu hızlı bir değişim değil, v2 planı ister.
- **Soru:** ASK-FAL-2 ve ASK-O-4.

#### O-4.3 Vercel (barındırma, sunucu işlevleri Frankfurt)

- **Kanun:** KVKK m.9/4-c; Yönetmelik m.4/1-e; Rehber s.16, s.66.
- **Bugün:**
  - Tüm istekler, IP kayıtları ve sunucu işlevleri Vercel'de. İşlevler fra1'de (vercel.json:3) ve metin Almanya diyor (content.ts:6113, 6120).
  - Kart verisi PayNkolay'a giderken Vercel sunucusunun belleğinden geçiyor (6116).
  - Türkiye'nin Almanya için de yeterlilik kararı yok. Sözleşen taraf Vercel Inc. (ABD; veri işleme ekinden teyit edilmeli). Yani aktarım Almanya'ya, destek erişimi ve kayıtlar için de ABD'ye yapılıyor.
  - Sözleşme yok.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:**
  - Vercel Inc.'ten Standart Sözleşme 2 iste. Ek I: istek verisi, IP ve kayıtlar; geçen hesap ve sipariş verisi; geçen ama saklanmayan kart verisi; amaç "barındırma ve dağıtım"; sürekli aktarım. Ek III: bulut ve CDN alt işleyenleri.
  - S4'te metindeki ad "Vercel Inc." olur.
- **Soru:** ASK-FAL-2 ve ASK-O-4.

#### O-4.4 Resend (işlemsel ve izinli ticari e-posta, İrlanda)

- **Kanun:** KVKK m.9/4-c; Rehber s.16, s.66.
- **Bugün:** Her e-posta Resend'den çıkıyor ve ad, e-posta, sipariş satırları, teslimat adresi, kupon kodları ve karaoke ayrıntıları taşıyor (Gizlilik §8, content.ts:5185-5187). Bölge eu-west-1 (EMAIL-RESEND.md:35); metin İrlanda diyor. Sözleşme yok.
- **Karar:** Operatör işi.
- **Ne değiştireceğiz:** Resend'in sözleşen şirketinden Standart Sözleşme 2 iste. Ek I: alıcı kimlik ve iletişim verisi, ileti içeriği, geri dönme ve şikâyet sinyalleri; amaç "işlemsel ve izinli ticari e-posta gönderimi"; sürekli aktarım. Ek III: gönderim altyapısı.
- **Soru:** ASK-FAL-2 ve ASK-O-4.

#### KVKK-VERBIS (listede yok, kapsam kontrolü): VERBİS kaydı gerekiyor mu, m.9 yükümlülüklerini değiştirir mi?

- **Kanun:**
  - Veri sorumluları, Kurul muaf tutmadıkça VERBİS'e kaydolur. Kayıtta yurt dışına aktarılacak veriler de beyan edilir (KVKK m.16/2-3).
  - Kurul 2018/87 (2023/1154 ve 2025/1572 ile değişik, RG 01.10.2025): yıllık çalışan sayısı 50'den az, yıllık bilanço toplamı 100 milyon TL'den az ve ana faaliyeti özel nitelikli veri işlemek olmayanlar muaf.
  - İmha politikası yalnız kayıt yükümlüsü için zorunlu; diğerleri de veriyi siler (Silme Yönetmeliği m.5/1, 5/3, 11/2-3).
  - VERBİS bilgisi standart sözleşmeye yalnız kayıt yükümlülüğü varsa yazılır (Rehber s.57).
- **Bugün:** Gizlilik §1 (content.ts:4802) kriterlerin düzenli değerlendirildiğini ve gerekirse kayıt yapılacağını söylüyor. Şirket 25.06.2026'da kurulmuş; çalışan sayısı ve bilanço toplamı depoda yok. Ana faaliyet özel nitelikli veri işlemek değil. Buna rağmen şirket altı aylık periyodik imha vaat eden bir politika yayımlamış ve bu vaadi tutmalı (OP-RETENTION-APPLY).
- **Karar:** Meslek kararı.
- **Ne değiştireceğiz:** Mali müşavir rakamları teyit eder. İkisi de eşiğin altındaysa şirket muaftır ve her sözleşmenin Ek I'indeki VERBİS kısmı boş kalır. Muafiyet m.9 sözleşme ve 5 iş günlük bildirim yükümlülüklerini kaldırmaz. Gizlilik §1 olduğu gibi kalır.
- **Mali müşavire soru:** ASK-VERBIS (yukarıda, Y3-7).

### D. Menü fotoğrafları ve ödeme sayfası

#### OTH-1 Menüdeki stok fotoğraflar için "Görseller temsilidir" notu yeterli mi? (#124)

- **Kanun:**
  - Mal satmak için yapılan her yazılı ya da görsel pazarlama iletişimi ticari reklamdır. Doğru ve dürüst olmalı, aldatmamalı; iddiayı reklam veren ispat eder (TKHK m.61/1-3, m.61/6).
  - Aldatıcı ticari uygulama yasaktır; ispat tacirdedir (TKHK m.62).
  - Satıcının internet sayfasında ya da reklamında gösterilen özelliği taşımayan mal ayıplıdır (TKHK m.8/2); not ne derse desin.
  - Reklam; malın yapısı, bileşimi, miktarı ya da diğer özellikleri hakkında yanıltan bir ifade veya görsel içeremez (Ticari Reklam Yönetmeliği m.7/1, m.7/5-a).
  - Dipnot ana mesajı açıklayabilir ama tamamen ya da büyük ölçüde ortadan kaldıramaz. Görsel ile yazı çelişemez; dipnot okunur boyutta olmalı (m.18/5-7, m.19/5).
  - Ortalama tüketiciyi malın içeriği hakkında yanıltan uygulama aldatıcıdır (m.29/1, m.29/2-a).
  - Uygulamadan verilen tek seferlik gel-al ve kurye kafe siparişleri mesafeli sözleşmedir (MSY m.5/1-a, m.2/2-ğ).
  - Masadaki karekodla açılan sayfa masa fiyat listesidir (Fiyat Etiketi Yönetmeliği m.8/2).
- **Bugün:**
  - Sitede not tek bir yerde, menü ızgarasının ve ana sayfa şeridinin altında duruyor ve yalnız ekranda fotoğraf varken görünüyor (menu-photo-note.tsx:2; menu-page.tsx:289; home-page.tsx:468). Yazı boyutu 12.5px.
  - 75 stok fotoğraf var. Fotoğrafları kalemlerin metniyle karşılaştırdık; yedisinin içeriği tutmuyor:
    - mnu-0074 Rosbeef Sandviç: yeşillik ve sos yok, çiğ soğan var.
    - mnu-0059 Yaban Mersinli San Sebastian: yanık bask değil, bisküvi tabanlı tart.
    - mnu-0067 Klasik Spoonful: kuruyemiş ve granola var, ama kalemde kuruyemiş etiketi yok.
    - mnu-0028 Buzlu Balkabağı Latte: fotoğrafın adı "Iced Mocha".
    - mnu-0056 Şeftalili Soğuk Çay: şeftali yok, nane var.
    - mnu-0063 Çilek Magnolia: bisküvi kırığı yok.
    - mnu-0073 Karabuğday Simit: klasik beyaz susamlı simit.
  - mnu-0082 Alternatif Süt kenevir sütü ve kenevir tohumu gösteriyor. mnu-0018 ve mnu-0027'de yalnız sunum farkı var.
  - Uygulama aynı fotoğrafları gösteriyor ve bu kalemleri satıyor, ama menüde ve kalem ekranında hiç not yok.
- **Karar:** Değişmeli.
- **Ne değiştireceğiz:**
  - Sitedeki not olduğu gibi kalır; bardak, süsleme, ışık gibi sunum farkları için yeterli.
  - Yedi fotoğrafı bugün panelden kaldır (OP-MENU-PHOTOS); yerlerinde çizim tabak görünür.
  - Aynı yedisi yedek veride de boşaltılır ve fotoğraf kuralı MENU-PHOTOS.md'ye yazılır (`menu-photos-mismatch`). mnu-0082 kırpılır ya da değiştirilir.
  - Uygulamaya "Görseller temsilidir" notu eklenir (`app-menu-photo-note`).
  - Sonra stok fotoğraflar, barın gerçekten sunduğu ürünlerin fotoğraflarıyla değiştirilir.
- **Avukata soru:** Menüde 'Görseller temsilidir' notu yalnız sunum farkları (bardak, süsleme, ışık) için yeterli mi? İçeriği tutmayan yedi fotoğrafı kaldırdık (liste raporda). Kalan stok fotoğraflar ve ileride yapay zekâ ile üretilmiş bir görsel çıkarsa Reklam Yön. m.18/8 kapsamında etiket gerekir mi?

#### OTH-2 Sadeleştirilen ödeme sayfası (#126): başka zorunlu bilgi eksik mi?

- **Kanun:**
  - Sözleşmeden önce verilecek bilgiler MSY m.5/1'in (a)-(k) bentlerinde sayılı. (g) bendindeki iade için satıcının belirlediği taşıyıcı ve (k) bendindeki tüketici mahkemesinden önce arabulucu şartı 1.1.2026'dan beri yürürlükte.
  - Bilgiler en az 12 punto, açık ve okunur verilir (m.6/1).
  - İnternette şu dört kalem, ödeme yükümlülüğü altına girilmeden hemen önce bir bütün olarak ve ayrıca gösterilir: (a) temel nitelikler, (d) vergiler ve teslim dahil toplam, (g) cayma şartları, süresi, yöntemi ve iade taşıyıcısı, (h) istisnalar. Teslimat kısıtı ve ödeme araçları en geç siparişten önce söylenir (m.6/2-a, b).
  - Ön bilgilendirme teyit edilmezse sözleşme kurulmaz (m.7/1). Siparişin ödeme yükümlülüğü doğurduğu söylenmezse tüketici siparişle bağlı olmaz (m.8/1; TKHK m.48/2).
  - Sözleşme şartları ve toplam, ödeme bilgisi girilmeden önce görünür olmalı. Düzeltme araçları bulunmalı. Şartlar sonradan tekrar görülebilir, yazdırılabilir ve saklanabilir şekilde verilmeli. Sipariş sitede ve en az bir kanalla daha teyit edilmeli (6563 s. Kanun m.3/1-c, 3/4, 4/1-a, 4/2; Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik (RG 29.12.2022) m.8/1-b, ç, d, m.9/1).
  - Kalıcı veri saklayıcısı, bilginin değiştirilmeden erişilebilmesini sağlar (MSY m.4/1-c).
  - İade taşıyıcısı ön bilgilendirmede adlandırılmamışsa tüketiciden iadeye ilişkin hiçbir masraf istenemez (m.12/5).
  - Malı geri gönderme süresi cayma bildiriminden itibaren 14 gün (m.13/1, 1.1.2026'dan beri).
  - Tüketici mahkemesinden önce arabulucuya başvurmak dava şartı (TKHK m.73/A/1).
- **Bugün:** Yerinde olanlar:
  - Tam unvan ve MERSİS içeren satıcı satırı.
  - KDV ve kargo dahil toplam ve kabul edilen kart logoları.
  - İki ayrı işaretsiz kutu; MSS kutusu "Siparişimin ödeme yükümlülüğü doğurduğunu kabul ediyorum." cümlesiyle bitiyor.
  - Onay kaydı (zaman, IP, tarayıcı, sürüm) ve "Siparişi onayla ve öde" düğmesi.
  - Özetteki +/-, "Çıkar" ve "Değiştir" araçları.
  - Sitede ve e-postada sipariş teyidi.

  Eksikler:
  1. Cayma şartları, süre, yöntem, iade taşıyıcısı ve istisnalar yalnız bağlantının arkasında; ekranda hiçbiri yok (m.6/2-a, g ve h).
  2. 960px altında sipariş satırları varsayılan olarak kapalı (checkout.tsx:637; globals.css:11871-11878). Telefonda ödemeden önce yalnız ürün sayısı ve toplam görünüyor. Oysa ÖBF §5 (content.ts:253) satırların ödeme öncesi özette gösterildiğini söylüyor.
  3. Kart bilgisi, ekranda hiçbir sözleşme şartı görünmeden önce yazılıyor.
  4. Ön bilgilendirme yazıları 12-15px; 16px'in altında.
  5. Satış sonrası tek kopya, canlı /hukuk sayfalarına bağlantı. E-posta bunlara "kalıcı veri saklayıcısı" diyor (send.ts:498-508; odeme-onaylandi.html:63).
  6. Bağlanan ÖBF'nin kendisi (g) ve (k) bentlerinde yanlış. İade için 10 gün yazıyor (content.ts:429, 441). İade taşıyıcısının adı yok, ama başka firma seçilirse fark alıcıya yükleniyor (430). §21'de arabulucu şartı yok (572).

  Uygulamada satırlar, tutar, ödeme yöntemi, sözleşme başına ayrı işaretsiz kutu, satır içi cayma notu ve "Siparişi onayla ve öde · tutar" düğmesi var. Mağaza cayma cümlesinde çabuk bozulan gıda istisnası eksik.
- **Karar:** Değişmeli.
- **Ne değiştireceğiz:**
  - `checkout-inline-preinfo` (ön yüz): kart alanının hemen üstüne, her genişlikte açık duran bir "Siparişin" bloğu eklenir (satırlar, kargo, indirim, KDV dahil toplam). Altına şu not girer: "Kargo siparişlerinde ürünü teslim aldığın günden itibaren 14 gün içinde gerekçe göstermeden cayabilirsin. Bildirimini {e-posta} adresine yazman yeterli. Ürünü bildiriminden sonraki 14 gün içinde, sana e-postayla göndereceğimiz iade koduyla kargoya ver; iade kargo ücreti senden alınmaz. Çabuk bozulabilen gıdalarda (yenilebilir kup, gelato kiti gibi), ambalajı açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde (açılmış kahve paketi, krema, şurup) ve isteğine göre öğütülen ya da kişiye özel hazırlanan ürünlerde cayma hakkı yoktur. Ürün ayıplı, bozuk, eksik veya yanlış gelirse yasal hakların her hâlükârda saklıdır."
  - Aynı PR'da birinci adımdaki "Türkiye geneli" yerine "Yalnız Türkiye içindeki adreslere gönderiyoruz" yazılır. Ön bilgilendirme yazıları en az 16px olur (12 puntonun karşılığı; resmî bir ekran karşılığı yok).
  - `legal-distance-sales-2026`: 14 gün; ücretsiz iade kargosu (ya da OP-RETURN-CARRIER ile adı verilen tek firma); arabulucu cümlesi; teslimat bölgesi.
  - `email-consent-docs-wording` ve `legal-versions-durable-copy`: kalıcı kopya.
  - Uygulama: mağaza cayma cümlesine çabuk bozulan gıda istisnası eklenir (`app-legal-seed-distance-sales`).
- **Avukata soru:** Ödeme sayfasına kart alanının üstüne sipariş satırları, toplam ve kısa cayma notu ekliyoruz (metin raporda). (1) Bu blok ile genel ÖBF bağlantısı MSY m.6/2-a için yeterli mi, yoksa ÖBF sepet ve adresle doldurulmuş olarak mı açılmalı? (2) Ekranda ön bilgilendirme metnini 16px yapıyoruz (12 punto); uygun mu? (3) ÖBF §13'teki 'ticari değerini yitirmeden ve yeniden satılabilirliğini engellemeyecek şekilde' şartını MSY m.13/2'ye göre değiştirdik; yeni cümleyi onaylıyor musunuz? (4) İade taşıyıcısı adı vermediğimiz için iade kargo bedelini hiç istemiyoruz (m.12/5); onaylıyor musunuz?

## 3. Listede olmayan ama yol üstünde bulduğumuz konular

Her birinde kısaca kanun, durum ve ne yapacağımız var. Kimlikler `changes.json` ile aynı.

**Karaoke ve kafe**

- **X-KAR-REQMODE Talep modunda ön bilgilendirme yok.**
  - Ön ödeme kapalıyken ya da eski bir uygulama sürümünden gelen rezervasyon da mesafeli sözleşmedir (TKHK m.48/1, MSY m.4/1-e). Ama web formu ön bilgilendirmeyi ve iki sözleşme kutusunu yalnız ön ödeme açıkken gösteriyor (karaoke-booking.tsx:565, 624).
  - Bilgi tekliften önce verilmeli; teyit yoksa sözleşme kurulmamış sayılır (MSY m.5/1, m.7/1). Risk daha çok köşkün: para alınmıyor, ama misafiri hiçbir şart bağlamıyor.
  - Yapacağımız: ön ödemeyi açık tut, eski sürümleri asgari sürüm ayarıyla kes (OP-KARAOKE-PREPAY). Talep modu kalacaksa `karaoke-request-mode-preinfo`. Orta güven.
- **X-KAR-ACCEPT Kafe §1 "işletmede hizmet alınması Koşulların kabulü sayılır" diyor** (content.ts:14142).
  - Genel işlem şartı ancak açık bildirim ve okuma imkânı tanındıktan sonra bağlar (TBK m.21/1). Bilinemeyen şartları geri dönülmez biçimde kabul ettirmek haksız şart örneğidir (Haksız Şartlar Yön. EK (ğ)).
  - S1'de cümle şöyle olur: "Bu Koşulları işletme girişinde ve {{SITE_URL}}/hukuk/kafe-hizmet-kosullari adresinde inceleyebilirsiniz." Girişe ve menüye not konur (OP-CAFE-TERMS-NOTICE).
- **X-KAR-RETENTION Üyeliksiz misafirin rezervasyon verisi için saklama süresi yok** (Veri Saklama, content.ts:7851).
  - Veri yalnız amacın gerektirdiği süre tutulur ve sebep bitince silinir (KVKK m.4/2-d, m.7/1). Bu, VERBİS'ten bağımsız bir yükümlülük.
  - Öneri: rezervasyon tarihinden 3 yıl sonra ad, telefon ve e-posta anonimleşir; ödeme ve fatura kaydı vergi süresince kalır. Avukat ve mali müşavir onaylayınca `karaoke-guest-retention`.
- **X-LEGAL-VERSIONS Hukuk metinlerinin sürümleri saklanmıyor.**
  - Panelden yapılan değişiklik tek kaydın üzerine yazılıyor (src/lib/legal/store.ts). Denetim kaydı yalnız `{published}` bilgisini tutuyor (admin/hukuk/actions.ts:48-54). Onay kaydı yalnız sürüm adını tutuyor.
  - Ön bilgilendirmeyi ispat yükü satıcıda (MSY m.5/6) ve kayıt 3 yıl saklanır (m.20/1). Çözüm `legal-versions-durable-copy`.
- **X-CARD-TEXT Kart saklama vaadi.**
  - Yaklaşık 20 yerde "kart saklama özelliği açıldığında" diye başlayan cümleler var (ör. content.ts:315, 322, 376, 967, 3762, 3851, 3936, 4428, 4547, 5273-5275, 5834, 7309, 7883-7885, 10473, 10880, 11745, 11799). Oysa operatör kart saklamayı açmama kararı verdi (CLAUDE.md kural 28). Eksik veya yanıltıcı bilgi yasak (Aydınlatma Tebliği m.5/1-j).
  - Kodda pasif bir kayıtlı kart yolu ve şemada `customers."cardUserKey"` kolonu duruyor. Geliştirici önce bu kolonun hiç doldurulmadığını teyit etmeli.
  - Güvenimiz orta-düşük olduğu için PR'a koymadık, avukata soruyoruz (ASK-CARD-TEXT).
- **X-KAR-DATA Kafe §5 veri paragrafı telefonun her zaman istendiğini söylüyor**, ama uygulamadaki üye rezervasyonu telefon göndermiyor (karaoke-core.ts:151-156). S1'de cümle şöyle olur: "Rezervasyon sırasında ad-soyad ve elektronik posta adresi, internet sitesinden yapılan rezervasyonlarda ayrıca cep telefonu istenir." (Aydınlatma Tebliği m.5/1-j).
- **X-EVENT-PROOF Etkinlik kaydının delili.** Kafe §6 (14277), cayma istisnası bildiriminin ve misafir onayının yazılı ya da e-postayla kaydedildiğini söylüyor; ama kodda etkinlik kaydı yok. Bu e-posta yazışmalarını 3 yıl sakla (MSY m.20/1, m.5/6; OP-EVENT-RECORDS).
- **X-KAR-KDV Geç iptal veya gelmeme sonrası tutulan karaoke bedeli ve tam iadedeki düzeltme belgesi** (content-karaoke.ts:128; KDV K. m.35). Bu konuda bir GİB özelgesi doğrulayamadık; düşük güven. ASK-KAR-KDV.
- **X-KAR-RESALE Geç iptal edilen saatin yeniden satılması.**
  - Bugün köşk bedelin %100'ünü tutuyor ve saati yeniden satabiliyor (content-karaoke.ts:13-19 bunu "karar verilmedi" diye kaydediyor).
  - İkisini birden tutmak, Haksız Şartlar EK (ç), (d) ve TBK m.182/3'ün hedeflediği dengesizlik. Rezervasyon oda kirası sayılırsa, kiraya verenin yeniden kiralamadan elde ettiği bedeli mahsup etmesi kıyasen gündeme gelir (TBK m.325).
  - Sözleşme türüne avukat karar verir (ASK-OTH-3).

**KDV ve fatura**

- **X-INV-EARSIV Fatura iletim yöntemi yanlış yazılmış.**
  - Şirket Bilgileri §14 "Fatura örneği talebi üzerine" diyor (content.ts:13318-13319).
  - Fatura alıcıya verilen belgedir (VUK m.229) ve teslimden itibaren 7 gün içinde düzenlenir (m.231/5). Kargoyla satışta teslim, malın taşıyıcıya verilmesidir (KDV K. m.2/1, m.10/e).
  - VUK Genel Tebliği 509 IV.2.4.3 (Tebliğ 589 ile değişik, 31.12.2025'ten beri): 1.1.2026'dan itibaren e-Arşiv'de olmayan bilanço esasına tabi mükellef (Ltd. Şti. dahil) her faturayı, tutarı ne olursa olsun, GİB portalından e-Arşiv olarak düzenler. Kâğıt fatura VUK m.353 cezası doğurur.
  - İnternet satışında e-Arşiv fatura elektronik olarak gönderilir. Üzerinde "Bu satış internet üzerinden yapılmıştır." ibaresi, site adresi, ödeme şekli ve tarihi, taşıyıcı bilgisi, gönderim tarihi ve iade bölümü bulunur (509 IV.2.4.5).
  - Depoda fatura entegrasyonu yok. Önce OP-EARSIV, sonra `legal-invoice-e-arsiv`.
- **X-INV-IRSALIYE Koli belgesi.**
  - Satıcının taşıttığı malla birlikte sevk irsaliyesi bulunur (VUK m.230/5). e-Arşiv kullanan internet satıcısı bunun yerine e-İrsaliye çıktısı, irsaliye yerine geçen e-Arşiv fatura çıktısı ya da ÖKC fatura bilgi fişi kullanabilir (509 IV.2.4.5).
  - Paneldeki basılı "Sipariş Fişi" bunların hiçbiri değil. Her Geliver kolisine hangi belgenin gireceğini mali müşavir belirlesin (OP-EARSIV, ASK-INVOICE).
- **X-INV-CORP Kurumsal fatura bilgisi.**
  - Metin unvan, vergi dairesi ve VKN'nin sipariş öncesinde girilmesini istiyor (content.ts:13292), ama ödeme formunda bu alanlar yok (src/app/odeme/actions.ts).
  - İki seçenek: ya isteğe bağlı alanlar eklenir (arka yüz ve form, ayrı PR), ya da cümle "sipariş verildikten sonra ve kargodan önce e-postayla" olarak değişir (`legal-invoice-e-arsiv`, ASK-INVOICE).
- **X-EFATURA e-Fatura eşiği.**
  - Kendi sitesinden satış yapan ve şirketin tüm faaliyetlerinden elde ettiği brüt satış 2022 ya da sonraki bir yılda 500.000 TL'ye ulaşan mükellef, izleyen yılın yedinci ayı başına kadar e-Fatura'ya geçer (509 IV.1.4(a)(4), IV.1.5(c)). 2026 eşiği aşarsa son tarih 1.7.2027.
  - Genel eşik 3 milyon TL. Takibi mali müşavir yapsın (ASK-INVOICE).
- **X-KDV-CITE Yanlış bent harfi.** kdv.ts:24 ve 247, docs/API-MOBILE.md:606 ve LEGAL-REDLINES:1126 ve 1168 kargo için "m.24/b" diyor; doğrusu m.24/a. Düzeltme `admin-kdv-hints-and-citation` ve uygulama sözleşme eşitlemesiyle yapılır.
- **X-KDV-TEXTILE Tekstil marka ürünü sistemde de yanlış oranda.**
  - Marka varsayılanı (kdv.ts:70) ve ipucu önlük, çanta ve tişörtü %20 sayıyor; canlı Pamuk Önlük %20. Oysa (II) sayılı listenin 5. ve 8. sıralarına göre oran %10.
  - Fazla gösterilen KDV yine ödenir ve ancak alıcıya iade edilirse geri alınır (KDV K. m.8/2).
  - Bu ürünlere kendi %10 oranları verilir; marka varsayılanı fincan ve bardak için %20 kalır (OP-KDV-PRODUCT-REVIEW).
- **X-KDV-RATECHANGE Oran değişikliği cümlesi.**
  - İki onay belgesi çelişiyor. Yasal oran, vergiyi doğuran olay anındaki orandır: kargoya verme, ya da daha önce düzenlenmişse fatura (KDV K. m.2/1, m.10).
  - Sipariş satırı oranı sipariş anında damgalıyor (store.ts:2642, 3593). Bir kararname ödeme ile kargo arasında oranı değiştirirse e-Arşiv fatura kargo günündeki oranı kullanmalı; saklanan oran yalnız bilgi amaçlı kalır.
  - Y2-4 metni bunu düzeltiyor.
- **X-FIS Basılı Sipariş Fişi** (order-detail.tsx:739-760, 860-868) "İçindeki KDV %x (matrah ...)" basıyor. Bu bir VUK belgesi değil ama koliye girebilir. Fatura ya da irsaliyeyle karışmaması için altına "Bu fiş mali belge değildir. Faturan e-Arşiv olarak e-postana gönderilir." yazılması mali müşavirin takdirinde (ASK-INVOICE).
- **X-KDV-KARAOKE Karaoke odası %20.**
  - GİB uygulamasıyla yalnız kıyasen uyumlu; karaoke hakkında özelge bulamadık. (II) sayılı listenin 24. sırası bar, dans salonu, diskotek gibi yerleri dışarıda tutuyor. GİB kafeterya içindeki oyun ya da bilardo salonunu genel oranda sayıyor (özelge 33087, 32291).
  - Değişiklik yok. Oda fiyatına yiyecek-içecek eklenirse faturada ayrılır (GUT III/B-1.3).
- **X-VD-REG Faaliyet kaydı.**
  - Vergi levhasındaki ana faaliyet yazılım (entity.ts:25-27; yalnız iç kayıt, kural 14).
  - %1 ile %10 arasındaki karar işyerinin ruhsatına, servis alanına ve e-yoklama işyeri türüne bağlı. Kafe ve online perakende faaliyetleri ile varsa ayrı sevk yeri Tuzla VD'ye bildirilmiş olmalı. Faaliyet ve işyeri değişiklikleri bir ay içinde bildirilir (VUK m.158, 159, 168/1). OP-VD-REGISTRATION.
- **X-APP-BRANCH Uygulamanın çevrimdışı hukuk kopyası.**
  - Gerçek main doğru KDV metnini taşıyor. Ama yerel lafmobil klonu `feat/saved-cards-copy` dalında ve işlenmemiş bir legal.seed.json içeriyor. Bu dosya hâlâ "fiziksel ürünlerde güncel oran %20" ve "kargo hizmet bedelinde KDV %20" diyor; fal.ts de hâlâ OpenAI yazıyor.
  - Bu daldan derleme alma (OP-APP-BUILDS).
- **X-KDV-COUPON Kupon ve bedava ürün** (düşük güven).
  - İskonto ancak aynı faturada gösterilir ve ticari teamüle uygunsa matraha girmez (KDV K. m.25/a; GUT III/A-6.1).
  - Kupon bir ürünü tamamen karşılıyorsa faturada ürün kendi fiyatıyla, kupon da o satırda iskonto olarak görünmeli. Aksi hâlde bedava ürün, vergiye tabi olmayan amaçla mal çekişi gibi okunabilir (KDV K. m.3/a). ASK-COUPON.

**KVKK**

- **X-GMAIL Karaoke bildirimleri kişisel bir Gmail kutusuna gidiyor** (store.ts:700; content.ts:6083-6085). Misafirlerin ad, e-posta, telefon ve notları, veri işleyen sözleşmesi ve m.9 güvencesi olmadan Google'da duruyor (KVKK m.9/4, m.12/2). OP-KARAOKE-MAILBOX.
- **X-GTM Google Tag Manager her sayfada, rıza seçiminden önce IP ve tarayıcı verisini Google'a gönderiyor** (content.ts:6088-6090; dayanak m.5/2-f). Bu da güvence gerektiren sürekli bir yurt dışı aktarım, ama O-4 listesinde Google yok. OP-SS2-PROVIDERS'a eklendi.
- **X-REG-CONSENT Site kayıt formu "Kullanım Şartları ve Gizlilik Politikası'nı (KVKK aydınlatma metni dahil) okudum, kabul ediyorum." diyor** (register-form.tsx:93-104).
  - 2026/347, aydınlatma için "okudum ve kabul ediyorum" ifadesini açıkça hukuka aykırı sayıyor.
  - Uygulamanın kayıt ekranı düzeltilmiş. Giriş ekranının alt yazısı ("Devam ederek Gizlilik ve Kullanım Koşulları'nı kabul etmiş olursun.") düzeltilmemiş.
  - Düzeltme `register-consent-and-footer-company-link` ve `app-auth-footer-privacy-wording` ile yapılır; `acceptedTerms` alan adı aynı kalır.
- **X-RETENTION-APPLY Periyodik imha yalnız rapor üretiyor.** `RETENTION_APPLY=destroy` yoksa fA'L kayıtları 90 günde silinmiyor ve politikadaki altı aylık imha yapılmıyor (Silme Yönetmeliği m.11/2; KVKK m.7). OP-RETENTION-APPLY.
- **X-VSIP-PROCESSORS Veri Saklama ve İmha Politikası §14** (content.ts:8112) veri işleyenleri sayarken Anthropic'i, Google'ı ve kimlik sağlayıcısının adını atlıyor. Kesin bir zorunluluk değil, ama aydınlatmayla uyumlu olmalı. S4.
- **X-GUVENCE "Güvence yöntemleri" maddeleri** (content.ts:6122, Gizlilik 5245) kullanılan yöntemi değil, olası tüm yöntemleri sayıyor. 2026/347 genel ve muğlak ifadeyi hukuka aykırı sayıyor. Sözleşmeler imzalanınca her alıcı için kullanılan yöntem yazılır (S4b).
- **X-LOYALTY Sadakat programı.**
  - Kurul İlke Kararı 2026/266 (RG 28.02.2026), kasada telefon ya da kart numarasıyla üyeye işlem yazılırken doğrulama istiyor. Uyum süresi 2026/1491 ile 28.02.2027'ye uzadı.
  - Bizde kasada elle e-posta yazarak (admin/kasa/actions.ts:22, 121-126) ve müşteri sayfasından (musteriler/[email]/actions.ts:32) üye onayı olmadan damga eklenebiliyor.
  - Elle yazılan e-postanın kapsamda olup olmadığına avukat karar versin. Kapsamdaysa 28.02.2027'den önce bir onay adımı eklenir (ASK-LOYALTY).
  - Not: 2026/1491'i okuduk, 2026/266'nın kendi metnini okumadık.
- **X-IYS-9514 Ticari Elektronik İleti ve İYS Aydınlatması** (content.ts:9514) aktarımı "öngörülen hukuki mekanizmalara ve gerekli hâllerde açık rızanıza" dayandırıyor (açık madde Y1-10). S4'te standart sözleşmeye, rıza da yalnız arızi hâle bağlanır.

**Tüketici ve e-ticaret**

- **X-MEDIATION Arabulucu şartı.** MSY m.5/1-k (1.1.2026'dan beri), ön bilgilendirmede tüketici mahkemesine ancak arabulucuya başvurduktan sonra gidilebileceğinin yazılmasını istiyor (TKHK m.73/A/1). ÖBF §21 (572) ve MSS §19 (1166-1170) bunu yazmıyor. S3.
- **X-RETURN-14 Malı geri gönderme süresi 14 gün** (MSY m.13/1, 1.1.2026'dan beri). Metinler 10 gün diyor: content.ts:429, 441, 1044, 1422, 1746, 2389, 2397; uygulama kopyasında da aynı. Kanundan kısa süre hükümsüzdür ve (g) bendindeki bilgiyi yanlış anlatıyor. S3.
- **X-RETURN-CARRIER İade taşıyıcısı.** Ön bilgilendirme iade taşıyıcısını adlandırmalı; adlandırmıyorsa iade masrafı istenemez (MSY m.5/1-g, m.12/5). ÖBF §13 (430) ve İade metni (1488-1489) firmayı sonradan bildiriyor ve başka firma seçenden farkı alıyor. S3 (OP-RETURN-CARRIER).
- **X-RETURN-USE "Ticari değerini yitirmeden" şartı.** ÖBF §13 (429) iadeyi kutunun ve aksesuarların da gönderilmesine ve "yeniden satılabilirliğini engellemeyecek şekilde" iadeye bağlıyor. Tüketici, malın işleyişine uygun kullanımdan doğan değişiklikten sorumlu değil; satıcı yalnız amacına aykırı kullanımdan doğan değer kaybını isteyebilir (MSY m.13/2, TKHK m.48/4). S3, avukat teyit eder. Orta güven.
- **X-ETHS-TITLE Yürürlükten kalkmış yönetmelik adı.** Metinler 32 yerde (uygulama kopyasında 18 yerde) eski "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik"e atıf yapıyor. Bu yönetmelik, RG 29.12.2022-32058 yönetmeliğinin 34. maddesiyle yürürlükten kalktı. S3.
- **X-ETHS-ILETISIM İletişim başlığı.**
  - Ana sayfadan doğrudan bir "iletişim" başlığına bağlantı olmalı. Orada ticaret unvanı, MERSİS, merkez adresi, KEP, e-posta, telefon, marka, meslek odası ve odanın davranış kuralları yer alır (ETHS Yön. m.5/1, 6563 m.3/2).
  - Footer'daki İletişim sütunu yalnız adres, telefon, e-posta ve saatleri gösteriyor (chrome.tsx:1061-1080). Şirket bilgileri sayfasında oda yok, KEP boş.
  - Yapılacaklar: footer'a "Şirket bilgileri" bağlantısı (ön yüz PR'ı), sayfaya oda satırları (S7), KEP ve oda bilgisi (OP-KEP-CHAMBER).
- **X-ETHS-ISLEM İşlem rehberi.** Ana sayfadan "işlem rehberi" başlığına doğrudan bağlantı olmalı (ETHS Yön. m.7/1); böyle bir sayfa yok. İçerik ÖBF §9 ve §22'de duruyor; `/hukuk/islem-rehberi` olarak yayımlanır ve footer'a eklenir (S7).
- **X-PDP-FACTS Ürün sayfasında kategoriye göre sabit yazılan özellikler** (product-detail.tsx:415-430, ui.tsx:750-768).
  - Canlı örnekler: Notturna (Kenya AA Nyeri) "Köken: Brezilya doğal + Etiyopya yıkanmış" satırını ve Sirena'nın tadım notlarını alıyor. Bambu Chasen ve Porselen Fincan Seti "Marka: Bialetti × L'Affogato" ve "Garanti: 2 yıl" satırlarını alıyor. Gelato içeren Affogato Seti "Saklama: Kuru, serin · 90 gün" satırını alıyor.
  - Bunlar yanlış ya da doğrulanmamış temel nitelikler (MSY m.5/1-a; Reklam Yön. m.7/5-a, m.29/2-a; TKHK m.8/2). "Garanti: 2 yıl" ise dayanaksız bir garanti vaadi.
  - Satırlar `pdp-remove-hardcoded-facts` ile hemen kalkar; sonra ürün alanlarından beslenir.
- **X-TGK-SHOP Paketli gıda etiket bilgisi.**
  - Mesafeli satışta, tarih hariç tüm zorunlu etiket bilgileri satın almadan önce, hepsi de teslimde verilmeli: ad, içindekiler, Ek-1 alerjenleri, miktar, net miktar, saklama koşulu, işletmeci, işletme kayıt no, menşe, besin bildirimi (TGK Etiketleme Yönetmeliği m.17/2-a, b; m.9/1).
  - Ürün modelinde yalnız açıklama, boş `weightGrams` ve tek bir alerjen etiketi var. ÖBF §5 (258-259) ise bunları ürün sayfasında vaat ediyor.
  - Çözüm `shop-food-label-fields`, `pdp-label-and-discount-display` ve `app-shop-label-fields`.
- **X-TGK-MENU Kafe alerjenleri.**
  - Toplu tüketim yerinde paketsiz gıdanın adı ve Ek-1 alerjenleri menüde, panoda ya da benzer bir yerde yazılır (TGK m.15/5; mevcut işletmeler için 31.12.2019'dan beri). Uzaktan satışta bu bilgi satın almadan önce verilir (m.17/3).
  - Site menüsünde yalnız genel bir çapraz temas bandı var. Uygulamada yalnız "kuruyemiş" etiketi ve "Alerjenler için baristaya danış." cümlesi var.
  - Sitenin kendi Gıda Güvenliği belgesi bağlayıcı listenin menü kartında ve uygulamanın kalem ekranında olduğunu söylüyor (content.ts:14966), ama böyle bir liste yok.
  - Çözüm `menu-allergens-per-item`, `menu-allergens-and-price-date-display` ve `app-menu-allergens`. Köşkte basılı liste (OP-ALLERGEN-BOARD).
- **X-PRICE-LIST Masa fiyat listesinin tarihi.**
  - Masa karekodu /masa sayfasını açıyor; yani bu sayfa fiyat listesi. Listede fiyatların yürürlüğe girdiği tarih bulunmalı (Fiyat Etiketi Yön. m.5/2-d, m.8, m.9/4), ama tarih yok.
  - Çözüm `menu-price-list-date` ve ön yüzde "Fiyatlarımıza KDV dahildir · Fiyatların geçerlilik tarihi: <gün ay yıl>" notu. Köşkte basılı listeler; servis veya masa ücreti alınmaz (OP-PRICE-LISTS).
- **X-DISCOUNT İndirim gösterimi.**
  - İndirim reklamında indirimden önceki fiyat ile indirimin başlangıç ve bitiş tarihi yazılır. İndirim öncesi fiyat, son 10 gündeki en düşük fiyattır (Ticari Reklam Yön. m.14/1, m.14/3, 1.8.2026'dan beri; Fiyat Etiketi Yön. m.11/1, ispat satıcıda).
  - Bambu Chasen 750 TL; üstü çizili 999 TL ve "%25 indirim" rozetiyle, tarihsiz gösteriliyor. Üstü çizili fiyat panelde serbestçe yazılabiliyor.
  - OP-COMPARE-AT bugün; sonra `shop-discount-price-history`.
- **X-TERRITORY Teslimat bölgesi çelişkisi.**
  - ÖBF §8, Satış Politikası ve ödeme sayfası yalnız Türkiye diyor. Teslimat ve Kargo, MSS ve Satış Politikası ise KKTC ve yurt dışı için teslim süreleri ve gümrük kuralları veriyor.
  - Teslimat kısıtı siparişten önce açıkça yazılmalı (MSY m.6/2-b). S3'te tüm metinler yalnız Türkiye'ye göre hizalanır.
- **X-OBF-FLOW ÖBF §1'deki akış cümlesi.** Metin "bu formu onaylamadığı sürece ödeme adımına geçilemez" diyor (content.ts:80). Oysa tek sayfalık ödemede kart bilgisi onaydan önce yazılıyor; kilitli olan yalnız düğme. S3'te cümle "ALICI bu formu onaylamadıkça sipariş verilemez ve ödeme alınmaz." olur. Hukuki ağırlığı düşük.
- **X-AI-IMAGES Yapay zekâ ile üretilmiş görsel.**
  - Reklamda yapay zekâ tüketicinin ekonomik davranışını önemli ölçüde etkileyecek şekilde kullanılıyorsa bu açıkça belirtilir (Ticari Reklam Yön. m.18/8, 1.8.2026'dan beri).
  - 22 rawpixel ve 9 StockSnap kaynak sayfası bot kontrolü yüzünden açılamamış. Bunları tarayıcıda açıp kontrol et (OP-MENU-PHOTOS).
  - Bir menü fotoğrafının bu eşiğe ulaşması düşük ihtimal.

## 4. PR planı

Her hukuk metni PR'ı için kurallar:

- PR taslak olarak açılır. Avukatın (gerekiyorsa mali müşavirin de) onayı alınmadan ve CI yeşil olmadan birleşmez.
- Sürüm tarihleri:
  - ÖBF veya MSS değişirse `LEGAL_UPDATED` (meta.ts:24) yayın gününe ilerler ve onay sürümü onunla birlikte değişir.
  - Karaoke sözleşmesi değişirse `KARAOKE_LEGAL_UPDATED` (meta.ts:68) ilerler.
  - Diğer belgeler kendi `updatedAt` tarihini alır ve `tests/legal-dates.test.ts`'e eklenir.
  - `LEGAL_UPDATED` ilerlerse, kendi tarihi bundan eski kalacak belgeler kendi tarihini bırakır.
  - ÖBF ve MSS'ye dokunan PR'lar (`legal-kdv-rule-wording`, `legal-distance-sales-2026`, `legal-invoice-e-arsiv`) aynı hafta hazır olursa tek tarihle çıkar.
- Eski ve yeni cümleler docs/LEGAL-REDLINES-2026-09.md'ye yazılır.
- PR birleşince laffogato'da `npm run legal:export -- ../lafmobil/src/data/legal.seed.json` çalıştırılır ve sonuç ayrı bir lafmobil PR'ı olur. Bu PR'ın dalı lafmobil'in gerçek main'inden açılır, `feat/saved-cards-copy`'den değil.
- docs/API-MOBILE.md'ye dokunan her PR için, belgeyi bayt bayt lafmobil'e kopyalayan ve `RECONCILED` hash'ini güncelleyen bir uygulama PR'ı gerekir.
- Ön yüz PR'larında `git diff --stat origin/main -- src/lib src/app/api db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'` boş dönmeli.

**Önerilen sıra**

| Sıra | Site PR'ı | Maddeler | Onay | Uygulama PR'ı |
| --- | --- | --- | --- | --- |
| 1 | `legal-distance-sales-2026`: 14 gün, ücretsiz iade kargosu, arabulucu, yeni e-ticaret yönetmeliği adı, yalnız Türkiye | OTH-2 ve ekleri | Avukat | `app-legal-seed-distance-sales` (çabuk bozulan gıda istisnası dahil) |
| 2 | `checkout-inline-preinfo` (ön yüz): kart alanı üstünde özet ve cayma notu, 16px | OTH-2 | Avukat (metin) | - |
| 3 | `email-consent-docs-wording`: "kalıcı veri saklayıcısı" iddiası kalkar | OTH-2 | - | - |
| 4 | `menu-photos-mismatch` (ön yüz) | OTH-1 | - | `app-menu-photo-note` |
| 5 | `pdp-remove-hardcoded-facts` (ön yüz) | X-PDP-FACTS | - | - |
| 6 | `legal-kvkk-transfer-texts-truthful` | O-4, FAL-1, Y3-7 | Avukat | `app-legal-seed-kvkk-transfer` |
| 7 | `register-consent-and-footer-company-link` (ön yüz) | X-REG-CONSENT, X-ETHS-ILETISIM | - | `app-auth-footer-privacy-wording` |
| 8 | `admin-kdv-hints-and-citation` | Y2-1, Y2-2, Y2-3, Y2-5 | Mali müşavir | `app-contract-sync-kdv-citation` |
| 9 | `legal-karaoke-cafe-single-source` | Y3-2, Y3-3, Y3-6, OTH-3 | Avukat | `app-legal-seed-karaoke-cafe` |
| 10 | `karaoke-business-cancel-notice` | OTH-3 | - | - |
| 11 | `legal-kdv-rule-wording` | Y2-3, Y2-4 | Avukat + mali müşavir | `app-legal-seed-kdv-wording` |
| 12 | `fal-r12-anthropic-retention` (fA'L açılmadan önce) | FAL-1 | Avukat | `app-fal-consent-and-seed` |
| 13 | `legal-versions-durable-copy` | OTH-3, OTH-2 | Avukat | - |
| 14 | `menu-allergens-per-item`, `menu-price-list-date`, sonra `menu-allergens-and-price-date-display` | X-TGK-MENU, X-PRICE-LIST | - | `app-menu-allergens` |
| 15 | `shop-food-label-fields`, `shop-discount-price-history`, sonra `pdp-label-and-discount-display` | X-TGK-SHOP, X-DISCOUNT | - | `app-shop-label-fields`, `app-shop-discount-dates` |
| 16 | `legal-eticaret-islem-rehberi-and-chamber` | X-ETHS-ISLEM, X-ETHS-ILETISIM | Avukat | `app-legal-seed-islem-rehberi` |

**Koşula bağlı PR'lar**

- `legal-invoice-e-arsiv`: e-Arşiv gerçekten çalışınca (OP-EARSIV). Uygulama: `app-legal-seed-invoice`.
- `legal-kvkk-transfer-mechanism-named`: ülkeler okununca ve sözleşmeler imzalanıp bildirilince. Uygulama: `app-legal-seed-kvkk-mechanism`.
- `kdv-shipping-own-line`: yalnız mali müşavir kargoda ayrı %20'yi seçerse. Uygulama: `app-kdv-shipping-own-line`.
- `karaoke-guest-retention`: saklama süresi onaylanınca. Uygulama: `app-legal-seed-retention`.
- `karaoke-request-mode-preinfo`: talep modu kalacaksa.
- `karaoke-cancel-policy-snapshot`, `legal-karaoke-cancel-policy-parametric`, `karaoke-cancel-policy-display`: panel ayarı yapılacaksa. Uygulama: `app-karaoke-reservation-rules`, `app-legal-seed-karaoke-parametric`.

## 5. Senin yapacakların (operatör işleri)

| Kimlik | İş | Son tarih |
| --- | --- | --- |
| OP-FAL-KEY | Anthropic anahtarını iptal et, yenisini yalnız Vercel'e gir, eski anahtarın kullanımını kontrol edip değerlendirmeyi yaz (FAL-4) | Bugün |
| OP-COMPARE-AT | Bambu Chasen'in üstü çizili fiyatını, son 10 günde 999 TL'den satılmadıysa sıfırla; diğer ürünleri de kontrol et | Bugün |
| OP-MENU-PHOTOS | Yedi fotoğrafı panelden kaldır; stok kaynaklarını yapay zekâ açısından kontrol et; gerçek fotoğrafları çek | Yedisi bugün, gerçek fotoğraflar 30 Kasım 2026 |
| OP-TILL-KDV | Kasada paket kahve, matcha ve cantucci departmanını %10 yap | Bir sonraki kasa satışından önce |
| OP-EARSIV | e-Arşiv durumunu mali müşavirle teyit et; e-Arşiv'i kur; e-posta gönderimini ve koli belgesini belirle | Hemen (1.1.2026'dan beri zorunlu) |
| OP-KARAOKE-PREPAY | Karaoke ön ödemesini açık tut; talep moduna düşen eski sürümleri kes | Hemen |
| OP-TABLE-BOOKINGS | Eski masa rezervasyonlarını tara, karşıla, sonucu §17'ye yaz (Y3-5) | 20 Ekim 2026 |
| OP-SS2-ANTHROPIC | Anthropic'ten Standart Sözleşme 2 iste (FAL-2) | Talep 24 Ekim 2026'ya kadar |
| OP-REGIONS | Neon, Supabase ve Vercel'in bölgelerini ve sözleşen şirketlerini oku | 24 Ekim 2026 |
| OP-RETENTION-APPLY | Vercel üretimde `RETENTION_APPLY=destroy` var mı bak | 24 Ekim 2026; fA'L açılmadan önce kesin |
| OP-SHOP-KDV-INTERIM | Mali müşavir yazılı %1 onayı verene kadar panelde kahve, kiler ve Yenilebilir Kup'u %10 yap | 24 Ekim 2026 |
| OP-RETURN-CARRIER | Tek bir iade firmasının adı mı verilecek, yoksa iade kargosu hiç istenmeyecek mi, karar ver | `legal-distance-sales-2026`'dan önce (hedef 24 Ekim 2026) |
| OP-PRICE-LISTS | Girişte ve masalarda basılı fiyat listesi olsun, istenirse basılı liste verilsin, servis/masa ücreti alınmasın | Bu hafta |
| OP-ALLERGEN-BOARD | Köşkte basılı menüde ya da panoda kalem başına alerjenleri yaz | Bu hafta |
| OP-SS2-PROVIDERS | Neon, Supabase, Vercel Inc., Resend ve Google'dan Standart Sözleşme 2 iste (O-4) | Hemen başla; talepler 31 Ekim 2026'ya kadar |
| OP-SS2-NOTIFY | Her imzadan sonra 5 iş günü içinde Kurum'a bildir, makbuzu sakla (FAL-3) | Son imzadan sonra 5 iş günü |
| OP-KARAOKE-MAILBOX | Karaoke bildirimlerini Gmail'den işletme e-posta kutusuna taşı | 31 Ekim 2026 |
| OP-KDV-PRODUCT-REVIEW | Tüm ürünleri mali müşavirle gözden geçir, Pamuk Önlük'ü %10 yap, kaydı §16.3'e yaz (Y2-5) | 31 Ekim 2026 (Pamuk Önlük bir sonraki satıştan önce) |
| OP-VD-REGISTRATION | Kafe ve online perakende faaliyetinin Tuzla VD kaydını mali müşavirle teyit et | 31 Ekim 2026 |
| OP-APP-BUILDS | OpenAI metinli bir sürüm üyeye ulaştı mı bak; yerel lafmobil dalını yenile, eski daldan derleme alma | Bir sonraki uygulama derlemesinden önce |
| OP-FAL-OFF | fA'L'ı sözleşme, bildirim makbuzu, metin ve uygulama PR'ları tamamlanana kadar kapalı tut | Sürekli |
| OP-CAFE-TERMS-NOTICE | Girişe ve menüye Kafe Hizmet Koşulları notunu as, kasada basılı kopya tut | S1 yayımlanınca |
| OP-EVENT-RECORDS | Etkinlik kaydı e-postalarını 3 yıl sakla | Şimdiden, sürekli |
| OP-KEP-CHAMBER | Şirkete KEP adresi al; meslek odasını ve davranış kuralları adresini teyit et | 30 Kasım 2026 |
| OP-ACCESS-TABLE | Erişim araması sonrası personelin gerçekte ne yaptığını söyle (Y3-6) | ASK-Y3-6 ile birlikte |
| OP-KARAOKE-CFG-DECISION | Panelden ayarlanabilir karaoke iptal kuralı yapılacak mı, karar ver | Yasal süre yok; 2 saat kuralı değişmeden önce |
| OP-KARAOKE-GOODWILL | İsteğe bağlı: işletme iptalinde ücretsiz yeni saat sunulsun mu, karar ver | İsteğe bağlı |

## 6. Avukata ve mali müşavire gidecek sorular

Yukarıdaki maddelerde tam metniyle geçmeyen sorular aşağıda yazılı. Diğerlerinin tam metni ilgili maddede.

**Avukat:** ASK-Y3-2, ASK-Y3-3, ASK-Y3-4, ASK-Y3-6, ASK-OTH-3, ASK-DURABLE, ASK-FAL-1, ASK-FAL-2, ASK-O-4, ASK-OTH-1, ASK-OTH-2, ASK-LOYALTY, ASK-CARD-TEXT.

**Mali müşavir:** ASK-Y2-1, ASK-Y2-2, ASK-Y2-3-5, ASK-KAR-KDV, ASK-COUPON, ASK-VERBIS.

**İkisi birlikte:** ASK-OTH-3-CFG, ASK-Y2-4, ASK-INVOICE, ASK-RETENTION.

- **ASK-KAR-KDV (mali müşavir):** Karaoke odası online ödenip fatura kesildikten sonra (a) misafir geç iptal eder ya da gelmezse ve bedel iade edilmezse bu gelir nasıl kaydedilir, (b) tam iade yapılırsa hangi düzeltme belgesi düzenlenir? KDV K. m.35'e göre yöntemi yazılı bildirir misiniz? (Tutulan iptal bedeline ilişkin bir GİB özelgesi bulamadık.)
- **ASK-INVOICE (mali müşavir ve avukat):** Mali müşavire: (1) Şirket e-Arşiv'de mi; değilse 1.1.2026'dan beri her fatura GİB portalından e-Arşiv olmalı (VUK GT 509, GT 589), kurulumu kim yapacak? (2) Geliver kolisinde hangi belge gidecek: e-İrsaliye, irsaliye yerine geçen e-Arşiv çıktısı mı, ÖKC fatura bilgi fişi mi? (3) Kurumsal fatura bilgisini ödeme adımında almıyoruz; siparişten sonra kargodan önce e-postayla almak yeterli mi? (4) Paneldeki 'Sipariş Fişi'ne 'Bu fiş mali belge değildir. Faturan e-Arşiv olarak e-postana gönderilir.' yazalım mı? (5) Şirketin tüm faaliyetlerinin brüt satışı 2026'da 500.000 TL'yi aşarsa 1.7.2027'ye kadar e-Fatura'ya geçiş gerekiyor (509 IV.1.4(a)(4)); takibini yapar mısınız? Avukata: Şirket Bilgileri §14 ve MSS §9 fatura cümlelerinin yeni hâli uygun mu?
- **ASK-COUPON (mali müşavir):** Bir kupon bir ürünü tamamen bedava yaptığında (0 TL satır) faturada ürünü kendi fiyatıyla gösterip kuponu o satırda iskonto olarak düşmek gerekir mi (KDV K. m.25/a, m.3/a)? Sepet geneli kodlarda indirimi satırlara orantılı dağıtıyoruz; ürüne özel kuponda indirimi yalnız o satırdan mı düşelim?
- **ASK-RETENTION (avukat ve mali müşavir):** Üye olmadan karaoke rezervasyonu yapanların ad, telefon ve e-postası için saklama süresi tanımlı değil (KVKK m.4/2-d, m.7). Rezervasyon tarihinden 3 yıl sonra (MSY m.20/1 ispat süresi) anonimleştirmeyi, ödeme ve fatura kayıtlarını vergi süresi boyunca saklamayı öneriyoruz. Bu süreleri onaylıyor musunuz?
- **ASK-LOYALTY (avukat):** Kurul İlke Kararı 2026/266 (uyum süresi 28.02.2027'ye uzatıldı, 2026/1491) kasada telefon veya kart numarasıyla sadakat üyesine işlem yazılırken doğrulama istiyor. Bizim kasada QR ve kod dışında elle e-posta yazarak damga eklenebiliyor (admin kasa ve müşteri sayfası). Elle yazılan e-posta bu karar kapsamında mı; öyleyse üyenin QR göstermesi veya uygulamadan onaylaması zorunlu olsun mu?
- **ASK-CARD-TEXT (avukat):** İşletme kart saklamayı açmama kararı verdi (kural 28). Hukuk metinlerinde yaklaşık 20 yerde 'kart saklama özelliği açıldığında' diye başlayan ve kayıtlı kart ile üye anahtarını anlatan cümleler var (ör. ÖBF, MSS, Ödeme Koşulları, Gizlilik, KVKK Aydınlatma, Veri Saklama, Üyelik, Hesap Silme, Mobil Uygulama). Bunları silip yalnız 'Kart bilgileriniz kaydedilmez ve saklanmaz.' bırakmamız uygun mu? (Geliştirici önce veritabanında üye kart anahtarının hiç doldurulmadığını teyit edecek.)

## 7. Okunan birincil kaynaklar

**Tüketici ve sözleşme hukuku**

- 6502 s. TKHK: https://mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=6502&MevzuatTertip=5 ; https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6502.pdf
- 6098 s. TBK: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=6098&MevzuatTertip=5
- Mesafeli Sözleşmeler Yönetmeliği: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=20237&MevzuatTertip=5
- Haksız Şartlar Yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2014/06/20140617-8.htm
- Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=20435&MevzuatTertip=5
- Fiyat Etiketi Yönetmeliği: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=19819&MevzuatTertip=5
- Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=39927&MevzuatTertip=5
- 6563 s. Kanun: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf
- TGK Etiketleme Yönetmeliği: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=23282&MevzuatTertip=5
- 5378 s. Kanun: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=5378&MevzuatTertip=5
- 6701 s. Kanun: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=6701&MevzuatTertip=5

**Vergi**

- 3065 s. KDV Kanunu: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=3065&MevzuatTertip=5
- 213 s. VUK: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=213&MevzuatTertip=4
- GİB güncel KDV oranları: https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv/yardim-merkezi/yararli-bilgiler/kdv-oranlari.pdf
- KDV Genel Uygulama Tebliği (2026): https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=MEVZUAT_TEBLIGLER/UNIVERSAL/2026/kdv_genteb.pdf
- KDV Genel Uygulama Tebliği Seri 51: https://www.resmigazete.gov.tr/eskiler/2024/04/20240427-16.htm
- CBK 7346: https://www.resmigazete.gov.tr/eskiler/2023/07/20230707-11.pdf
- BKK 2007/13033: https://www.resmigazete.gov.tr/eskiler/2007/12/20071230-4.htm
- VUK Genel Tebliği 509: https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=MEVZUAT_TEBLIGLER/UNIVERSAL/2026/MEVZUAT_TEBLIGLER_2026_VukTeb509_Guncel.pdf
- GİB özelgeleri: https://gib.gov.tr/mevzuat/kanun/436/ozelge/32095 ve aynı adreste /32558, /32391, /32094, /32968, /38676, /38916, /32621, /32298, /33087, /32291

**KVKK**

- 6698 s. KVKK: https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6698.doc
- Yurt Dışına Aktarım Yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2024/07/20240710-2.htm
- Kurul 2026/347: https://www.resmigazete.gov.tr/eskiler/2026/03/20260324-3.pdf
- Aydınlatma Tebliği: https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-5.htm
- Silme, Yok Etme veya Anonim Hale Getirme Yönetmeliği: https://www.resmigazete.gov.tr/eskiler/2017/10/20171028-10.htm
- VERBİS muafiyet kararları: https://www.resmigazete.gov.tr/eskiler/2025/10/20251001-4.pdf ; https://www.kvkk.gov.tr/Icerik/7647/2023-1154
- Yurt Dışına Aktarım Rehberi: https://kvkk.gov.tr/SharedFolderServer/CMSFiles/13711235-abb6-4b17-9a6b-0a68c1ad86c5.pdf
- Standart sözleşmeler: https://www.kvkk.gov.tr/Icerik/7929/Standart-Sozlesmeler ; https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/b531d656-9cea-4cdb-84ce-1ab92198c9b1.pdf
- Kurum duyuruları: https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu ; https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu ; https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim
- Kurum ceza tablosu: https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/MTY5NTUyNTRkNDkxNGY.pdf
- Kurul 2019/10: https://www.kvkk.gov.tr/Icerik/6647/The-Board-Decision-No-2019-10-of-24-01-2019-about-Procedures-and-Principles-of-Personal-Data-Breach-Notification-
- Kurul 2026/1491: https://www.resmigazete.gov.tr/eskiler/2026/08/20260813-3.pdf

**Anthropic**

- https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- https://www.anthropic.com/legal/data-processing-addendum
- https://www.anthropic.com/legal/commercial-terms
- https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
