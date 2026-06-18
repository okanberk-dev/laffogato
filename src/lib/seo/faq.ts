/**
 * FAQ — sıkça sorulan sorular.
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
    q: "L'Affogato nerede, nasıl ulaşırım?",
    a: "L'Affogato, Tuzla'nın açık-hava teras katında bulunuyor: Postane Mah., Tuzla, 34953 Tuzla, İstanbul. Marmaray Tuzla istasyonu 6 dakika, E-5 / TEM Tuzla çıkışı 4 dakika, Sabiha Gökçen Havalimanı 15 dakika mesafededir. Ücretsiz vale park hizmeti sunulur.",
  },
  {
    q: "Çalışma saatleri nedir?",
    a: "Pazartesi'den Perşembe'ye 10:00 — 23:00, Cuma ve Cumartesi 10:00 — 24:00, Pazar 10:00 — 23:00 saatleri arasında açığız. Tüm yıl boyunca hizmet veriyoruz; teras katı yaz aylarında tamamen açık, kış aylarında ısıtmalı çadır altında kullanılır.",
  },
  {
    q: "Affogato Classico nedir, yenilebilir kup ne demek?",
    a: "Affogato Classico, tek scoop fior di latte gelato üzerine çift shot Sirena espresso dökülerek hazırlanan İtalyan tatlısıdır. 1987'den beri İtalya'daki orijinal tariftir. Biz bunu yenilebilir waffle kup içinde servis ederiz: bittiğinde kupayı da yiyebilirsiniz, kaşığa gerek kalmaz. Mancuso ailesinin 1994'te patentlediği glaze kaplama kupayı en az 20 dakika çıtır tutar.",
  },
  {
    q: "Rezervasyon yapabilir miyim?",
    a: "Evet. +90 216 459 30 60 numarasından ya da web sitesindeki Visit sayfasından masa rezervasyonu yapılabilir. Hafta sonu akşam servisleri için 24 saat öncesinden rezervasyon öneririz. 12 koltuklu küçük bir teras barız, masaları sınırlıdır.",
  },
  {
    q: "Vegan veya glutensiz seçeneğiniz var mı?",
    a: "Var. Affogato Cioccolato bitter çikolata gelatomuzla vegan olarak hazırlanabilir. Sorbe seçeneklerimiz (çilek, mango, limon) süt içermez. Glutensiz waffle kupa stoğumuz sınırlıdır; rezervasyon sırasında bildirirseniz ayırırız. Tüm alerjen bilgisi mekanda mevcuttur.",
  },
  {
    q: "Matcha bar'da hangi çay kullanılıyor?",
    a: "Japonya Uji bölgesinden ceremonial grade matcha kullanıyoruz. Her bardağı bambu chasen (80 dişli, Nara yapımı) ile siparişten sonra dövüyoruz. Premix yok. Hojicha menümüzde de mevcuttur — kavrulmuş yeşil çay, kafeini hafif.",
  },
  {
    q: "Online sipariş ve kargo var mı?",
    a: "Çekirdek kahve (Sirena espresso blend, Notturna filter lot), Uji matcha, edible cup kutuları, ekipman (Bialetti moka, porselen takım, bambu chasen) ve hediye setleri online satıyoruz. Türkiye geneli 1–3 iş günü kargo. Gelato ve bombolone gibi taze ürünler sadece mekanda servis edilir.",
  },
  {
    q: "Kahve nereden geliyor, kim kavuruyor?",
    a: "Sirena espresso harmanımız Brezilya doğal + Etiyopya yıkanmış çekirdeklerden oluşur. Notturna filtre lotu Kenya AA Nyeri'dir. Kahveyi Bologna'daki ana lokasyonda Mancuso ailesi her hafta taze kavurur ve uçakla İstanbul'a getirir. Tuzla'ya haftalık ulaşır, kavurma tarihi her paketin üzerinde yazılıdır.",
  },
  {
    q: "L'Affogato hangi yıldan beri var, geçmişi nedir?",
    a: "L'Affogato 1987'de Giancarlo Mancuso tarafından Bologna Via Galliera 21'de açıldı. 1994'te yenilebilir kup patentlendi, 2008'de Sicilya Bronte pistacchio çiftlikleriyle doğrudan tedarik anlaşması yapıldı. 2026'da torunu Eda Mancuso ilk yurt dışı şubeyi İstanbul Tuzla'da açtı. Bugün İtalya dışındaki tek L'Affogato budur.",
  },
  {
    q: "Franchise vermek istiyorum, nasıl başvururum?",
    a: "Üç paketimiz var: Kiosk (24–38 m², €85.000), Bottega (40–80 m², €140.000) ve Salone (90–160 m², €280.000). Başvuru online form ile başlar; ardından Bologna ekibiyle 60 dakikalık video görüşme, Tuzla ziyareti, sözleşme ve Bologna'da 4–8 haftalık eğitimle açılış. Franchise sayfasından detaylı bilgi alabilirsiniz.",
  },
  {
    q: "Çocuk ve evcil hayvan dostu mu?",
    a: "Evet. Açık-hava teras, bebek arabası erişimine uygundur. Çocuk menüsünde kafeinsiz babyccino, fior di latte single scoop ve bombolone alla crema bulunur. Köpekler teras kısmında karşılanır; su kabı ve ev yapımı dog biscuit ikram edilir.",
  },
  {
    q: "Ödeme yöntemleri nelerdir?",
    a: "Nakit, kredi kartı (Visa, Mastercard, Amex), Apple Pay, Google Pay ve banka kartı kabul edilir. Online mağaza için tüm Türk bankaları desteklenir; uluslararası kartlarla EUR ve USD çekimi de yapılabilir.",
  },
];
