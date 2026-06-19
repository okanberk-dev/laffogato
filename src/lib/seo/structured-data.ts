/**
 * JSON-LD structured data generators.
 *
 * Bundled into a single @graph emitted at `/`. Currently produces:
 *  - Organization (corporate identity, Italy parent)
 *  - CafeOrCoffeeShop + Restaurant (LocalBusiness for Maps/local SEO)
 *  - WebSite (with SearchAction for sitelinks)
 *  - BreadcrumbList
 *  - Menu + MenuSection + MenuItem (live from admin store)
 *  - Product (one per shop SKU — with image, brand, sku, full offer,
 *    shipping policy, return policy)
 *  - FAQPage
 *  - AboutPage (story/heritage timeline)
 *  - HowTo (how an affogato is made)
 *  - Service (franchise model)
 *  - Offer × 3 (Kiosk / Bottega / Salone franchise packages)
 *  - SpeakableSpecification (for voice assistants)
 *
 * All generators return plain JSON-serializable objects; consumer wraps in
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 */

import { FAQ, type FaqEntry } from "./faq";
import { SITE } from "./site";
import { FRANCHISE, STORY, type MenuCategory, type Product } from "@/components/laffogato/data";

type Json = Record<string, unknown>;

function priceToMinor(price: string): { amount: string; currency: string } {
  const cleaned = price.replace(/[^\d.,]/g, "").replace(",", ".");
  return { amount: cleaned || "0", currency: "TRY" };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function eurAmount(s: string): { amount: string; currency: string } {
  const cleaned = s.replace(/[^\d]/g, "");
  return { amount: cleaned || "0", currency: "EUR" };
}

const PRICE_VALID_UNTIL = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
})();

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.legalName,
    alternateName: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE.url}/icon.png`,
      width: 512,
      height: 512,
    },
    image: `${SITE.url}${SITE.ogImage}`,
    description: SITE.shortDescription,
    foundingDate: SITE.founded,
    foundingLocation: {
      "@type": "Place",
      name: "Italia",
      address: SITE.parent.address,
    },
    founder: {
      "@type": "Person",
      name: "Giancarlo Mancuso",
    },
    sameAs: [SITE.social.instagram, SITE.social.tiktok, SITE.social.youtube],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SITE.phoneE164,
        email: SITE.email,
        contactType: "customer service",
        areaServed: "TR",
        availableLanguage: ["Turkish", "English", "Italian"],
      },
      {
        "@type": "ContactPoint",
        email: "franchise@laffogato.it",
        contactType: "franchise inquiries",
        areaServed: ["TR", "EU"],
        availableLanguage: ["Turkish", "English", "Italian"],
      },
    ],
    knowsAbout: [
      "Italian coffee",
      "Gelato",
      "Affogato",
      "Edible cup",
      "Matcha",
      "Espresso roasting",
    ],
  };
}

export function localBusinessLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": ["CafeOrCoffeeShop", "Restaurant"],
    "@id": `${SITE.url}/#localbusiness`,
    name: `${SITE.name} — Tuzla`,
    image: [`${SITE.url}${SITE.ogImage}`],
    logo: `${SITE.url}/icon.png`,
    url: SITE.url,
    telephone: SITE.phoneE164,
    email: SITE.email,
    priceRange: SITE.priceRange,
    description: SITE.longDescription,
    servesCuisine: [...SITE.cuisine],
    paymentAccepted: SITE.paymentAccepted.join(", "),
    currenciesAccepted: SITE.currencies.join(", "),
    acceptsReservations: true,
    smokingAllowed: false,
    publicAccess: true,
    isAccessibleForFree: true,
    keywords: SITE.keywords.slice(0, 10).join(", "),
    slogan: SITE.tagline,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.streetAddress,
      addressLocality: SITE.address.addressLocality,
      addressRegion: SITE.address.addressRegion,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE.geo.latitude,
      longitude: SITE.geo.longitude,
    },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${SITE.geo.latitude},${SITE.geo.longitude}`,
    openingHoursSpecification: SITE.openingHours.map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: slot.days.map((d) => {
        const map: Record<string, string> = {
          Mo: "Monday",
          Tu: "Tuesday",
          We: "Wednesday",
          Th: "Thursday",
          Fr: "Friday",
          Sa: "Saturday",
          Su: "Sunday",
        };
        return map[d] ?? d;
      }),
      opens: slot.opens,
      closes: slot.closes === "24:00" ? "00:00" : slot.closes,
    })),
    parentOrganization: { "@id": `${SITE.url}/#organization` },
    areaServed: { "@type": "City", name: "İstanbul" },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Tarihi Rum köşkü", value: true },
      { "@type": "LocationFeatureSpecification", name: "Ücretsiz Wi-Fi", value: true },
      { "@type": "LocationFeatureSpecification", name: "Vale park", value: true },
      { "@type": "LocationFeatureSpecification", name: "Evcil hayvan dostu", value: true },
      { "@type": "LocationFeatureSpecification", name: "Vegan seçenek", value: true },
      { "@type": "LocationFeatureSpecification", name: "Bebek arabası erişimi", value: true },
      { "@type": "LocationFeatureSpecification", name: "Glutensiz seçenek", value: true },
      { "@type": "LocationFeatureSpecification", name: "Çocuk menüsü", value: true },
    ],
    publicTransitClosestStop: [
      "Marmaray Tuzla (6 dk)",
      "Sabiha Gökçen Havalimanı (15 dk)",
    ],
    hasOfferCatalog: { "@id": `${SITE.url}/#menu` },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Heritage",
        value: "Bologna 1987",
      },
      {
        "@type": "PropertyValue",
        name: "Signature",
        value: "Edible waffle cup affogato",
      },
    ],
  };
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.shortDescription,
    inLanguage: SITE.locale,
    publisher: { "@id": `${SITE.url}/#organization` },
    copyrightYear: 2026,
    copyrightHolder: { "@id": `${SITE.url}/#organization` },
    potentialAction: [
      {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
      {
        "@type": "ReserveAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/#visit`,
          actionPlatform: [
            "http://schema.org/DesktopWebPlatform",
            "http://schema.org/MobileWebPlatform",
          ],
        },
        result: { "@type": "FoodEstablishmentReservation" },
      },
    ],
  };
}

