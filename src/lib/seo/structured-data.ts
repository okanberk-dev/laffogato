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
 *  - SpeakableSpecification (for voice assistants)
 *
 * All generators return plain JSON-serializable objects; consumer wraps in
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 */

import { FAQ, type FaqEntry } from "./faq";
import { SITE } from "./site";
import {
  STORY,
  type MenuCategory,
  type Product,
} from "@/components/laffogato/data";
import { LEGAL_ENTITY, LEGAL_ADDRESS_LINE } from "@/lib/legal/entity";

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

const PRICE_VALID_UNTIL = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
})();

function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    alternateName: [SITE.tradeName, LEGAL_ENTITY.shortName],
    // Ticaret sicilindeki tüzel kişi — vergi levhası ile doğrulandı.
    legalName: LEGAL_ENTITY.legalName,
    taxID: LEGAL_ENTITY.taxNo,
    vatID: LEGAL_ENTITY.taxNo,
    ...(LEGAL_ENTITY.mersisNo
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "MERSİS",
            value: LEGAL_ENTITY.mersisNo,
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: LEGAL_ENTITY.address.line1,
      addressLocality: LEGAL_ENTITY.address.district,
      addressRegion: LEGAL_ENTITY.address.city,
      addressCountry: "TR",
      name: LEGAL_ADDRESS_LINE,
    },
    url: SITE.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE.url}/icon-512.png`,
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
    sameAs: [
      SITE.social.instagram,
      SITE.social.tiktok,
      SITE.social.youtube,
      SITE.social.x,
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SITE.phoneE164,
        email: SITE.email,
        contactType: "customer service",
        areaServed: "TR",
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
    logo: `${SITE.url}/icon-512.png`,
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
    sameAs: [
      SITE.social.instagram,
      SITE.social.tiktok,
      SITE.social.youtube,
      SITE.social.x,
    ],
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
      // schema.org Time has no "24:00"; map midnight-close to "23:59" so the
      // slot reads as open-till-late, not "closes at 00:00" (= closed).
      closes: slot.closes === "24:00" ? "23:59" : slot.closes,
    })),
    parentOrganization: { "@id": `${SITE.url}/#organization` },
    areaServed: { "@type": "City", name: "İstanbul" },
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Tarihi Rum köşkü",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Ücretsiz Wi-Fi",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Vale park",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Evcil hayvan dostu",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Vegan seçenek",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Bebek arabası erişimi",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Glutensiz seçenek",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Çocuk menüsü",
        value: true,
      },
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

