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
 * The revision the contract set was issued under, and the version a
 * customer's checkout consent records (`legalConsent.version`) while the
 * coded checkout documents are the ones shown. A document whose text changed
 * later carries its own `updatedAt` in `content.ts` for display; this label
 * moves only when one of `CHECKOUT_CONSENT_DOCS` does. A published panel
 * override of a checkout document moves the RECORDED version past it without
 * touching this constant (`consentVersionFrom`, `./consent-version`).
 */
// 19 Ekim 2026: the ÖBF and the MSS state the KDV rule instead of a list of
// rates (every item at the rate the law gives it, the shipping or courier
// fee its own line, the total in the order summary fixed even if a rate
// changes later); the Teslimat ve Kargo, Satış Politikası, Ödeme Koşulları
// and Şirket Bilgileri texts follow. LEGAL-REDLINES §16.4. The set carries
// the publish day: only one PR that moves this label merges per Istanbul
// day (18 Ekim 2026 was the distance-sales set, §18 and §19).
export const LEGAL_UPDATED = "19 Ekim 2026";

/**
 * Whether the legal texts describe saved cards (PayNkolay's card storage,
 * docs/PAYNKOLAY.md §16). They do not since 18 Ekim 2026: the passages that
 * said "kart saklama özelliği açıldığında ..." are kept in
 * docs/LEGAL-REDLINES-2026-09.md §19, to come back word for word.
 *
 * The payment provider ANDs this with `PAYNKOLAY_CARD_STORAGE`, so the env
 * switch alone cannot turn card storage on, and no member key is minted
 * while it is off. Flip it only in the PR that restores those texts, and
 * publish that text before the first card is saved (Aydınlatma Tebliği
 * m.5/1-b: the notice comes before the processing). tests/legal-docs.test.ts
 * holds the texts to this value.
 */
export const SAVED_CARDS_IN_LEGAL_TEXTS = false;

/**
 * Whether the legal texts describe Google's tags (Tag Manager, Analytics,
 * Ads) as running on the site. They do not since 19 Ekim 2026: Google offers
 * no Turkish standard contract for these services (its Ads/Analytics
 * processor terms carry no KVKK clause), so the transfer they make on every
 * page view has no KVKK m.9/4 safeguard, and the texts say "İnternet
 * sitemizde bugün analitik veya reklam etiketi kullanılmaz"
 * (docs/LEGAL-REDLINES-2026-09.md §15.6).
 *
 * The root layout loads Google Tag Manager only when this is true AND
 * `NEXT_PUBLIC_GTM_ID` is set (`siteTagManagerId`), so an environment
 * variable left in Vercel cannot bring the tags back under texts that say
 * there are none. Flip it only in the PR that restores those texts, after a
 * Google standard contract is signed and notified to the Kurum.
 */
export const GOOGLE_TAGS_IN_LEGAL_TEXTS = false;

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

/**
 * Online ön ödemeli karaoke rezervasyonunda ödemeden önce onaylanan belge
 * (16 Eki 2026). Karaoke odası bir hizmettir: Mesafeli Satış Sözleşmesi mal
 * satışıyla sınırlı, Ön Bilgilendirme Formu kargo ve cayma üzerine kurulu;
 * ikisini onaylatmak hizmete uymayan şartları onaylatmak olurdu. Ön
 * bilgilendirme ile sözleşme tek belgede, onay kutusu iki (MSY m.7 teyit +
 * sözleşmenin kabulü), kayıt `karaoke_reservations."legalConsent"`.
 */
export const KARAOKE_CONSENT_DOCS = ["karaoke-odasi-rezervasyon"] as const;

/**
 * Karaoke belgesinin kodda yazılı sürümü: belgenin kendi `updatedAt`'i ile
 * aynı gün olmak zorunda (tests/legal-dates.test.ts). Panelden yayımlanan bir
 * geçersiz kılma, kaydedilen sürümü bunun ötesine taşır (`consentVersionFrom`).
 */
// 17 Ekim 2026: §1 no longer points table bookings to the café terms (the
// café takes none; only the karaoke room is booked). LEGAL-REDLINES §17.
export const KARAOKE_LEGAL_UPDATED = "17 Ekim 2026";
