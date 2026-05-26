/**
 * JSON-LD structured data generators.
 *
 * Schema.org types emitted:
 *  - Organization (corporate identity)
 *  - CafeOrCoffeeShop / Restaurant (LocalBusiness subtype for Maps/local SEO)
 *  - WebSite (with SearchAction for sitelinks)
 *  - BreadcrumbList (one per logical section)
 *  - Menu + MenuSection + MenuItem (rich menu cards)
 *  - Product (one per shop SKU)
 *  - FAQPage (rich Q&A snippet)
 *
 * Output is plain JSON-serializable objects; consumer wraps in
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 */

import { FAQ, type FaqEntry } from "./faq";
import { SITE } from "./site";
import type { MenuCategory, Product } from "@/components/laffogato/data";

type Json = Record<string, unknown>;

function priceToMinor(price: string): { amount: string; currency: string } {
  // "130₺" → { amount: "130", currency: "TRY" }
  const cleaned = price.replace(/[^\d.,]/g, "").replace(",", ".");
  return { amount: cleaned || "0", currency: "TRY" };
}

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.legalName,
    alternateName: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon.png`,
    image: `${SITE.url}${SITE.ogImage}`,
    description: SITE.shortDescription,
    foundingDate: SITE.founded,
    foundingLocation: {
      "@type": "Place",
      name: "Bologna, Italia",
      address: SITE.parent.address,
    },
    sameAs: [SITE.social.instagram, SITE.social.tiktok, SITE.social.youtube],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SITE.phoneE164,
      email: SITE.email,
      contactType: "customer service",
      areaServed: "TR",
      availableLanguage: ["Turkish", "English", "Italian"],
    },
  };
}

export function localBusinessLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": ["CafeOrCoffeeShop", "Restaurant"],
    "@id": `${SITE.url}/#localbusiness`,
    name: `${SITE.name} — Maltepe Park`,
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
      closes: slot.closes,
    })),
    parentOrganization: {
      "@id": `${SITE.url}/#organization`,
    },
    areaServed: {
      "@type": "City",
      name: "İstanbul",
    },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Açık-hava teras", value: true },
      { "@type": "LocationFeatureSpecification", name: "Ücretsiz Wi-Fi", value: true },
      { "@type": "LocationFeatureSpecification", name: "Vale park", value: true },
      { "@type": "LocationFeatureSpecification", name: "Evcil hayvan dostu", value: true },
      { "@type": "LocationFeatureSpecification", name: "Vegan seçenek", value: true },
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
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(
  items: Array<{ name: string; url: string }>,
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
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
          suitableForDiet: item.tags?.includes("vegan opt.")
            ? "https://schema.org/VeganDiet"
            : undefined,
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
    numberOfItems: products.length,
    itemListElement: products.map((p, idx) => {
      const { amount, currency } = priceToMinor(p.price);
      const compareAt = p.compareAtPrice
        ? priceToMinor(p.compareAtPrice)
        : null;
      return {
        "@type": "ListItem",
        position: idx + 1,
        item: {
          "@type": "Product",
          name: p.name,
          description: p.desc,
          category: p.cat,
          brand: { "@type": "Brand", name: SITE.name },
          offers: {
            "@type": "Offer",
            price: amount,
            priceCurrency: currency,
            ...(compareAt ? { priceSpecification: { "@type": "UnitPriceSpecification", price: compareAt.amount, priceCurrency: compareAt.currency } } : {}),
            availability: "https://schema.org/InStock",
            seller: { "@id": `${SITE.url}/#organization` },
          },
        },
      };
    }),
  };
}

export function faqLd(entries: FaqEntry[] = FAQ): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
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

/**
 * Bundle every site-wide structured data block into one @graph so we emit a
 * single <script> tag instead of seven.
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
      breadcrumbLd([
        { name: "Ana Sayfa", url: "/" },
        { name: "Menü", url: "/#menu" },
        { name: "Mağaza", url: "/#shop" },
        { name: "Ziyaret", url: "/#visit" },
      ]),
    ],
  };
}
