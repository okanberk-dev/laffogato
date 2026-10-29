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
// 27 Ekim 2026: App Review 4.3(b) and 5.1.1(v). fA'L left the app (lafmobil
// karar 330) and Kahve Modu took its place: a mood written on the member's
// own photo on the device, nothing uploaded, no AI. Every coded text says
// Kahve Modu instead of fA'L and that the camera also reads the table QR; no
// AI provider (Anthropic) is a recipient; R12 (Açık Rıza 15/A) is retired,
// R7 to R11 keep their numbers; the phone is optional at the app's sign-up
// ("verdiyseniz"); an unpaid checkout is cancelled at account closure
// instead of holding it, unless its payment is still at the bank or the
// POS cannot be asked (then the closure waits, at most 24 h). The ÖBF (§18, §20) and the MSS (§1, §2, §16)
// changed, so the label moved; the four documents that carried 25 Ekim 2026
// of their own read the set's day again. LEGAL-REDLINES §36.
// 22 Ekim 2026: the ÖBF (§17, §19) and the MSS (§16) say the app gets
// order-status push notifications once the member allows them, the device's
// notification token reaches the server, and Expo, Apple and Google carry
// them (LEGAL-REDLINES §30). Every document reads this day again; the ten
// that carried 21 Ekim 2026 of their own may not print a day before it.
// 20 Ekim 2026: the ÖBF (§16) and the MSS (§9) say the invoice is an
// e-Arşiv invoice sent by e-mail, its paper copy in the parcel standing in
// for the waybill; Şirket Bilgileri §14 takes corporate details by e-mail
// after the order, and the İşlem Rehberi joins the set. LEGAL-REDLINES §24.
// The set carries the publish day. Until 21 Ekim 2026 only one PR that moved
// this label merged per Istanbul day (D-SAME-DAY; 19 Ekim 2026 was the KDV
// wording, §16.4; 18 Ekim 2026 the distance-sales set, §18 and §19), because
// two texts under one label left the confirmed one unprovable. That rule
// ended with the durable copy (LEGAL-REDLINES §25): a consent now records,
// next to this label, the hash of every text it confirmed
// (`legalConsent.textHashes`) and the text is stored under it
// (`legal_doc_versions`), so the hash, not the day, tells two texts apart.
// The label still names the day the set was published.
export const LEGAL_UPDATED = "27 Ekim 2026";

/**
 * The Ticari Elektronik İleti ve İYS Aydınlatması's own revision, printed
 * as its "son güncelleme" and recorded with every commercial consent
 * (`COMMERCIAL_CONSENT_TEXT_VERSION`, src/lib/customer/consent-ledger.ts):
 * a grant names the text it refers to. Until 22 Ekim 2026 the document had
 * no date of its own and the version borrowed `LEGAL_UPDATED`. 22 Ekim 2026:
 * §9 and §10 say how consents and refusals reach İYS and that İYS is checked
 * before every send (LEGAL-REDLINES §31). 27 Ekim 2026: §1, §13 and §20 say
 * Kahve Modu instead of fA'L and that the camera also reads the table QR;
 * §20 no longer points at R12 (LEGAL-REDLINES §36). Move it when that
 * document's words change; it is never earlier than `LEGAL_UPDATED` (a
 * printed date never is, tests/legal-dates.test.ts), so a later revision of
 * the set moves it too, as the version always did.
 */
export const COMMERCIAL_CONSENT_UPDATED = "27 Ekim 2026";

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
 * Google standard contract is signed and notified to the Kurum. Flipping it
 * also moves the cookie consent version (`consentVersionFor`,
 * `src/lib/consent/cookie.ts`), so every visitor is asked again and no
 * stored choice turns the tags on.
 */
export const GOOGLE_TAGS_IN_LEGAL_TEXTS = false;

