# Mail şablonları

On gönderime hazır e-posta. Tek kolon 598 px, tablo tabanlı, bütün stiller
satır içi. E-posta tarafında JavaScript, harici CSS ve web fontu yok;
`<style>` bloğu yalnızca satır içi stillere ek (mobil kırılma + koyu tema),
tek başına gerekli değil.

Kaynak tasarım: Claude Design handoff (8 Eyl 2026). Düzen, boşluk ve tipografi
ölçeği tasarımdan **birebir** geldi; renk ve yazı tipi `src/app/globals.css`
tokenlarına taşındı — bkz. "Palet".

## Dosyalar

| Dosya                    | Tür               | Konu                                           |
| ------------------------ | ----------------- | ---------------------------------------------- |
| eposta-dogrulama.html    | işlemsel          | L'Affogato — e-posta adresinizi doğrulayın     |
| sifre-sifirlama.html     | işlemsel          | L'Affogato — şifre sıfırlama                   |
| siparis-alindi.html      | işlemsel          | Siparişiniz alındı (#[SIPARIS_NO])             |
| odeme-onaylandi.html     | işlemsel          | Ödemeniz onaylandı (#[SIPARIS_NO])             |
| hos-geldin.html          | ilişki            | L'Affogato'ya hoş geldiniz                     |
| karaoke-rezervasyon.html | işlemsel          | Karaoke rezervasyonunuz onaylandı              |
| sadakat-ikram.html       | işlemsel          | Kartınız doldu — bir içecek bizden             |
| bulten-kampanya.html     | **ticari (6563)** | [KAMPANYA_BASLIK]                              |
| mobil-uygulama.html      | **ticari (6563)** | L'Affogato uygulaması yayında                  |
| dogum-gunu.html          | **ticari (6563)** | Doğum gününüz kutlu olsun, [AD] — kahve bizden |

Ticari üçlü `data-commercial="1"` taşır. `renderEmail` bu üçünü çıkış
bağlantısı olmadan **derlemez**, işlemsel yediye çıkış bağlantısı
**koydurmaz** — ikisi de `tests/email-templates.test.ts`'te kilitli.

## Şablon dili

Üç şey var, fazlası yok (`src/lib/email/fill.ts`):

| Sözdizimi                              | Anlamı                           |
| -------------------------------------- | -------------------------------- |
| `[ALAN]`                               | değer; HTML tarafında kaçışlanır |
| `<!--IF:BAYRAK-->…<!--/IF:BAYRAK-->`   | koşullu bölüm                    |
| `<!--EACH:SATIR-->…<!--/EACH:SATIR-->` | her kalem için tekrarlanan satır |

Bayraklar: `APP_LINKS` (mağaza linkleri tanımlıysa uygulama şeridi durur),
`AD` (ad boşsa selamlama "Merhaba," olur, "Merhaba ," değil).

## Alanlar ve kaynakları

| Alan                                                        | Nereden                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `[AD]`                                                      | çağıranın `name` / `customerName`                            |
| `[DOGRULAMA_URL]` `[SIFIRLAMA_URL]`                         | `src/app/uye/actions.ts`                                     |
| `[SIPARIS_NO]` kalemler `[ARA_TOPLAM]` `[KARGO]` `[TOPLAM]` | `OrderEmailData` · `formatTRYMinor`                          |
| `[SIPARIS_URL]` `[HESAP_URL]` `[MENU_URL]`                  | `SITE.url` + route (`render.ts` → `commonVars`)              |
| `[DAMGA_HEDEFI]`                                            | `settings.mobileApp.loyalty.stampTarget`                     |
| `[ODUL_BASLIGI]`                                            | `currentFreeDrinkReward().title`                             |
| `[KUPON_KODU]` `[SON_KULLANIM]`                             | `CustomerCoupon.code` / `.expiresAt`                         |
| `[KARAOKE_*]`                                               | `KaraokeReservation`                                         |
| `[KAMPANYA_*]` `[URUN_n_*]`                                 | çağıranın kampanya verisi                                    |
| `[ABONELIK_CIKIS_URL]`                                      | `unsubscribeUrlFor(sub.unsubToken)` — `renderEmail` otomatik |
| `[APP_STORE_URL]` `[PLAY_STORE_URL]`                        | `src/lib/mobile/app-store.ts` (env)                          |

## Görseller

Görsel alanları işaretli boş hücreler (600×300 ve 108×108). Gönderimden önce
barındırılan bir `https` görseliyle değiştirin (`alt` metniyle) ya da hücreyi
silin — şablonlar görselsiz de tam okunur. Proje içindeki dosya yolları
alıcıda çalışmaz.

## Palet

Tasarımın kendi kuralı "palet `globals.css` tokenlarından türetilir" idi;
`globals.css` 5 ve 7 Eyl'de değişti, `docs/BRAND.md` de "ikisi çelişirse
globals.css doğrudur" diyor. Şablonlar bu yüzden güncel tokenlara taşındı:

| Rol                  | Token                        | Değer                             |
| -------------------- | ---------------------------- | --------------------------------- |
| Koyu bant / panel    | `--bg-espresso`              | `#143d2b`                         |
| Koyu bant üstü CTA   | `--hero-green`               | `#1e5b3f`                         |
| Beyaz üstü vurgu     | `--green`                    | `#1e7c4b`                         |
| Kart zemini          | `--bg`                       | `#ffffff`                         |
| Footer / liste       | `--bg-warm`                  | `#f6f5f2`                         |
| Görsel alanı         | `--bg-stone`                 | `#f1eee8`                         |
| Metin                | `--ink` / `-soft` / `-mute`  | `#201c17` · `#5f594e` · `#746b5d` |
| Çizgi                | `--ink-line` / `-strong`     | `#ebe7de` · `#e1dcd1`             |
| Altın                | `--gold` / `-deep` / `-soft` | `#8a6526` · `#6b4e1a` · `#e8d3a4` |
| Koyu bant üstü metin | `--green-mist`               | `#cfe3d5`                         |

Yazı: Montserrat yığını (`--sans`). Web fontu Gmail/Outlook'ta yüklenmez,
Helvetica/Arial'a düşer — ağırlık ve harf aralığı ayrımı taşıyor.
`tests/brand-theme.test.ts` bu dosyaları da okuyor: emekli palet geri
gelirse build düşer.

Koyu tema: `color-scheme` meta'sı istemcinin kendi kendine ters çevirmesini
engelliyor, `prefers-color-scheme` bloğu zeminleri markanın sıcak nötr
eksenine (`#14110d` / `#201c17` / `#2a251e`) çeviriyor.

## Değiştirdikten sonra

```bash
npm run email:build   # templates.generated.ts'i tazeler (commit'lenir)
npm test -- email     # alan, 6563 ve palet nöbetçileri
```

Tarayıcıda görmek için `npm run dev` sonrası
`/dev/mail/<dosya-adi>` (düz metin için `?format=text`) — yalnız geliştirmede,
production'da 404.
