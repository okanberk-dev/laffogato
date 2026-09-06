/**
 * Footer'da listelenen hukuki belgeler — yalnızca slug + etiket.
 *
 * Footer bir client component olduğu için burası bilerek `documents.ts`'ten
 * ayrı tutulur: aksi halde 24 belgenin tam metni istemci paketine girerdi.
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
 * - **Kullanım Şartları** — sitenin kendi kullanım koşulları.
 * - **Hesap Silme** — Google Play'in "Data deletion URL" alanı bu sayfayı
 *   gösterir; uygulamayı kurmamış bir üyenin de talebi iletebileceği tek
 *   genel adres burasıdır, dolayısıyla footer'dan düşürülemez.
 * - **Şirket Bilgileri** — satıcının tüzel kimliği; yönetmelik görünür
 *   olmasını istiyor.
 *
 * Ön Bilgilendirme Formu, Teslimat & Kargo, Ödeme Koşulları, Güvenli
 * Alışveriş, Ödül Programı ve Mobil Uygulama Koşulları listeden çıktı ama
 * hiçbir yerden silinmedi: hepsi `/hukuk` altında duruyor, footer'ın sonundaki
 * "Tüm belgeler" oraya gidiyor, ve satış öncesi onay gereken Ön Bilgilendirme
 * Formu ile Mesafeli Satış Sözleşmesi zaten ödeme adımında ayrıca
 * gösteriliyor (`CHECKOUT_CONSENT_DOCS`) — footer onların tebliğ yeri değil.
 */
export const FOOTER_LEGAL_DOCS = [
  { slug: "mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { slug: "iade-ve-cayma", label: "İptal, İade & Cayma" },
  { slug: "gizlilik-politikasi", label: "Gizlilik Politikası" },
  { slug: "kvkk-aydinlatma-metni", label: "KVKK Aydınlatma" },
  { slug: "cerez-politikasi", label: "Çerez Politikası" },
  { slug: "kullanim-sartlari", label: "Kullanım Şartları" },
  { slug: "hesap-silme", label: "Hesap Silme" },
  { slug: "sirket-bilgileri", label: "Şirket Bilgileri" },
] as const;