export function breadcrumbLd(
  items: Array<{ name: string; url: string }>,
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${SITE.url}/#breadcrumbs`,
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${SITE.url}${it.url}`,
    })),
  };
}

export function menuLd(menu: Record<string, MenuCategory>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${SITE.url}/#menu`,
    name: `${SITE.name} Menü`,
    inLanguage: SITE.locale,
    hasMenuSection: Object.entries(menu).map(([key, cat]) => ({
      "@type": "MenuSection",
      "@id": `${SITE.url}/#menu-${key}`,
      name: cat.title,
      description: cat.note,
      hasMenuItem: cat.items.map((item) => {
        const { amount, currency } = priceToMinor(item.price);
        const tags = item.tags ?? [];
        const diet: string[] = [];
        if (tags.includes("vegan opt.")) diet.push("https://schema.org/VeganDiet");
        return {
          "@type": "MenuItem",
          name: item.name,
          description: item.desc,
          offers: {
            "@type": "Offer",
            price: amount,
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
          },
          ...(diet.length ? { suitableForDiet: diet } : {}),
        };
      }),
    })),
  };
}

export function productListLd(products: Product[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE.url}/#products`,
    name: `${SITE.name} Mağaza`,
    description: "L'Affogato online mağaza — çekirdek kahve, edible cup, ekipman, hediye seti, giyim.",
    numberOfItems: products.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: products.map((p, idx) => {
      const { amount, currency } = priceToMinor(p.price);
      const compareAt = p.compareAtPrice ? priceToMinor(p.compareAtPrice) : null;
      const slug = slugify(p.name);
      const productId = `${SITE.url}/#product-${slug}`;
      return {
        "@type": "ListItem",
        position: idx + 1,
        url: `${SITE.url}/#shop`,
        item: {
          "@type": "Product",
          "@id": productId,
          name: p.name,
          description: p.desc,
          category: p.cat,
          sku: `LAF-${slug.toUpperCase().slice(0, 20)}`,
          mpn: `LAF-${slug.toUpperCase().slice(0, 20)}`,
          brand: { "@type": "Brand", name: SITE.name, "@id": `${SITE.url}/#organization` },
          manufacturer: { "@id": `${SITE.url}/#organization` },
          image: `${SITE.url}${SITE.ogImage}`,
          url: `${SITE.url}/#shop`,
          inLanguage: SITE.locale,
          offers: {
            "@type": "Offer",
            "@id": `${productId}-offer`,
            price: amount,
            priceCurrency: currency,
            priceValidUntil: PRICE_VALID_UNTIL,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `${SITE.url}/#shop`,
            seller: { "@id": `${SITE.url}/#organization` },
            ...(compareAt
              ? {
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: amount,
                    priceCurrency: currency,
                  },
                }
              : {}),
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: {
                "@type": "MonetaryAmount",
                value: "29",
                currency: "TRY",
              },
              shippingDestination: {
                "@type": "DefinedRegion",
                addressCountry: "TR",
              },
              deliveryTime: {
                "@type": "ShippingDeliveryTime",
                handlingTime: {
                  "@type": "QuantitativeValue",
                  minValue: 0,
                  maxValue: 1,
                  unitCode: "DAY",
                },
                transitTime: {
                  "@type": "QuantitativeValue",
                  minValue: 1,
                  maxValue: 3,
                  unitCode: "DAY",
                },
              },
            },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "TR",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 14,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: "https://schema.org/FreeReturn",
            },
          },
          additionalProperty: [
            { "@type": "PropertyValue", name: "tag", value: p.tag },
            ...(p.featured ? [{ "@type": "PropertyValue", name: "featured", value: "true" }] : []),
            ...(p.isNew ? [{ "@type": "PropertyValue", name: "isNew", value: "true" }] : []),
          ],
        },
      };
    }),
  };
}

