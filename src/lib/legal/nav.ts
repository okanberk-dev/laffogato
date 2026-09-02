/**
 * Footer'da listelenen hukuki belgeler — yalnızca slug + etiket.
 *
 * Footer bir client component olduğu için burası bilerek `documents.ts`'ten
 * ayrı tutulur: aksi halde 24 belgenin tam metni istemci paketine girerdi.
 * Slug'ların gerçekten var olduğu `tests/legal-docs.test.ts` içinde doğrulanır.
 */
export const FOOTER_LEGAL_DOCS = [
  { slug: "on-bilgilendirme-formu", label: "Ön Bilgilendirme Formu" },
  { slug: "mesafeli-satis-sozlesmesi", label: "Mesafeli Satış Sözleşmesi" },
  { slug: "iade-ve-cayma", label: "İptal, İade & Cayma" },
  { slug: "teslimat-ve-kargo", label: "Teslimat & Kargo" },
  { slug: "odeme-kosullari", label: "Ödeme Koşulları" },
  { slug: "guvenli-alisveris", label: "Güvenli Alışveriş" },
  { slug: "gizlilik-politikasi", label: "Gizlilik Politikası" },
  { slug: "kvkk-aydinlatma-metni", label: "KVKK Aydınlatma" },
  { slug: "cerez-politikasi", label: "Çerez Politikası" },
  { slug: "kullanim-sartlari", label: "Kullanım Şartları" },
  { slug: "odul-programi", label: "Ödül Programı" },
  { slug: "mobil-uygulama-kosullari", label: "Mobil Uygulama" },
  { slug: "sirket-bilgileri", label: "Şirket Bilgileri" },
] as const;