function websiteLd(): Json {
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
        "@type": "ReserveAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE.url}/ziyaret`,
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
        if (tags.includes("vegan opt."))
          diet.push("https://schema.org/VeganDiet");
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

function productListLd(products: Product[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE.url}/#products`,
    name: `${SITE.name} Mağaza`,
    description:
      "L'Affogato online mağaza — çekirdek kahve, edible cup, ekipman, hediye seti, giyim.",
    numberOfItems: products.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: products.map((p, idx) => {
      const { amount, currency } = priceToMinor(p.price);
      const compareAt = p.compareAtPrice
        ? priceToMinor(p.compareAtPrice)
        : null;
      const slug = p.slug ?? slugify(p.name);
      const productId = `${SITE.url}/#product-${slug}`;
      const pdpUrl = `${SITE.url}/magaza/urun/${slug}`;
      const image =
        p.images && p.images.length > 0 && /^https?:\/\//i.test(p.images[0])
          ? p.images[0]
          : `${SITE.url}${SITE.ogImage}`;
      return {
        "@type": "ListItem",
        position: idx + 1,
        url: pdpUrl,
        item: {
          "@type": "Product",
          "@id": productId,
          name: p.name,
          description: p.desc,
          category: p.cat,
          sku: `LAF-${slug.toUpperCase().slice(0, 20)}`,
          mpn: `LAF-${slug.toUpperCase().slice(0, 20)}`,
          brand: {
            "@type": "Brand",
            name: SITE.name,
            "@id": `${SITE.url}/#organization`,
          },
          manufacturer: { "@id": `${SITE.url}/#organization` },
          image,
          url: pdpUrl,
          inLanguage: SITE.locale,
          offers: {
            "@type": "Offer",
            "@id": `${productId}-offer`,
            price: amount,
            priceCurrency: currency,
            priceValidUntil: PRICE_VALID_UNTIL,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            url: pdpUrl,
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
              returnPolicyCategory:
                "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 14,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: "https://schema.org/FreeReturn",
            },
          },
          additionalProperty: [
            { "@type": "PropertyValue", name: "tag", value: p.tag },
            ...(p.featured
              ? [{ "@type": "PropertyValue", name: "featured", value: "true" }]
              : []),
            ...(p.isNew
              ? [{ "@type": "PropertyValue", name: "isNew", value: "true" }]
              : []),
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
    brand: {
      "@type": "Brand",
      name: SITE.name,
      "@id": `${SITE.url}/#organization`,
    },
    image,
    url,
    inLanguage: SITE.locale,
    ...(p.weightGrams
      ? {
          weight: {
            "@type": "QuantitativeValue",
            value: p.weightGrams,
            unitCode: "GRM",
          },
        }
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
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "49",
          currency: "TRY",
        },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
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
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };
}

function faqLd(entries: FaqEntry[] = FAQ): Json {
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

function aboutPageLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE.url}/#about`,
    url: `${SITE.url}/hikayemiz`,
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

function howToAffogatoLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${SITE.url}/#howto-affogato`,
    name: "L'Affogato nasıl yapılır?",
    description:
      "Evin imza içeceği: bir top dondurma üzerine taze çekilmiş sıcak espresso. İki dakikada hazırlanır, hemen tüketilir.",
    inLanguage: SITE.locale,
    totalTime: "PT2M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "TRY",
      value: "280",
    },
    tool: [
      { "@type": "HowToTool", name: "Espresso makinesi" },
      { "@type": "HowToTool", name: "Dondurma kaşığı" },
      { "@type": "HowToTool", name: "Servis bardağı" },
    ],
    supply: [
      { "@type": "HowToSupply", name: "Espresso harmanı, 18g" },
      { "@type": "HowToSupply", name: "Sade dondurma, 1 top" },
    ],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Espresso çek",
        text: "18g öğütülmüş espresso harmanından yaklaşık 27 saniyede 36g espresso çek. Doppio shot olarak sıcak servise hazırla.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Dondurmayı hazırla",
        text: "Servis bardağına bir top sade dondurma yerleştir. Dondurma bardağın hizasının 1cm üstüne çıkmalı.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Espresso'yu üzerine dök",
        text: "Sıcak espresso'yu dondurmanın üzerine sirküler hareketle dök. Espresso dondurmayı \"boğar\" — affogato'nun adı buradan gelir.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Hemen tüket",
        text: "Birkaç dakika içinde tüket: erimiş dondurma ile sıcak espressonun kontrastı, karışım tamamen soğumadan en iyi tadı verir.",
      },
    ],
    image: `${SITE.url}${SITE.ogImage}`,
  };
}

function speakableLd(): Json {
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
      xpath: ["//*[@id='sss-heading']", "//*[@id='sss']//details//summary"],
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
/**
 * The primary navigation, as `SiteNavigationElement`.
 *
 * This is what the home page actually wanted to say — "these are my main
 * sections" — and it is the type search engines read for sitelinks. It is not
 * a breadcrumb, which is a path to a single page.
 */
export function siteNavigationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE.url}/#navigation`,
    name: `${SITE.name} — bölümler`,
    itemListElement: [
      { name: "Menü", url: "/menu" },
      { name: "Mağaza", url: "/magaza" },
      { name: "Rehber", url: "/rehber" },
      { name: "Hikaye", url: "/hikayemiz" },
      { name: "Ziyaret · Tuzla", url: "/ziyaret" },
    ].map((it, idx) => ({
      "@type": "SiteNavigationElement",
      position: idx + 1,
      name: it.name,
      url: `${SITE.url}${it.url}`,
    })),
  };
}

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
      speakableLd(),
      // No BreadcrumbList here. A BreadcrumbList is the path from the root to
      // *this* page; the home page is the root, so it has no trail. Listing the
      // sections here published "Ana Sayfa › Menü › Mağaza › Hikaye › Ziyaret"
      // as if it were one path, which is not what any of those pages are.
      // Section pages emit their own two-step trail via `breadcrumbLd`.
      siteNavigationLd(),
    ],
  };
}
