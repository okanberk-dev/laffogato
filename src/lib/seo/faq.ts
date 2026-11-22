/**
 * FAQ - sıkça sorulan sorular.
 *
 * Used for two purposes:
 *  1. Server-rendered FAQ section on the home page (UX + on-page SEO content)
 *  2. FAQPage JSON-LD structured data (Google rich result + GEO/LLM ingestion)
 *
 * Answers are written in natural Turkish prose, include named entities
 * (Tuzla, Bologna, Uji, Bronte), and stay short enough to be quoted by
 * generative search engines.
 */

export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQ: FaqEntry[] = [
  {
    q: "L’Affogato nerede, nasıl ulaşırım?",
    a: "L'Affogato, Tuzla'da 200 yıllık, restore edilmiş bir Rum köşkünde bulunuyor: Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, 34940 Tuzla, İstanbul. Marmaray Tuzla istasyonu 6 dakika, E-5 / TEM Tuzla çıkışı 4 dakika, Sabiha Gökçen Havalimanı 15 dakika mesafededir. Ücretsiz vale park hizmeti sunulur.",
  },
  {
    q: "Çalışma saatleri nedir?",
    a: "Tuzla köşkü her gün 09:00 - 02:00 saatleri arasında açık. Tüm yıl hizmet veriyoruz - yalnız 1 Ocak günü kapalıyız; köşkün avlusu yaz aylarında, yüksek tavanlı iç salonları kış aylarında kullanılır. Tuzla Marina'daki L'Affogato Marina 10:00 - 23:00 arası açık.",
  },
  {
    q: "L’Affogato nedir, menüde nasıl servis ediliyor?",
    a: "L'Affogato, bir top dondurma üzerine sıcak espresso dökülerek hazırlanan İtalyan klasiğidir; evin imza içeceğidir ve 280₺'dir. Matcha sevenler için Matcha Affogato da menüdedir: buzlu matcha latte üzerine bir top dondurma ve matcha tozu, 245₺. Her ikisi de siparişten hemen sonra hazırlanır; sıcak-soğuk kontrastı için birkaç dakika içinde tüketilmesi önerilir.",
  },
  {
    q: "Vegan veya glutensiz seçeneğiniz var mı?",
    a: "Sütlü içecekler 25₺ fark ile laktozsuz ya da badem sütüyle hazırlanabilir. Frozen serisi (çilek, ahududu, çarkıfelek, ananas), L'Af Limon ve Cool Lime süt içermez. Fındık içeren kalemler menüde ayrıca işaretlidir; tüm alerjen bilgisi mekanda mevcuttur.",
  },
  {
    q: "Matcha bar’da hangi çay kullanılıyor?",
    a: "Ceremonial grade matcha kullanıyoruz ve her bardağı siparişten sonra çırpıyoruz; premix yok. Matcha bar'da üç kalem var: Matcha Latte 215₺, Çilekli Matcha 245₺ ve Matcha Affogato 245₺. Çilekli Matcha, taze çilek katmanı üzerine matcha ve soğuk sütle hazırlanır.",
  },
  {
    q: "Online sipariş ve kargo var mı?",
    a: "Çekirdek kahve (Sirena espresso blend, Notturna filter lot), Uji matcha, edible cup kutuları, ekipman (Bialetti moka, porselen takım, bambu chasen) ve hediye setleri online satıyoruz. Türkiye geneli 1-3 iş günü kargo. Tatlılar, sandviçler ve tüm bar içecekleri sadece mekanda servis edilir.",
  },
  {
    q: "Kahve nereden geliyor, kim kavuruyor?",
    a: "Sirena espresso harmanımız Brezilya doğal + Etiyopya yıkanmış çekirdeklerden oluşur. Notturna filtre lotu Kenya AA Nyeri'dir. Kahveyi Bologna'daki ana lokasyonda Mancuso ailesi her hafta taze kavurur ve uçakla İstanbul'a getirir. Tuzla'ya haftalık ulaşır, kavurma tarihi her paketin üzerinde yazılıdır.",
  },
  {
    q: "L’Affogato hangi yıldan beri var, geçmişi nedir?",
    a: "L'Affogato 1897'de Giancarlo Mancuso tarafından Bologna Via Galliera 21'de açıldı. 1994'te yenilebilir kup patentlendi, 2008'de Sicilya Bronte pistacchio çiftlikleriyle doğrudan tedarik anlaşması yapıldı. 2026'da dördüncü kuşaktan Eda Mancuso ilk yurt dışı şubeyi İstanbul Tuzla'da açtı; Kasım 2026'da ikinci şube L'Affogato Marina, Tuzla Marina'da açıldı.",
  },
  {
    q: "Çocuk ve evcil hayvan dostu mu?",
    a: "Evet. Köşkün avlusu, bebek arabası erişimine uygundur. Çocuk için kafeinsiz sıcak çikolata, salep ve vitrindeki tatlılar tercih edilebilir. Köpekler köşkün bahçesinde karşılanır; su kabı ve ev yapımı dog biscuit ikram edilir.",
  },
  {
    q: "Tuzla’da karaoke odası var mı?",
    a: "Evet. Tuzla köşkünün üst katında en fazla 8 kişilik, yalnız sizin grubunuza ayrılan bir karaoke odası var; 12:00 - 24:00 arası saatlik rezervasyonla kullanılır. Gün ve saat laffogato.net/karaoke sayfasından ya da uygulamadan seçilir, kartla ödeme alınınca rezervasyon kesinleşir. L'Affogato Marina şubesinde karaoke yoktur.",
  },
  {
    q: "Ödeme yöntemleri nelerdir?",
    a: "Nakit, kredi kartı (Visa, Mastercard, Amex), Apple Pay, Google Pay ve banka kartı kabul edilir. Online mağaza için tüm Türk bankaları desteklenir; uluslararası kartlarla EUR ve USD çekimi de yapılabilir.",
  },
];