/**
 * Single-product JSON-LD for the PDP. Mirrors the offer/shipping/return shape
 * used by productListLd but for one product, with a stable canonical URL.
 */
export function singleProductLd(p: Product, canonicalPath: string): Json {
  const { amount, currency } = priceToMinor(p.price);
  const compareAt = p.compareAtPrice ? priceToMinor(p.compareAtPrice) : null;
  const slug = p.slug ?? slugify(p.name);
  const url = `${SITE.url}${canonicalPath}`;
  const productId = `${url}#product`;
  const image =
    p.images && p.images.length > 0 && /^https?:\/\//i.test(p.images[0])
      ? p.images[0]
      : `${SITE.url}${SITE.ogImage}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": productId,
    name: p.name,
    description: p.desc,
    category: p.cat,
    sku: p.sku || `LAF-${slug.toUpperCase().slice(0, 20)}`,
    mpn: p.sku || `LAF-${slug.toUpperCase().slice(0, 20)}`,
    brand: { "@type": "Brand", name: SITE.name, "@id": `${SITE.url}/#organization` },
    image,
    url,
    inLanguage: SITE.locale,
    ...(p.weightGrams
      ? { weight: { "@type": "QuantitativeValue", value: p.weightGrams, unitCode: "GRM" } }
      : {}),
    offers: {
      "@type": "Offer",
      "@id": `${productId}-offer`,
      price: amount,
      priceCurrency: currency,
      priceValidUntil: PRICE_VALID_UNTIL,
      availability:
        p.stock !== undefined && p.stock <= 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url,
      seller: { "@id": `${SITE.url}/#organization` },
      ...(compareAt
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: amount,
              priceCurrency: currency,
            },
          }
        : {}),
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "49", currency: "TRY" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };
}

export function faqLd(entries: FaqEntry[] = FAQ): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
    inLanguage: SITE.locale,
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.a,
      },
    })),
  };
}

export function aboutPageLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE.url}/#about`,
    url: `${SITE.url}/#story`,
    name: `${SITE.name} — Hikayemiz`,
    inLanguage: SITE.locale,
    description:
      "1987'den 2026'ya L'Affogato'nun İtalya'dan İstanbul'a uzanan üç kuşaklık hikayesi.",
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@id": `${SITE.url}/#organization` },
    mainEntity: {
      "@type": "Person",
      name: STORY.founder.name,
      jobTitle: STORY.founder.role,
      description: STORY.founder.bio,
      worksFor: { "@id": `${SITE.url}/#organization` },
    },
    hasPart: STORY.heritage.map((h) => ({
      "@type": "Event",
      name: h.t,
      description: h.d,
      startDate: h.y,
      location: { "@id": `${SITE.url}/#localbusiness` },
    })),
  };
}

