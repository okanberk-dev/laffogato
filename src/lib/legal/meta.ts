/**
 * Legal metadata with no document text behind it.
 *
 * `documents.ts` hydrates all twenty-four contracts from `content.ts`, which is
 * 1.5 MB of source. Checkout needs exactly two constants from it, and pulling
 * the whole registry in for them put every contract into the server bundle of
 * the hottest route on the site.
 *
 * Kept deliberately tiny, like `nav.ts`. `documents.ts` re-exports these, so
 * existing importers are unaffected.
 */

/**
 * The revision label stamped on every rendered document, and recorded with a
 * customer's consent as the version they agreed to.
 */
export const LEGAL_UPDATED = "1 Eylül 2026";

/**
 * /hukuk dizin sayfasındaki kategori sırası. Listede olmayan bir kategori
 * sona eklenir, böylece yeni kategori eklemek burayı güncellemeyi zorunlu
 * kılmaz.
 */
export const LEGAL_CATEGORY_ORDER = [
  "Sipariş",
  "Ödeme & Güvenlik",
  "Veri & Gizlilik",
  "Site & Üyelik",
  "Kurumsal",
] as const;

/**
 * Ödeme adımında onaylanması zorunlu belgeler. Mesafeli Sözleşmeler
 * Yönetmeliği, siparişten **önce** ön bilgilendirmenin yapıldığının ve
 * tüketicinin bunu teyit ettiğinin kanıtlanmasını arar; sanal POS
 * başvurularında da aynı kayıt istenir. Slug'ların gerçekten var olduğu
 * tests/legal-docs.test.ts içinde doğrulanır.
 */
export const CHECKOUT_CONSENT_DOCS = [
  "on-bilgilendirme-formu",
  "mesafeli-satis-sozlesmesi",
] as const;
