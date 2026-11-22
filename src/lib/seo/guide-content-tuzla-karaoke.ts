import type { GuideSource } from "./guide-content";

/**
 * tuzla-karaoke - tuzla karaoke · karaoke tuzla · tuzla karaoke odası ·
 * özel karaoke odası · karaoke odası kiralama · anadolu yakası karaoke.
 *
 * Opened 22 Kas 2026 at the operator's request ("karaokeyi de tuzla için seo
 * geo ve ne gerekiyorsa yap blog yazısı da yaz"). The cluster is NOT yet
 * measured: Semrush was not reachable from the session that wrote it, so
 * docs/SEO.md §3 carries it as "doğrulanmadı" (as magnolia and brownie were)
 * until the volumes are read and recorded there.
 *
 * Every figure is the room's as the panel set it on 22 Kas 2026 (Ayarlar →
 * Karaoke and Mobil → Ayarlar → Karaoke kuralları; public/llms.txt). The
 * booking page always shows the live ones, and the text says so. Nothing
 * about the room's equipment is claimed: the site does not record it.
 */
export const TUZLA_KARAOKE_GUIDE: GuideSource = {
  slug: "tuzla-karaoke",
  title: "Tuzla'da karaoke",
  metaTitle: "Tuzla Karaoke: Özel Karaoke Odası ve Online Rezervasyon",
  metaDescription:
    "Tuzla'da karaoke: 200 yıllık köşkün üst katında 8 kişilik özel oda. Saatler, fiyat, online rezervasyon adımları, iptal kuralı ve ulaşım tek sayfada.",
  excerpt:
    "Tuzla'da, 200 yıllık bir Rum köşkünün üst katında yalnız sizin grubunuza ayrılan karaoke odası. Saatler, kapasite, fiyat, online rezervasyonun adımları, iptal kuralı ve köşke ulaşım.",
  primaryKeyword: "tuzla karaoke",
  keywords: [
    "tuzla karaoke",
    "karaoke tuzla",
    "tuzla karaoke odası",
    "özel karaoke odası",
    "karaoke odası kiralama",
    "karaoke rezervasyon",
    "anadolu yakası karaoke",
    "istanbul karaoke odası",
    "doğum günü karaoke",
    "karaoke odası fiyat",
  ],
  readingMinutes: 6,
  updatedAt: "2026-11-22",
  sections: [
    {
      heading: "Tuzla'da karaoke nerede yapılır?",
      paragraphs: [
        "L'Affogato'nun Tuzla köşkünde: Postane Mahallesi, Atatürk Caddesi No: 28'deki 200 yıllık Rum köşkünün üst katında, yalnız sizin grubunuza ayrılan özel bir karaoke odası var. Oda bir sahne değil; kapıyı kapattığınızda şarkıyı yalnız birlikte geldiğiniz kişiler dinler.",
        "Alt katta kafe devam eder: affogato, matcha ve espresso barı aynı binadadır. Rezervasyonla kullanılan oda yalnız Tuzla köşkündedir; Viaport Marina Tuzla'daki L'Affogato Marina şubesinde karaoke henüz aktif değil ve başladığında rezervasyonla çalışmayacak.",
      ],
    },
    {
      heading: "Saatler, kapasite ve fiyat",
      paragraphs: [
        "Aşağıdaki değerler 22 Kasım 2026 itibarıyla geçerlidir. Köşk bunları panelden değiştirebilir; rezervasyon sayfası her zaman güncel saatleri ve fiyatı gösterir.",
      ],
      table: [
        { key: "Yer", value: "Tuzla köşkü, üst kat" },
        { key: "Saatler", value: "12:00 - 24:00 (son başlangıç 23:00)" },
        { key: "Kapasite", value: "En fazla 8 kişi" },
        { key: "Bir rezervasyonda süre", value: "1 ile 4 saat arası" },
        { key: "Ücret", value: "Saati 1.000₺ (yüzde 20 KDV dahil)" },
        { key: "Üye indirimi", value: "RUBY seviyesindeki üyelere yüzde 15" },
        {
          key: "Ne kadar önceden",
          value: "Sitede önümüzdeki 14 gün, uygulamada 60 güne kadar",
        },
        { key: "Ödeme", value: "Kartla, online; ödeme alınınca kesinleşir" },
      ],
    },
    {
      heading: "Rezervasyon nasıl yapılır? Adım adım",
      paragraphs: [
        "Rezervasyon laffogato.net/karaoke sayfasından ya da L'Affogato uygulamasından yapılır. Üye olmanız gerekmez; hesabınız varsa bilgileriniz kendiliğinden gelir ve rezervasyon hesabınızda görünür.",
      ],
      ordered: [
        "Günü seçin. Bugün ve önümüzdeki günler sayfanın üstünde sıralanır.",
        "Başlangıç saatini seçin. Dolu saatler kapalı görünür, boş olanlar seçilebilir.",
        "Süreyi ve kişi sayısını girin: 1 ile 4 saat, en fazla 8 kişi. Toplam tutar alttaki çubukta güncellenir.",
        "Bilgilerinizi yazın: ad, soyad, cep telefonu ve e-posta. İsterseniz kısa bir not ekleyin.",
        "Özeti kontrol edin, ön bilgilendirme formunu ve sözleşmeyi okuyup onaylayın.",
        "Kartınızla ödeyin. Bankanızın 3D Secure ekranından sonra rezervasyonunuz kesinleşir ve onay e-postası gelir.",
      ],
    },
    {
      heading: "İptal ederseniz ne olur?",
      paragraphs: [
        "Kural rezervasyonu yaptığınız andan başlar: Rezervasyonu yaptığın andan itibaren 2 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir. Rezervasyonu yaptığın andan 2 saat geçtikten sonra yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
        "Köşk bir rezervasyonu kendisi iptal ederse ödenen tutarın tamamı iade edilir. Kuralın güncel hali ve her rezervasyonun kendi son iptal anı rezervasyon sayfasında ve onay e-postasında yazar.",
      ],
    },
    {
      heading: "Kimler için uygun?",
      paragraphs: [
        "Oda en fazla 8 kişiliktir; bu yüzden doğum günü, arkadaş buluşması, iş çıkışı ekip gecesi ya da küçük bir kutlama için uygundur. Daha kalabalık bir grup için rezervasyon yapmadan önce köşkü arayın: +90 536 429 09 19.",
      ],
      bullets: [
        "Doğum günü: saati önceden ayırın, böylece gün geldiğinde boş saat aramazsınız.",
        "Ekip gecesi: akşam saatini birkaç gün önceden seçin; uygun saatleri rezervasyon sayfası canlı gösterir.",
        "Küçük kutlama: 6-8 kişilik bir grup için 2 saat iyi bir başlangıçtır; tek rezervasyonda 4 saate kadar ayırabilirsiniz.",
      ],
    },
    {
      heading: "Karaoke gecesi için birkaç ipucu",
      bullets: [
        "Şarkı listesini önceden paylaşın: odada geçen her dakika seçim yapmakla değil şarkı söylemekle geçsin.",
        "İlk şarkıyı hep birlikte söyleyin; en çekingen kişi de bu sayede ısınır.",
        "Sırayı baştan belirleyin ve ikili şarkılara yer açın.",
        "Rezervasyon saatinden birkaç dakika önce gelin; süre başladığı saatte işler.",
        "Aralarda su için; alt kattaki bar buzlu içeceklerle de hazır.",
      ],
    },
    {
      heading: "Köşke nasıl gelinir?",
      paragraphs: [
        "Köşk Tuzla'nın merkezinde, Postane Mahallesi Atatürk Caddesi No: 28 İç Kapı No: 1'dedir (Menemenci Cumhur'un yanı). Marmaray Tuzla istasyonundan yürüyerek yaklaşık 6 dakika, E-5 ve TEM Tuzla çıkışından 4 dakika, Sabiha Gökçen Havalimanı'ndan 15 dakika uzaklıktadır. Arabayla gelenler için ücretsiz vale hizmeti vardır.",
        'Haritada "L\'Affogato Tuzla" diye aratabilir ya da laffogato.net/ziyaret sayfasındaki yol tarifini açabilirsiniz.',
      ],
    },
  ],
  faq: [
    {
      q: "Tuzla'da karaoke odası nerede?",
      a: "L'Affogato'nun Tuzla köşkünde, Postane Mahallesi Atatürk Caddesi No: 28'deki 200 yıllık Rum köşkünün üst katında. Oda yalnız sizin grubunuza ayrılır.",
    },
    {
      q: "Karaoke odası kaç kişilik?",
      a: "En fazla 8 kişi. Daha kalabalık gruplar rezervasyondan önce köşkü arayabilir: +90 536 429 09 19.",
    },
    {
      q: "Karaoke odasının saatlik ücreti ne kadar?",
      a: "22 Kasım 2026 itibarıyla saati 1.000₺, yüzde 20 KDV dahil. RUBY seviyesindeki üyeler yüzde 15 indirim alır. Güncel fiyat rezervasyon sayfasında yazar.",
    },
    {
      q: "Karaoke odası hangi saatlerde açık?",
      a: "12:00 ile 24:00 arasında; son başlangıç saati 23:00. Bir rezervasyon 1 ile 4 saat arası sürebilir.",
    },
    {
      q: "Rezervasyon için üye olmak gerekiyor mu?",
      a: "Hayır. Ad, soyad, telefon ve e-postanızı yazarak üye olmadan rezervasyon yapabilirsiniz; rezervasyon bağlantısı e-postanıza gelir. Üyeyseniz rezervasyon hesabınızda ve uygulamada da görünür.",
    },
    {
      q: "Rezervasyon ne zaman kesinleşir?",
      a: "Kartla online ödeme alındığında. Ödemeden sonra onay e-postası gelir.",
    },
    {
      q: "İptal edersem param iade edilir mi?",
      a: "Rezervasyonu yaptığın andan itibaren 2 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir. Rezervasyonu yaptığın andan 2 saat geçtikten sonra yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    },
    {
      q: "L'Affogato Marina şubesinde karaoke var mı?",
      a: "Henüz değil. L'Affogato Marina'da karaoke henüz aktif değil; başladığında rezervasyonla çalışmayacak. Rezervasyonla kullanılan özel karaoke odası Tuzla köşkünün üst katındadır ve laffogato.net/karaoke sayfasından ayrılır.",
    },
  ],
  related: ["tuzla-marina-kafe", "affogato-nedir", "espresso-cesitleri"],
  image: {
    src: "/rehber/tuzla-karaoke.webp",
    alt: "L'Affogato'nun Tuzla köşkü gece; karaoke odası köşkün üst katında",
    width: 1200,
    height: 800,
  },
};