/**
 * Whether the legal texts describe the Meta Pixel as running on the site
 * (reklam ölçümü ve yeniden hedefleme; Meta Platforms Ireland Ltd.).
 *
 * TASLAK (25 Ekim 2026): the wording in the Çerez Politikası, the KVKK
 * Aydınlatma Metni and the other documents that spoke of "no ad tags" is a
 * draft that waits for the lawyer's reading (docs/META-PIXEL.md, LEGAL-REDLINES
 * §32). Unlike Google's tags (above), the pixel does not rest on a standard
 * contract: the transfer it makes is put on the visitor's explicit consent,
 * given in the cookie panel and withdrawn from the same panel. Whether that
 * basis stands is the lawyer's call, not this flag's.
 *
 * `metaPixelId` (src/lib/consent/meta-pixel.ts) loads the pixel only while
 * this is true, so an id left in the environment cannot bring it back under
 * texts that say there is none. It also moves the cookie consent version
 * (`consentVersionFor`, src/lib/consent/cookie.ts): a visitor who answered
 * the banner before the pixel existed is asked again for the marketing
 * category. Setting `NEXT_PUBLIC_META_PIXEL_ID` to an empty string switches
 * the pixel off without a code change.
 */
export const META_PIXEL_IN_LEGAL_TEXTS = true;

/**
 * The day the Meta Pixel passages entered the four documents that speak of
 * cookies and tags (Çerez Politikası, KVKK Aydınlatma Metni, Gizlilik
 * Politikası, Açık Rıza Metni; LEGAL-REDLINES §35). They carried it as their
 * own `updatedAt` until 27 Ekim 2026: the set's revision (`LEGAL_UPDATED`) is
 * the version a checkout consent records, and none of the checkout documents
 * had changed. On 27 Ekim 2026 the set moved past this day (LEGAL-REDLINES
 * §36) and the four read the set's day again, since a printed date is never
 * before the revision (tests/legal-dates.test.ts). Kept as the record of when
 * the pixel entered the texts.
 */
export const META_PIXEL_LEGAL_UPDATED = "25 Ekim 2026";

/**
 * The day the karaoke free-cancel window started to be counted from the
 * booking instead of back from the start (operator, 28 Ekim 2026: "karaoke
 * için 2 saat içinde iptal etmezse iade olamaz"; `karaokeDeadlineFor`,
 * src/lib/mobile/karaoke-time.ts; LEGAL-REDLINES §37). The two documents
 * that quote the default rule in their own words, Ödeme Koşulları (§21) and
 * Hesap Silme (§6, §8), carry it as their own `updatedAt`. Neither is a
 * checkout document, so the set's revision (`LEGAL_UPDATED`), the version a
 * checkout consent records, stays where it is, and with it
 * `COMMERCIAL_CONSENT_UPDATED`. The karaoke terms name no hours (they point
 * at the booking's own summary since 19 Ekim 2026), so `KARAOKE_LEGAL_UPDATED`
 * stays too. Add the two documents to tests/legal-dates.test.ts with this day.
 */
// 29 Ekim 2026: §21 also says that a resold hour of a booking cancelled
// after its free window goes back within 14 days, and no longer that karaoke
// refunds are never partial (LEGAL-REDLINES §37.8); 28 Ekim 2026: the window
// counted from the booking.
export const KARAOKE_WINDOW_LEGAL_UPDATED = "29 Ekim 2026";

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
// 29 Ekim 2026: §7 says a guest who tells us before the start that they
// will not come is cancelled and their hours go back on sale, a resold hour
// refunding what was paid for it; §8 says until when a free make-good hour
// can be let go and what happens after (LEGAL-REDLINES §37.8). 21 Ekim
// 2026: §8 makes good the köşk's late cancel (a free hour of the
// same length, or the amount paid to the guest's own bank account), §9 says
// a share goes back within 14 days, now that a late share of 1..99 % can be
// chosen (karaoke-make-good-and-resale, LEGAL-REDLINES §26). (20 Ekim 2026:
// §12 says the payment is an advance until the service day, invoiced as an
// e-Arşiv invoice within 7 days of it for the amount the köşk keeps
// (ASK-KAR-KDV), §24. 19 Ekim 2026: §7 and §10 name the booking's own
// summary instead of fixed hours, §7 says when a cancel by phone or e-mail
// counts, §8 says when and why the köşk cancels, §17. 17 Ekim 2026: §1 no
// longer points table bookings to the café terms.) Until 21 Ekim 2026 one
// PR that moved this label merged per Istanbul day (D-SAME-DAY); a
// booking's consent now records the hash of the text it confirmed as well
// (LEGAL-REDLINES §25), and the rule ended.
export const KARAOKE_LEGAL_UPDATED = "29 Ekim 2026";
