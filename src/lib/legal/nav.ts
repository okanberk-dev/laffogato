/**
 * Footer'da listelenen hukuki belgeler — yalnızca slug + etiket.
 *
 * Footer bir client component olduğu için burası bilerek `documents.ts`'ten
 * ayrı tutulur: aksi halde bütün belgelerin tam metni istemci paketine
 * girerdi.
 * Slug'ların gerçekten var olduğu `tests/legal-docs.test.ts` içinde doğrulanır.
 *
 * **Burası tam liste değildir, olmamalıdır.** Footer'da on dört sözleşme
 * saymak hiçbirini okutmuyordu; asıl belgeler diğerlerinin arasında
 * kayboluyordu. Kalanların ölçütü tek tek şu:
 *
 * - **Gizlilik Politikası** — App Store ve Google Play listelemelerinin
 *   zorunlu alanı; her ikisi de kararlı bir genel URL ister.
 * - **KVKK Aydınlatma Metni** — 6698 sayılı kanunun aradığı aydınlatma.
 * - **Çerez Politikası** — yanındaki "Çerez Tercihleri" düğmesinin dayanağı.
 * - **Mesafeli Satış Sözleşmesi** ve **İptal, İade & Cayma** — Mesafeli
 *   Sözleşmeler Yönetmeliği'nin satış öncesi erişilebilir olmasını istediği
 *   iki belge; ayrıca ziyaretçinin footer'da gerçekten aradığı ikisi.
 * - **Hesap Silme** — Google Play'in "Data deletion URL" alanı bu sayfayı
 *   gösterir; uygulamayı kurmamış bir üyenin de talebi iletebileceği tek
 *   genel adres burasıdır, dolayısıyla footer'dan düşürülemez.
 * - **İşlem Rehberi** (20 Ekim 2026): Elektronik Ticaret Aracı Hizmet
 *   Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik
 *   m.7/1, sipariş adımlarını, düzeltme araçlarını, sözleşme metninin
 *   saklanmasını ve uyuşmazlık yollarını anlatan "işlem rehberi"nin ana
 *   sayfada bulunmasını ister; footer her sayfada, ana sayfada da durur.
 *
 * Operatör 7 Eyl'de listeyi **altıya** indirdi; İşlem Rehberi yedinci
 * olarak yönetmelik gereği eklendi. 7 Eyl'de çıkan ikisi:
 *
 * - **Kullanım Şartları** — yasal olarak bir yerde bulunması yeterli; hiçbir
 *   mağaza formu ona kalıcı bir URL olarak sormuyor.
 * - **Şirket Bilgileri** — satıcının tüzel kimliği footer'ın alt şeridinde
 *   (`SITE_LEGAL_NAME`) ve iletişim sütununda (adres, telefon, e-posta) zaten
 *   görünür; yönetmeliğin istediği görünürlük belgeye değil bilgiye bakıyor.
 *
 * Hiçbiri silinmedi: hepsi `/hukuk` altında duruyor, footer'ın sonundaki
 * "Tüm belgeler" oraya gidiyor, ve satış öncesi onay gereken Ön Bilgilendirme
 * Formu ile Mesafeli Satış Sözleşmesi zaten ödeme adımında ayrıca
 * gösteriliyor (`CHECKOUT_CONSENT_DOCS`) — footer onların tebliğ yeri değil.
 */
export const FOOTER_LEGAL_DOCS = [
  { slug: "mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { slug: "iade-ve-cayma", label: "İptal, İade & Cayma" },
  { slug: "islem-rehberi", label: "İşlem rehberi" },
  { slug: "gizlilik-politikasi", label: "Gizlilik Politikası" },
  { slug: "kvkk-aydinlatma-metni", label: "KVKK Aydınlatma" },
  { slug: "cerez-politikasi", label: "Çerez Politikası" },
  { slug: "hesap-silme", label: "Hesap Silme" },
] as const;
