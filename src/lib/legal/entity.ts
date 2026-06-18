/**
 * Yasal kişilik (legal entity) bilgileri.
 *
 * Tüm hukuki belgelerde aynı bilgi tek noktadan okunur. Vergi numarası,
 * MERSİS, ticaret sicil numarası gibi alanlar production deploy öncesinde
 * gerçek değerlerle güncellenmelidir.
 */

export const LEGAL_ENTITY = {
  /** Tüzel kişi unvanı (production'da güncellenecek). */
  legalName: "L'Affogato Gıda ve Servis A.Ş.",
  brand: "L'Affogato",
  /** Ticari faaliyet — KGK / vergi dairesi kaydındaki ifade. */
  activity: "Kahve ve gelato bar işletmeciliği, gıda ürünleri online satışı",
  /** Türkiye merkez adresi (yasal merkez). */
  address: {
    line1: "Postane Mah.",
    line2: "Açık-hava teras katı",
    district: "Tuzla",
    city: "İstanbul",
    zip: "34953",
    country: "Türkiye",
  },
  phone: "+90 216 459 30 60",
  email: "tuzla@laffogato.it",
  legalEmail: "kvkk@laffogato.com.tr",
  /** Mersis ve sicil numaraları — gerçek değerlerle değiştir. */
  mersisNo: "0123-4567-8901-2345",
  tradeRegistryNo: "İstanbul · 999999",
  /** Vergi dairesi + numarası. */
  taxOffice: "Tuzla Vergi Dairesi",
  taxNo: "1234567890",
  /** Banka bilgileri — para iadesi için. */
  bank: {
    name: "Türkiye İş Bankası A.Ş.",
    iban: "TR00 0006 4000 0011 2345 6789 01",
  },
  /** Veri sorumlusu (KVKK). */
  dataController: "L'Affogato Gıda ve Servis A.Ş.",
  /** KEP adresi (Kayıtlı Elektronik Posta). */
  kep: "laffogato@hs01.kep.tr",
  /** İtalya referansı — orijinal kuruluş bilgisi (yalnızca marka geçmişi). */
  italyOrigin: {
    legalName: "L'Affogato Italia S.r.l.",
    address: "Via Galliera 21, 40121 Bologna, Italia",
    vatNo: "IT 0123 4567 891",
    founded: 1987,
  },
} as const;
