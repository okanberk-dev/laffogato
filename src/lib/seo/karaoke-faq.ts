import { priceLabel } from "@/lib/utils/format";

import { SITE } from "./site";

/**
 * The karaoke page's questions and its structured data (operator, 22 Kas
 * 2026: "karaokeyi de tuzla için seo geo ve ne gerekiyorsa yap").
 *
 * Every figure is the panel's, read by the page it is printed on: the room's
 * size and price (Ayarlar → Karaoke), its hours, longest booking and the top
 * tier's discount (Mobil → Ayarlar → Karaoke kuralları), whether it is paid
 * online, and the two cancellation sentences a booking made now gets. The
 * answers are shown on the page as well as in the JSON-LD (Google reads only
 * questions the visitor can see), and they are what an assistant quotes when
 * asked about karaoke in Tuzla, so nothing here is written by hand that the
 * panel can change.
 */
export interface KaraokeFaqFacts {
  capacity: number;
  hourlyMinor: number;
  firstHour: number;
  closeHour: number;
  maxHours: number;
  /** Paid online and confirmed at once (`settings.karaokePrepay`). */
  prepay: boolean;
  /** The top tier's discount in percent; 0 = none. */
  topTierDiscountPct: number;
  /** The top tier's name ("RUBY"). */
  topTierLabel: string;
  /** The two sentences a booking made now gets (karaokeCancellationRules). */
  cancellationRules: readonly string[];
}

export interface KaraokeFaqEntry {
  q: string;
  a: string;
}

/** `24` → "24:00". */
function clock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function karaokeFaq(f: KaraokeFaqFacts): KaraokeFaqEntry[] {
  const price = priceLabel(f.hourlyMinor);
  const discount =
    f.topTierDiscountPct > 0
      ? ` ${f.topTierLabel} seviyesindeki üyeler yüzde ${f.topTierDiscountPct} indirim alır.`
      : "";
  const entries: KaraokeFaqEntry[] = [
    {
      q: "Tuzla'da karaoke odası nerede?",
      a: `L'Affogato'nun Tuzla köşkünde: ${SITE.address.streetAddress}, ${SITE.address.postalCode} ${SITE.address.addressLocality} / ${SITE.address.addressRegion}. Oda 200 yıllık Rum köşkünün üst katındadır ve yalnız sizin grubunuza ayrılır.`,
    },
    {
      q: "Karaoke odası kaç kişilik, saati ne kadar?",
      a: `En fazla ${f.capacity} kişi. Saati ${price}, KDV dahil.${discount}`,
    },
    {
      q: "Hangi saatlerde rezervasyon yapılır?",
      a: `${clock(f.firstHour)} ile ${clock(f.closeHour)} arasında; son başlangıç ${clock(f.closeHour - 1)}. Bir rezervasyon 1 ile ${f.maxHours} saat sürebilir.`,
    },
    {
      q: "Rezervasyon nasıl kesinleşir?",
      a: f.prepay
        ? "Günü, saati, süreyi ve kişi sayısını seçip bilgilerinizi yazdıktan sonra kartla online ödersiniz; ödeme alındığında rezervasyon kesinleşir ve onay e-postası gelir."
        : "Günü, saati, süreyi ve kişi sayısını seçip isteğinizi gönderirsiniz; ekip onaylayınca haber verilir, ödeme köşkte yapılır.",
    },
    {
      q: "Üye olmadan rezervasyon yapılabilir mi?",
      a: "Evet. Ad, soyad, telefon ve e-postanızı yazmanız yeterli; rezervasyon bağlantısı e-postanıza gelir. Üyeyseniz rezervasyon hesabınızda ve uygulamada da görünür.",
    },
  ];
  if (f.prepay && f.cancellationRules.length > 0) {
    entries.push({
      q: "İptal edersem ücret iade edilir mi?",
      a: f.cancellationRules.join(" "),
    });
  }
  entries.push({
    q: "L'Affogato Marina şubesinde karaoke var mı?",
    a: "Henüz değil. L'Affogato Marina'da karaoke henüz aktif değil; başladığında rezervasyonla çalışmayacak. Rezervasyonla kullanılan özel karaoke odası Tuzla köşkünün üst katındadır ve laffogato.net/karaoke sayfasından ayrılır.",
  });
  return entries;
}

/**
 * The room as a bookable service of the köşk, and the page's questions.
 * `provider` points at the köşk's LocalBusiness on the home page
 * (structured-data.ts `#localbusiness`).
 */
export function karaokeLd(
  f: KaraokeFaqFacts,
  faq: readonly KaraokeFaqEntry[],
): Record<string, unknown> {
  const price = (f.hourlyMinor / 100).toFixed(2);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${SITE.url}/karaoke#service`,
        name: "Karaoke odası - L'Affogato Tuzla",
        serviceType: "Özel karaoke odası",
        description: `Tuzla'da, 200 yıllık Rum köşkünün üst katında en fazla ${f.capacity} kişilik özel karaoke odası. ${clock(f.firstHour)} - ${clock(f.closeHour)} arası, saatlik rezervasyonla.`,
        url: `${SITE.url}/karaoke`,
        provider: { "@id": `${SITE.url}/#localbusiness` },
        areaServed: { "@type": "City", name: "Tuzla, İstanbul" },
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: `${SITE.url}/karaoke`,
        },
        offers: {
          "@type": "Offer",
          url: `${SITE.url}/karaoke`,
          price,
          priceCurrency: "TRY",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price,
            priceCurrency: "TRY",
            unitCode: "HUR",
            unitText: "saat",
            valueAddedTaxIncluded: true,
          },
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE.url}/karaoke#faq`,
        inLanguage: "tr-TR",
        mainEntity: faq.map((e) => ({
          "@type": "Question",
          name: e.q,
          acceptedAnswer: { "@type": "Answer", text: e.a },
        })),
      },
    ],
  };
}
