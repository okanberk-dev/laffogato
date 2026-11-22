import type { Metadata } from "next";

import { FranchisePage } from "@/components/laffogato/franchise-page";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import { siteImage } from "@/lib/admin/site-images-core";
import { JsonLd } from "@/lib/seo/json-ld";
import { footerSettings, venueContact } from "@/lib/seo/contact";
import { openGraphBase } from "@/lib/seo/site";
import { getSiteImages, getSiteSettings } from "@/lib/seo/site-data";
import { breadcrumbLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

const TITLE = "Franchise Başvurusu | L'Affogato";
const DESCRIPTION =
  "L'Affogato franchise: köşkten doğan kahve, affogato ve karaoke konsepti. Süreci, sık sorulan soruları oku; başvuru formunu doldur, seni arayalım.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/franchise" },
  openGraph: {
    ...openGraphBase(),
    title: TITLE,
    description: DESCRIPTION,
    url: "/franchise",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * `/franchise` (operator, 22 Kas 2026). A page view wakes no database: the
 * settings (footer, contact address) and the photographs come from the
 * site's cache (src/lib/seo/site-data.ts). Only the form's submit writes
 * (src/app/franchise/actions.ts). Not a keyword landing page (CLAUDE.md
 * rule 15): it exists to take applications.
 */
export default async function FranchiseRoute() {
  const [settings, images] = await Promise.all([
    getSiteSettings(),
    getSiteImages(),
  ]);
  const contact = venueContact(settings);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Franchise", url: "/franchise" },
        ])}
      />
      <SiteChrome settings={footerSettings(settings)}>
        <FranchisePage
          heroImage={siteImage(images, "hero.franchise")}
          conceptImage={siteImage(images, "franchise.concept")}
          contactEmail={contact.email}
        />
      </SiteChrome>
    </>
  );
}
