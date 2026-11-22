import type { GuideSource } from "./guide-content";

/**
 * tuzla-marina-kafe - tuzla marina kafe · tuzla marina · viaport marina
 * kafe · l'affogato marina · tuzla sahil kahve.
 *
 * Opened 22 Kas 2026 at the operator's request ("tuzla cafemizin marina
 * şubesi de açıldı onun için de blog yazısı yaz"). Not yet measured in
 * Semrush (docs/SEO.md §3, "doğrulanmadı").
 *
 * Only what the site knows about the branch is said (src/lib/seo/branches.ts
 * MARINA_BRANCH): it opened in November 2026, it is in Tuzla Marina, it is
 * open 10:00 - 23:00 (no days were named, so none are printed). Its unit,
 * postal code and phone are not known yet; the text says so and points at
 * /ziyaret, which fills in the day they are entered. The menu is the köşk's:
 * the branch's till reads it from the site, each branch keeping its own
 * "Tükendi" (CLAUDE.md "Şubeler"). No photograph of the branch exists yet,
 * so the guide has none rather than someone else's picture.
 */
export const TUZLA_MARINA_KAFE_GUIDE: GuideSource = {
  slug: "tuzla-marina-kafe",
  title: "Tuzla Marina'da kahve: L'Affogato Marina",
  metaTitle: "Tuzla Marina Kafe: L'Affogato Marina Şubesi Açıldı",
  metaDescription:
    "L'Affogato Marina, Tuzla Marina'da açıldı. Saatleri, menüsü, Tuzla köşkünden farkı ve köşkte kalanlar: karaoke odası ve uygulamadan gel-al siparişi.",
  excerpt:
    "L'Affogato'nun ikinci şubesi Tuzla Marina'da açıldı. Saatleri, menüsü, Tuzla köşküyle farkları ve hangi hizmetlerin yalnız köşkte olduğu.",
  primaryKeyword: "tuzla marina kafe",
  keywords: [
    "tuzla marina kafe",
    "tuzla marina",
    "viaport marina kafe",
    "tuzla marina kahve",
    "l'affogato marina",
    "tuzla sahil kafe",
    "tuzla affogato",
    "tuzla kahveci",
  ],
  readingMinutes: 4,
  updatedAt: "2026-11-22",
  sections: [
    {
      heading: "L'Affogato Marina nerede?",
      paragraphs: [
        "L'Affogato'nun ikinci şubesi L'Affogato Marina, Kasım 2026'da Tuzla Marina'da açıldı. Tuzla Marina, Viaport Marina Tuzla adıyla da bilinir ve İstanbul'un Anadolu yakasında, Tuzla sahilindedir.",
        'Marina içindeki tam birim, posta kodu ve şubenin telefon numarası henüz yayımlanmadı. Bunlar girildiği gün laffogato.net/ziyaret sayfasındaki Marina kartında görünür; o zamana kadar haritada "Tuzla Marina" diye aratabilirsiniz.',
      ],
    },
    {
      heading: "Saatler",
      paragraphs: [
        "L'Affogato Marina 10:00 ile 23:00 arasında açıktır. Tuzla köşkü ise 09:00'da açılır ve gece 02:00'ye kadar hizmet verir; gece geç saatte gelecekseniz köşkü tercih edin.",
      ],
      table: [
        { key: "L'Affogato Marina", value: "10:00 - 23:00" },
        { key: "Tuzla köşkü", value: "09:00 - 02:00" },
      ],
    },
    {
      heading: "Menüde neler var?",
      paragraphs: [
        "Marina, Tuzla köşküyle aynı menüden servis eder: espresso bazlı kahveler, matcha bar, soğuk kahveler, frappe, smoothie, tatlılar ve gelato. Menüdeki her kalemin fiyatı iki şubede aynı kaynaktan gelir.",
        "Bir ürünün o gün tükenmesi şubeye göre değişebilir: köşkte bitmiş bir tatlı Marina'da olabilir ya da tersi. Güncel menü ve fiyatlar laffogato.net/menu sayfasındadır.",
      ],
    },
    {
      heading: "Hangi hizmetler yalnız Tuzla köşkünde?",
      bullets: [
        "Karaoke odası: köşkün üst katındadır; Marina'da karaoke yoktur.",
        "Uygulamadan gel-al siparişi: uygulamada verilen gel-al siparişleri Tuzla köşkünde hazırlanır.",
        "Online mağaza siparişleri ve kargo: laffogato.net/magaza üzerinden, şubeden bağımsızdır.",
      ],
      paragraphs: [
        "Marina'da kafede oturmak ya da bir şey almak için rezervasyon ya da üyelik gerekmez. Aşağıdakiler ise yalnız Tuzla köşkündedir:",
      ],
    },
    {
      heading: "Köşk mü, Marina mı?",
      paragraphs: [
        "İkisi aynı mutfağın iki adresidir. Seçim çoğu zaman günün planına göre yapılır.",
      ],
      bullets: [
        "Tuzla köşkü: Postane Mahallesi'nde 200 yıllık bir Rum köşkü, bahçe terası, gece 02:00'ye kadar açık, üst katta karaoke odası. Marmaray Tuzla'ya yürüyerek yaklaşık 6 dakika.",
        "L'Affogato Marina: Tuzla Marina'da, 10:00 - 23:00 arası açık. Marinada yürüyüş ya da tekne gününün devamında kahve ve affogato için.",
      ],
    },
  ],
  faq: [
    {
      q: "L'Affogato Marina nerede?",
      a: "Tuzla Marina'da (Viaport Marina Tuzla), İstanbul'un Anadolu yakasında Tuzla sahilinde. Marina içindeki tam birim henüz yayımlanmadı; girildiğinde laffogato.net/ziyaret sayfasında görünür.",
    },
    {
      q: "L'Affogato Marina kaçta açılıyor, kaçta kapanıyor?",
      a: "10:00'da açılır, 23:00'te kapanır.",
    },
    {
      q: "Marina şubesinin menüsü Tuzla köşküyle aynı mı?",
      a: "Evet, iki şube aynı menüden servis eder. Bir ürünün o gün tükenmesi şubeye göre değişebilir.",
    },
    {
      q: "Marina'da karaoke var mı?",
      a: "Hayır. Karaoke odası yalnız Tuzla köşkünün üst katındadır; rezervasyon laffogato.net/karaoke sayfasından yapılır.",
    },
    {
      q: "Uygulamadan Marina'ya gel-al sipariş verebilir miyim?",
      a: "Hayır. Uygulamadan verilen gel-al siparişleri Tuzla köşkünde hazırlanır.",
    },
    {
      q: "L'Affogato Marina'nın telefon numarası nedir?",
      a: "Şubenin numarası henüz yayımlanmadı. O zamana kadar L'Affogato'ya +90 536 429 09 19 numarasından ulaşabilirsiniz.",
    },
  ],
  related: ["tuzla-karaoke", "affogato-nedir", "yenilebilir-kahve-fincani"],
};
