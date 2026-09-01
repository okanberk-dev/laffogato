/**
 * Yasal kişilik (legal entity) bilgileri — TEK KAYNAK.
 *
 * Tüm hukuki belgeler, şirket bilgileri sayfası ve yapısal veri (JSON-LD) bu
 * dosyadan okur. Değerler kullanıcının ibraz ettiği **vergi levhası** ile
 * birebir doğrulanmıştır (GİB onay kodu: 1JCHRQFDHVZI).
 *
 * ⚠️ Boş bırakılan alanlar (`mersisNo`, `tradeRegistryNo`, `kep`, `bank`)
 * bilinmiyor. Uydurma değer YAZMAYIN — boş kaldıkları sürece belgelerdeki
 * ilgili tablo satırları otomatik olarak gizlenir (bkz. `fillTokens`).
 * Gerçek değerler öğrenildiğinde yalnızca burayı doldurmak yeterlidir.
 */

export const LEGAL_ENTITY = {
  /** Ticaret unvanı — vergi levhasındaki tüzel kişi unvanı. */
  legalName: "NEXTGEN YAZILIM EĞİTİM İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
  /** Günlük dilde kullanılan kısa unvan. */
  shortName: "NextGen Yazılım Ltd. Şti.",
  /** İşletilen marka. */
  brand: "L'Affogato",

  /** Ana faaliyet kodu ve adı (vergi levhası). */
  naceCode: "621000",
  naceName: "Bilgisayar programlama faaliyetleri",

  /** Vergi levhasındaki iş yeri adresi. */
  address: {
    line1: "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    district: "Tuzla",
    city: "İstanbul",
    country: "Türkiye",
  },

  phone: "+90 216 459 30 60",
  /** Tüm resmi yazışma, KVKK başvurusu ve müşteri hizmetleri adresi. */
  email: "info@nextgenlab.com.tr",

  /** Vergi dairesi, vergi kimlik numarası ve mükellefiyet bilgileri. */
  taxOffice: "Tuzla Vergi Dairesi",
  taxNo: "6312110904",
  taxType: "Kurumlar Vergisi",
  /** İşe başlama tarihi (vergi levhası). */
  startedAt: "25.06.2026",

  /** TODO: Ticaret sicil kaydından doldur — boş kaldıkça belgelerde gizlenir. */
  mersisNo: "",
  /** TODO: Ticaret sicil müdürlüğü + sicil numarası. */
  tradeRegistryNo: "",
  /** TODO: Kayıtlı Elektronik Posta (KEP) adresi. */
  kep: "",
  /** TODO: Para iadesi/havale için banka ve IBAN bilgisi. */
  bank: { name: "", iban: "" },

  /** Sosyal medya hesapları — hepsinin kullanıcı adı @laffogatto. */
  social: {
    handle: "@laffogatto",
    instagram: "https://instagram.com/laffogatto",
    tiktok: "https://tiktok.com/@laffogatto",
    youtube: "https://youtube.com/@laffogatto",
  },

  /** Kanonik site adresi (yasal belgelerde anılır). */
  siteDomain: "laffogato.net",
  siteUrl: "https://laffogato.net",
} as const;

/** Veri sorumlusu (KVKK) — tüzel kişinin kendisi. */
export const DATA_CONTROLLER = LEGAL_ENTITY.legalName;

/** Tek satırlık, tam yasal adres. */
export const LEGAL_ADDRESS_LINE = [
  LEGAL_ENTITY.address.line1,
  `${LEGAL_ENTITY.address.district}/${LEGAL_ENTITY.address.city}`,
  LEGAL_ENTITY.address.country,
].join(", ");

/**
 * Belge metinlerinde kullanılan `{{TOKEN}}` yer tutucularının karşılıkları.
 *
 * Belgeler ham metin olarak yazılır; şirket bilgisi geçen her yerde token
 * kullanılır. Böylece unvan/adres/vergi no değiştiğinde tek dosya güncellenir.
 */
const TOKENS: Record<string, string> = {
  LEGAL_NAME: LEGAL_ENTITY.legalName,
  SHORT_NAME: LEGAL_ENTITY.shortName,
  BRAND: LEGAL_ENTITY.brand,
  ADDRESS: LEGAL_ADDRESS_LINE,
  PHONE: LEGAL_ENTITY.phone,
  EMAIL: LEGAL_ENTITY.email,
  TAX_OFFICE: LEGAL_ENTITY.taxOffice,
  TAX_NO: LEGAL_ENTITY.taxNo,
  TAX_TYPE: LEGAL_ENTITY.taxType,
  STARTED_AT: LEGAL_ENTITY.startedAt,
  NACE: `${LEGAL_ENTITY.naceCode} — ${LEGAL_ENTITY.naceName}`,
  MERSIS: LEGAL_ENTITY.mersisNo,
  TRADE_REGISTRY: LEGAL_ENTITY.tradeRegistryNo,
  KEP: LEGAL_ENTITY.kep,
  IBAN: LEGAL_ENTITY.bank.iban,
  BANK: LEGAL_ENTITY.bank.name,
  SITE: LEGAL_ENTITY.siteDomain,
  SITE_URL: LEGAL_ENTITY.siteUrl,
  HANDLE: LEGAL_ENTITY.social.handle,
  IG: LEGAL_ENTITY.social.instagram,
  TIKTOK: LEGAL_ENTITY.social.tiktok,
  YOUTUBE: LEGAL_ENTITY.social.youtube,
};

/** Her çağrıda taze bir regex — paylaşılan `lastIndex` durumu taşımasın. */
const tokenRe = () => /\{\{([A-Z_]+)\}\}/g;

/** `{{TOKEN}}` yer tutucularını gerçek değerlerle değiştirir. */
export function fillTokens(text: string): string {
  return text.replace(tokenRe(), (match, key: string) =>
    key in TOKENS ? TOKENS[key] : match,
  );
}

/**
 * Doldurulduğunda boş kalan (yani değeri bilinmeyen) bir token içeriyor mu?
 * Belge tablolarında MERSİS/sicil/KEP gibi satırları gizlemek için kullanılır.
 */
export function hasEmptyToken(text: string): boolean {
  for (const m of text.matchAll(tokenRe())) {
    const key = m[1];
    if (key in TOKENS && TOKENS[key].trim() === "") return true;
  }
  return false;
}
