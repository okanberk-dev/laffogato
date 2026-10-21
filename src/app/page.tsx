import type { Metadata } from "next";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import { FAQ } from "@/lib/seo/faq";
import { SITE, openGraphDefaults } from "@/lib/seo/site";
import { siteGraphLd } from "@/lib/seo/structured-data";
import { accountClosureNotice } from "@/lib/customer/account-closure";
import { TIER_LABELS } from "@/lib/mobile/loyalty-core";
import { loadAppProps } from "@/lib/seo/app-props";
import { JsonLd } from "@/lib/seo/json-ld";
import { getSiteSettings } from "@/lib/seo/site-data";

export const dynamic = "force-dynamic";

// Keyword-first local title (≤60 chars); `absolute` bypasses the layout title
// template so the brand isn't appended twice. The same string is used for
// og:title and twitter:title - the page used to publish three different
// titles, so a shared link and a search result named different things.
const HOME_TITLE = "Tuzla'da İtalyan Kahve, Affogato & Gelato - L'Affogato";

/**
 * Read from the admin's Ayarlar → SEO tab, with the defaults above as the
 * fallback. Both fields used to be written and never read anywhere, so the
 * panel offered control it did not have.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.seoTitle?.trim() || HOME_TITLE;
  const ogImage = settings.seoOgImageUrl?.trim();
  return {
    title: { absolute: title },
    description: SITE.shortDescription,
    alternates: { canonical: "/" },
    openGraph: {
      ...openGraphDefaults(),
      title,
      description: SITE.shortDescription,
      url: "/",
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SITE.shortDescription,
    },
  };
}

interface PageProps {
  searchParams: Promise<{
    cart?: string;
    item?: string;
    available?: string;
    hesap?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const [
    { cart, item, available, hesap },
    { settings, menu, products, appProps, contact },
  ] = await Promise.all([searchParams, loadAppProps({ withHomeHero: true })]);

  // The site's old self-service deletion landed here, and its `/?hesap=`
  // links are still out there (the page now sends a request instead).
  // Which sentence depends on whether the sign-in identity went too
  // (`accountClosureNotice`).
  let notice: string | undefined = accountClosureNotice(hesap);
  if (notice !== undefined) {
    // The account notice stands alone; a cart reason cannot ride along.
  } else if (cart === "out_of_stock") {
    const remain = Number(available);
    const tail =
      Number.isFinite(remain) && remain >= 0 ? ` (kalan: ${remain})` : "";
    notice = `Üzgünüz, "${item ?? "ürün"}" için yeterli stok yok${tail}. Sepetinden adedini azaltıp tekrar dene.`;
  } else if (cart === "empty") {
    notice = "Sepetin boş - bir affogato seçip dene.";
  } else if (cart === "shop_closed") {
    notice =
      "Mağaza şu an siparişe kapalı. Birazdan tekrar dener misin? Sepetin korunuyor.";
  } else if (cart === "not_found") {
    notice =
      "Sepetindeki bir ürün artık mevcut değil. Sepetini güncelleyip tekrar dene.";
  } else if (cart === "qty_too_high") {
    const max = Number(available);
    const cap = Number.isFinite(max) && max > 0 ? max : 99;
    notice = `"${item ?? "Bir ürün"}" için tek seferde en fazla ${cap} adet sipariş verilebilir. Daha fazlası için bizimle iletişime geç.`;
  }

  const graph = siteGraphLd(menu, products, settings);

  return (
    <>
      <JsonLd data={graph} />
      <LaffogatoApp
        {...appProps}
        notice={notice}
        seoSlot={<SeoContent faq={FAQ} contact={contact} />}
        // The karaoke band and hero slide say what the panel says: the room's
        // size, hours, price and the top tier's discount (presentation only;
        // the booking re-reads every one of them on the server).
        karaoke={{
          capacity: settings.karaokeCapacity,
          hourlyMinor: settings.karaokeHourlyMinor,
          closeHour: settings.mobileApp.karaoke.closeHour,
          rubyDiscountPct: settings.mobileApp.karaoke.oroDiscountPct,
          rubyLabel: TIER_LABELS.oro,
          prepay: settings.karaokePrepay,
        }}
      />
    </>
  );
}
