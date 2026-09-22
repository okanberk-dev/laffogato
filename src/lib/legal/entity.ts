/**
 * Yasal kişilik (legal entity) bilgileri — TEK KAYNAK.
 *
 * Tüm hukuki belgeler, şirket bilgileri sayfası ve yapısal veri (JSON-LD) bu
 * dosyadan okur. Değerler kullanıcının ibraz ettiği **vergi levhası** ile
 * birebir doğrulanmıştır (GİB onay kodu: 1JCHRQFDHVZI).
 *
 * MERSİS numarası işletme sahibinin ibraz ettiği ticaret sicil kaydından
 * alınmıştır.
 *
 * ⚠️ Boş bırakılan alanlar (`kep`, `bank`) bilinmiyor. Uydurma değer YAZMAYIN
 * — boş kaldıkları sürece belgelerdeki ilgili tablo satırları otomatik olarak
 * gizlenir (bkz. `fillTokens`). Gerçek değerler öğrenildiğinde yalnızca burayı
 * doldurmak yeterlidir.
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

  /**
   * Veri tabanı barındırma sağlayıcısının adı.
   *
   * KVKK aydınlatma metni, gizlilik politikası, çerez politikası ve veri
   * işleyen listesi dâhil 35 hukuki pasajda geçer. Bunlar bağlayıcı beyandır:
   * verinin nerede tutulduğunu ve yurt dışına aktarımın hangi sağlayıcı
   * nedeniyle olduğunu söyler.
   *
   * Bu yüzden token: sağlayıcı değişirse 35 pasajın 34'ünü güncelleyip birini
   * atlamak, yanlış bir hukuki beyan bırakmak demektir.
   *
   * DEĞERİ GERÇEĞİ İZLEMELİ. Veri fiilen taşınmadan burayı değiştirmeyin —
   * belgede "Supabase" yazarken verinin Neon'da durması, bayat bir saatten
   * çok daha ağır bir hatadır. Taşıma yapılırken bu satır, DATABASE_URL ile
   * AYNI anda değişir.
   */
  dbProvider: "Neon",

  /**
   * Kafenin açılış saatleri — koddaki TEK kaynak.
   *
   * `closes` `opens`'tan KÜÇÜKTÜR: 01:00 ertesi sabaha aittir. schema.org bunu
   * doğrudan böyle ifade eder, ayrı bir kodlama gerekmez.
   *
   * Burada durmasının sebebi bağımlılık yönü: `seo/site.ts` bu dosyadan import
   * eder, tersi döngü olurdu. Bu yüzden alt katman olan burası kanonik kaynak,
   * `SITE.openingHours` de buradan türetilir.
   *
   * Operasyonel saat (footer, JSON-LD) ayrıca panelden `settings.weeklyHours`
   * ile yönetilir ve onu ezer — burası kod tarafındaki yedek ve hukuki
   * belgelerin beslendiği yerdir.
   */
  cafeHours: {
    opens: "09:00",
    closes: "01:00",
    /** Hukuki belge tablosunda basılan hâli. */
    display: "Her gün 09:00 - 02:00",
  },

  phone: "+90 536 429 09 19",
  /** Tüm resmi yazışma, KVKK başvurusu ve müşteri hizmetleri adresi. */
  email: "info@nextgenlab.com.tr",

  /** Vergi dairesi, vergi kimlik numarası ve mükellefiyet bilgileri. */
  taxOffice: "Tuzla Vergi Dairesi",
  taxNo: "6312110904",
  taxType: "Kurumlar Vergisi",
  /** İşe başlama tarihi (vergi levhası). */
  startedAt: "25.06.2026",

  /** MERSİS numarası — ticaret sicil kaydından. */
  mersisNo: "0734069467300012",
  /**
   * Ticaret sicil / dosya numarası.
   *
   * İşletme sahibinin tercihi ile yayımlanmıyor; MERSİS numarası zaten sicil
   * kaydına işaret ediyor. Boş kaldığı için belgelerdeki ilgili tablo satırı
   * hiç basılmaz. (TTK m.39 ticari belgelerde sicil numarasını da arar —
   * yayımlanması istenirse buraya "48639" yazmak yeterli.)
   */
  tradeRegistryNo: "",
  /**
   * Kayıtlı Elektronik Posta (KEP) adresi.
   *
   * Şirketin henüz KEP adresi yok. Boş kaldığı sürece belgelerdeki KEP satırı
   * hiç basılmaz; uydurma bir adres yazmak, tebligatın oraya yapılabileceği
   * anlamına gelirdi.
   */
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
  CAFE_HOURS: LEGAL_ENTITY.cafeHours.display,
  DB_PROVIDER: LEGAL_ENTITY.dbProvider,
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

/**
 * Doldurulabilen token adları.
 *
 * Dışa aktarılıyor ki testler bu listeyi elle kopyalamak zorunda kalmasın.
 * Elle tutulan bir kopya, yeni bir token eklendiğinde güncellenmeyi unutulan
 * üçüncü bir yerdir — bu dosyadaki saat hatasının aynısı.
 */
export const LEGAL_TOKEN_NAMES: readonly string[] = Object.keys(TOKENS);

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