export function howToAffogatoLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${SITE.url}/#howto-affogato`,
    name: "Klasik Affogato nasıl yapılır?",
    description:
      "L'Affogato'nun 1987'den beri uyguladığı orijinal affogato tarifi: tek scoop fior di latte gelato üzerine çift shot Sirena espresso, yenilebilir waffle kup içinde.",
    inLanguage: SITE.locale,
    totalTime: "PT2M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "TRY",
      value: "130",
    },
    tool: [
      { "@type": "HowToTool", name: "Espresso makinesi" },
      { "@type": "HowToTool", name: "Gelato kaşığı" },
      { "@type": "HowToTool", name: "Yenilebilir waffle kup" },
    ],
    supply: [
      { "@type": "HowToSupply", name: "Sirena espresso harmanı, 18g" },
      { "@type": "HowToSupply", name: "Fior di latte gelato, 1 scoop" },
    ],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Espresso çek",
        text: "18g öğütülmüş Sirena harmanından 27 saniyede 36g espresso çek. Doppio shot olarak sıcak servise hazırla.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Gelato kupayı hazırla",
        text: "Yenilebilir waffle kupun içine tek scoop fior di latte gelato yerleştir. Gelato kupanın hizasının 1cm üstüne çıkmalı.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Espresso'yu üzerine dök",
        text: "Sıcak espresso'yu gelatonun üzerine sirkül hareketle dök. Espresso gelatoyu \"boğar\" — affogato'nun adı buradan gelir.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Hemen tüket",
        text: "30 saniye içinde tüket: erimiş gelato + sıcak espresso içeren içeceği iç, sonra çıtırlığını koruyan waffle kupu ye. Kaşığa gerek yok.",
      },
    ],
    image: `${SITE.url}${SITE.ogImage}`,
  };
}

export function franchiseServiceLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${SITE.url}/#franchise`,
    name: "L'Affogato Franchise",
    description: FRANCHISE.pitch,
    serviceType: "Franchise",
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: [
      { "@type": "Country", name: "Türkiye" },
      { "@type": "Country", name: "İtalya" },
      { "@type": "AdministrativeArea", name: "European Union" },
    ],
    inLanguage: SITE.locale,
    offers: FRANCHISE.packages.map((pkg) => {
      const investment = eurAmount(pkg.invest);
      const monthly = eurAmount(pkg.monthly);
      const priceSpecification: Json[] = [];
      if (investment.amount !== "0") {
        priceSpecification.push({
          "@type": "PriceSpecification",
          name: "Başlangıç yatırımı",
          price: investment.amount,
          priceCurrency: investment.currency,
        });
      }
      if (monthly.amount !== "0") {
        priceSpecification.push({
          "@type": "UnitPriceSpecification",
          name: "Aylık franchise ücreti",
          price: monthly.amount,
          priceCurrency: monthly.currency,
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: 1,
            unitCode: "MON",
          },
        });
      }
      return {
        "@type": "Offer",
        "@id": `${SITE.url}/#franchise-${slugify(pkg.name)}`,
        name: `Franchise — ${pkg.name}`,
        description: `${pkg.area}, ${pkg.seats} koltuk. İdeal: ${pkg.ideal}. Dahil: ${pkg.includes.join(", ")}.`,
        ...(priceSpecification.length ? { priceSpecification } : {}),
        availability: "https://schema.org/InStock",
        seller: { "@id": `${SITE.url}/#organization` },
        eligibleRegion: [
          { "@type": "Country", name: "Türkiye" },
          { "@type": "Country", name: "İtalya" },
        ],
      };
    }),
  };
}

export function speakableLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE.url}/#speakable`,
    url: SITE.url,
    name: SITE.brand,
    isPartOf: { "@id": `${SITE.url}/#website` },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#sss-heading", "#sss"],
      xpath: [
        "//*[@id='sss-heading']",
        "//*[@id='sss']//details//summary",
      ],
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${SITE.url}${SITE.ogImage}`,
    },
    about: { "@id": `${SITE.url}/#organization` },
  };
}

/**
 * Bundle every site-wide structured data block into one @graph so we emit a
 * single <script> tag instead of a dozen.
 */
export function siteGraphLd(
  menu: Record<string, MenuCategory>,
  products: Product[],
): Json {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(),
      localBusinessLd(),
      websiteLd(),
      menuLd(menu),
      productListLd(products),
      faqLd(),
      aboutPageLd(),
      howToAffogatoLd(),
      franchiseServiceLd(),
      speakableLd(),
      breadcrumbLd([
        { name: "Ana Sayfa", url: "/" },
        { name: "Menü", url: "/#menu" },
        { name: "Mağaza", url: "/#shop" },
        { name: "Hikaye", url: "/#story" },
        { name: "Ziyaret · Tuzla", url: "/#visit" },
        { name: "Reels", url: "/#reels" },
        { name: "Franchise", url: "/#franchise" },
      ]),
    ],
  };
}
